/* project-deleted-save-guard — 연 프로젝트를 지운 뒤의 쓰기는 거절한다(현빈 결정 2026-11-03 · 탭 닫기·알림은 tests/dom/tab-deleted-project).
 * 왜: 자동저장이 폴더를 다시 만들어, 지운 프로젝트가 목록에 되살아났다(휴지통·영구 둘 다 · 앱 3/3).
 * 칸: 진짜 main 핸들러(_ipc-harness). D1~D4 지운 뒤 쓰기 넷 · R 복원이 푼다 · 대조 N1~N3.
 * 변이: _isProjectDeleted 를 false 로 두면 D1~D4 빨강 · R·N 초록. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { loadMain } = require('./_ipc-harness');

const H = loadMain();
const proj = (id) => ({ id, name: id, version: 2, pages: [{ id: 'page_1', name: 'P', canvas: '<div class="section-block"></div>' }] });
let n = 0;
const made = async () => { const id = 'proj_' + (9000 + n++); assert.equal((await H.invoke('projects:save', proj(id))).ok, true); return id; };
const back = (id) => fs.existsSync(path.join(H.projectsDir, id));

for (const [name, opts] of [['휴지통', {}], ['영구', { permanent: true }]]) {
  test(`D1 ${name} — 지운 뒤 저장은 거절 · 폴더가 안 생긴다`, async () => {
    const id = await made();
    assert.equal((await H.invoke('projects:delete', id, opts)).ok, true);
    assert.equal(back(id), false, '[전제] 지워졌다');
    assert.equal((await H.invoke('projects:save', proj(id))).reason, 'project_deleted');
    assert.equal(back(id), false, '★저장이 되살렸다');
  });
}
test('D2 종료 저장(save-sync)도 거절', async () => {
  const id = await made();
  await H.invoke('projects:delete', id);
  assert.equal(H.invokeSync('projects:save-sync', {}, proj(id)).reason, 'project_deleted');
  assert.equal(back(id), false);
});
test('D3 썸네일 meta 도 거절', async () => {
  const id = await made();
  await H.invoke('projects:delete', id);
  assert.equal((await H.invoke('projects:save-meta', id, { thumbnail: 'x' })).reason, 'project_deleted');
  assert.equal(back(id), false);
});
test('D4 이미지 쓰기도 거절 — 폴더만 생겨도 복원이 id_taken 으로 막힌다', async () => {
  const id = await made();
  await H.invoke('projects:delete', id);
  const b64 = Buffer.from('x').toString('base64');
  assert.equal((await H.invoke('assets:saveFile', { projectId: id, b64, mime: 'image/png' })).ok, false);
  assert.equal((await H.invoke('assets:saveCanvasImage', { projectId: id, b64, mime: 'image/png' })).ok, false);
  assert.equal(back(id), false);
  assert.equal((await H.invoke('trash:restore', id)).ok, true);
});
test('R 복원하면 다시 저장된다', async () => {
  const id = await made();
  await H.invoke('projects:delete', id);
  assert.equal((await H.invoke('trash:restore', id)).ok, true);
  assert.equal((await H.invoke('projects:save', proj(id))).ok, true);
  assert.equal(back(id), true);
});
test('N1 [음성] 안 지운 프로젝트 저장 · 처음 저장하는 새 id', async () => {
  const a = await made(), b = await made();
  await H.invoke('projects:delete', a);
  assert.equal((await H.invoke('projects:save', proj(b))).ok, true);
  assert.equal((await H.invoke('projects:save', proj('proj_8888'))).ok, true);
});
test('N2 [음성] 복제는 새 id 로 저장된다 · 원본을 지워도 사본 저장 정상', async () => {
  const a = await made();
  const d = await H.invoke('projects:duplicate', { sourceProjectId: a, newName: '사본' });
  assert.equal(d.ok, true);
  await H.invoke('projects:delete', a);
  const nid = d.newProjectId;
  assert.ok(nid, '[전제] 사본 id');
  assert.equal((await H.invoke('projects:save', proj(nid))).ok, true);
});
test('N3 [음성] 영구 삭제가 번들 전에 실패하면 저장을 안 막는다', async () => {
  const id = await made();
  const dir = path.join(H.projectsDir, id);
  fs.chmodSync(dir, 0o555);   // 영구 삭제는 fs.rmSync — 폴더를 잠가 실패시킨다
  const r = await H.invoke('projects:delete', id, { permanent: true });
  fs.chmodSync(dir, 0o755);
  assert.equal(r.ok, false);
  assert.equal((await H.invoke('projects:save', proj(id))).ok, true);
});
