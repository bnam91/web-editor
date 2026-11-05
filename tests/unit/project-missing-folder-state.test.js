/* project-missing-folder-state — 폴더가 앱 밖에서 없어진 프로젝트와 앱 안 삭제를 main 이 가른다(MISSING-PROJECT-TAB-NO-NOTICE-01 · 탭 쪽은 tests/dom/tab-missing-project-notice).
 * 칸: 진짜 main 핸들러(_ipc-harness). S1 있음 · S2 앱 밖에서 없어짐 · S3 앱 휴지통 · S4 영구 삭제 · R1 저장이 폴더를 다시 만들고 알린다 · R2 읽은 뒤 없어져도 같다.
 * 대조: N1 새 프로젝트의 첫 저장은 말 없음 · N2 폴더가 있는 저장은 말 없음 · N3 앱 안 삭제는 안 되살린다.
 * 칸(리뷰): S5 폴더 못 읽음 · S6 뿌리 못 읽음 · S7 깨진 휴지통 메타.
 * 변이: 회신의 값(ENOENT 판정을 existsSync 로 되돌리면 S5·S6 빨강 · 몸통 보기를 빼면 S7 빨강). */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { loadMain } = require('./_ipc-harness');

const H = loadMain();
const said = [];
H.stub.BrowserWindow.getAllWindows = () => [{ webContents: { executeJavaScript: async (js) => { said.push(js); } } }];
const proj = (id) => ({ id, name: id, version: 2, pages: [{ id: 'page_1', name: 'P', canvas: '<div class="section-block"></div>' }] });
let n = 0;
const made = async () => { const id = 'proj_' + (9500 + n++); assert.equal((await H.invoke('projects:save', proj(id))).ok, true); return id; };
const dir = (id) => path.join(H.projectsDir, id);
const goneOutside = (id) => fs.renameSync(dir(id), path.join(H.userData, 'gone-' + id));   // 앱 밖에서 옮겨 없앤 꼴 — 치우기는 하네스 임시 폴더 몫
const notes = (id) => said.filter((x) => x.includes('noteProjectFolderRecreated') && x.includes(id)).length;

test('S1 폴더가 있으면 ok', async () => {
  assert.equal(await H.invoke('projects:folder-state', await made()), 'ok');
});
test('S2 앱 밖에서 없어지면 missing', async () => {
  const id = await made(); goneOutside(id);
  assert.equal(await H.invoke('projects:folder-state', id), 'missing');
});
test('S3 앱 휴지통으로 옮긴 것은 trashed', async () => {
  const id = await made(); await H.invoke('projects:delete', id);
  assert.equal(await H.invoke('projects:folder-state', id), 'trashed');
});
test('S4 영구 삭제도 trashed — 저장이 못 되살리는 쪽', async () => {
  const id = await made(); await H.invoke('projects:delete', id, { permanent: true });
  assert.equal(await H.invoke('projects:folder-state', id), 'trashed');
});
test('S5 폴더를 못 읽으면(EACCES) missing 이 아니라 unknown', async () => {
  const id = await made(); fs.chmodSync(dir(id), 0o000);
  try { assert.equal(await H.invoke('projects:folder-state', id), 'unknown'); } finally { fs.chmodSync(dir(id), 0o755); }
  assert.equal(await H.invoke('projects:folder-state', id), 'ok', '[대조] 풀면 ok');
});
test('S6 뿌리를 못 읽으면 어느 id 든 unknown · 빈 id 도 unknown', async () => {
  const id = await made(); fs.chmodSync(H.projectsDir, 0o000);
  try { assert.equal(await H.invoke('projects:folder-state', id), 'unknown'); assert.equal(await H.invoke('projects:folder-state', ''), 'unknown'); } finally { fs.chmodSync(H.projectsDir, 0o755); }
  assert.equal(await H.invoke('projects:folder-state', ''), 'ok', '[대조] 풀면 ok');
});
test('S7 앱 휴지통의 메타가 깨져도 몸통이 있으면 trashed — 재시작 뒤 꼴(이번 실행의 삭제 기억 없음)', async () => {
  const id = await made(); goneOutside(id);
  fs.mkdirSync(path.join(H.appTrashDir, id), { recursive: true }); fs.writeFileSync(path.join(H.appTrashDir, id + '.json'), '{깨짐');
  assert.equal(await H.invoke('projects:folder-state', id), 'trashed');
});
test('K1 뿌리 값 — 비로그인 뿌리는 legacy · 계정이 바뀌면 값이 바뀐다', async () => {
  assert.equal(await H.invoke('projects:root-key'), 'legacy');
});
test('R1 앱 밖에서 없어진 뒤 저장은 폴더를 다시 만들고 알린다', async () => {
  const id = await made(); goneOutside(id);
  assert.equal((await H.invoke('projects:save', proj(id))).ok, true);
  assert.equal(fs.existsSync(path.join(dir(id), 'proj.json')), true, '★편집이 파일에 안 남았다');
  assert.equal(notes(id), 1);
  assert.equal(await H.invoke('projects:folder-state', id), 'ok');
});
test('R2 이번 실행에서 읽기만 한 것도 같다', async () => {
  const id = 'proj_' + (9500 + n++); fs.mkdirSync(dir(id), { recursive: true }); fs.writeFileSync(path.join(dir(id), 'proj.json'), JSON.stringify(proj(id)));
  assert.equal((await H.invoke('projects:load', id)).id, id);
  goneOutside(id);
  assert.equal((await H.invoke('projects:save', proj(id))).ok, true);
  assert.equal(notes(id), 1);
});
test('N1 [대조] 새 프로젝트의 첫 저장은 말이 없다', async () => {
  const id = await made();
  assert.equal(notes(id), 0);
});
test('N2 [대조] 폴더가 있는 저장은 말이 없다', async () => {
  const id = await made();
  assert.equal((await H.invoke('projects:save', proj(id))).ok, true);
  assert.equal(notes(id), 0);
});
test('N3 [대조] 앱 안 삭제는 저장이 안 되살리고 말도 없다', async () => {
  const id = await made(); await H.invoke('projects:delete', id);
  assert.equal((await H.invoke('projects:save', proj(id))).reason, 'project_deleted');
  assert.equal(fs.existsSync(dir(id)), false);
  assert.equal(notes(id), 0);
});
