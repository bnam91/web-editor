/* missing-folder-returned-save — 남은 본으로 연 탭의 저장은 돌아온 폴더를 안 덮는다(MISSING-FOLDER-RETURNS-WHILE-VIEWING-OVERWRITES-01 · 탭 쪽은 tests/dom/missing-folder-returns-while-viewing).
 * 앱 값(MPT-리뷰8-203500 · L3 3/3): 폴더 없는 탭을 LS 본으로 보는 중 폴더가 돌아오고 그 탭에서 편집하면 돌아온 파일이 proj_backup 한 칸에만 남는다.
 * 칸: 진짜 main 핸들러(_ipc-harness). G1 비동기 저장 거절 · G2 동기(종료·새로고침) 저장 거절 · G3 거절한 본은 버전 기록에 남는다(편집을 안 버린다).
 * 칸(리뷰 1): G4 남긴 본은 핀(프룬·핀 상한 밖)이고 버전 목록의 «현재»를 안 바꾼다 · G5 버전 기록을 못 쓰면 비상 사본으로 남긴다 · 렌더러 칸(줄 선 저장)은 DOM V5.
 * 칸(리뷰 2): G6 제가 다시 만든 폴더에 줄 선 표시 저장은 거절하지 않는다 · G7 그 뒤 탭이 파일로 돌아왔다가(표시 없는 저장) 폴더가 바뀌어 돌아오면 다시 거절한다.
 * 대조: N1 폴더가 아직 없으면 표시를 떼고 다시 만든다 · N2 표시 없는 저장은 평소대로 덮는다.
 * 변이(잰 값): _goneBaseRefusal 을 빼면 G1·G2·G3·N1 빨강(N1 = 표시가 파일에 남는다) · N2 초록. */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs'), path = require('path');
const { loadMain } = require('./_ipc-harness');

const H = loadMain();
H.stub.BrowserWindow.getAllWindows = () => [{ webContents: { executeJavaScript: async () => {} } }];
const img = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const sec = (k, t) => `<div class="section-block" id="sec_${k}" data-section="1"><div class="section-inner"><div class="text-block" id="tb_${k}"><p>${t}</p></div><div class="asset-block" id="ab_${k}" data-img-src="${img}"></div></div></div>`;
const proj = (id, tag) => ({ id, name: id, version: 2, currentPageId: 'page_1', pages: [{ id: 'page_1', name: 'P', canvas: sec('a', tag + ' 머리') + sec('b', tag + ' 몸') + sec('c', tag + ' 끝') }] });
let n = 0;
const dir = (id) => path.join(H.projectsDir, id);
const file = (id) => JSON.parse(fs.readFileSync(path.join(dir(id), 'proj.json'), 'utf8'));
const away = (id) => path.join(H.userData, 'away-' + id);
/* 폴더를 앱 밖으로 옮겼다가 되돌린 꼴 — 그사이 다른 곳에서 고친 «돌아온» 내용이 들어 있다. */
async function returned() {
  const id = 'proj_' + (9700 + n++);
  assert.equal((await H.invoke('projects:save', proj(id, '처음'))).ok, true);
  fs.renameSync(dir(id), away(id));
  assert.equal(await H.invoke('projects:folder-state', id), 'missing');
  fs.renameSync(away(id), dir(id));
  fs.writeFileSync(path.join(dir(id), 'proj.json'), JSON.stringify(proj(id, '돌아온')));
  return id;
}
const history = (id) => { const h = path.join(dir(id), 'proj_history'); return fs.existsSync(h) ? fs.readdirSync(h).filter((f) => /^\d+\.json$/.test(f)).map((f) => fs.readFileSync(path.join(h, f), 'utf8')) : []; };

test('G1 비동기 저장 — 남은 본 표시가 붙은 저장은 돌아온 파일을 안 덮는다', async () => {
  const id = await returned();
  const r = await H.invoke('projects:save', { ...proj(id, '남은본편집'), _goneBase: true });
  assert.equal(r.ok, false); assert.equal(r.reason, 'folder_returned');
  assert.match(JSON.stringify(file(id)), /돌아온 머리/, '★돌아온 파일을 덮었다');
});
test('G2 동기 저장(종료·새로고침) — 같다', () => {
  return returned().then((id) => {
    const r = H.invokeSync('projects:save-sync', null, { ...proj(id, '남은본편집'), _goneBase: true });
    assert.equal(r.ok, false); assert.equal(r.reason, 'folder_returned');
    assert.match(JSON.stringify(file(id)), /돌아온 머리/, '★종료 저장이 돌아온 파일을 덮었다');
  });
});
test('G3 거절한 본은 버전 기록에 남는다 — 거절이 편집을 안 버린다(비동기·동기)', async () => {
  for (const sync of [false, true]) {
    const id = await returned();
    const before = history(id).filter((x) => x.includes('남은본편집')).length;
    const body = { ...proj(id, '남은본편집'), _goneBase: true };
    const r = sync ? H.invokeSync('projects:save-sync', null, body) : await H.invoke('projects:save', body);
    assert.equal(r.kept, 'history', (sync ? '동기' : '비동기') + ' kept');
    const kept = history(id).filter((x) => x.includes('남은본편집'));
    assert.equal(kept.length, before + 1, '★거절한 편집이 어디에도 안 남았다 · ' + (sync ? '동기' : '비동기'));
    assert.equal(kept[0].includes('_goneBase'), false, '표시는 파일에 안 들어간다');
  }
});
test('N1 [대조] 폴더가 아직 없으면 표시를 떼고 다시 만든다', async () => {
  const id = 'proj_' + (9700 + n++);
  assert.equal((await H.invoke('projects:save', proj(id, '처음'))).ok, true);
  fs.renameSync(dir(id), away(id));
  const r = await H.invoke('projects:save', { ...proj(id, '남은본편집'), _goneBase: true });
  assert.equal(r.ok, true);
  assert.match(JSON.stringify(file(id)), /남은본편집 머리/);
  assert.equal('_goneBase' in file(id), false, '표시가 파일에 들어갔다');
});
test('N2 [대조] 표시 없는 저장은 평소대로 덮는다', async () => {
  const id = await returned();
  assert.equal((await H.invoke('projects:save', proj(id, '평소'))).ok, true);
  assert.match(JSON.stringify(file(id)), /평소 머리/);
});

const idx = (id) => JSON.parse(fs.readFileSync(path.join(dir(id), 'proj_history', 'index.json'), 'utf8'));
test('G4 남긴 본은 핀이다 — 프룬이 못 지우고, 버전 목록의 «현재»는 돌아온 파일 그대로', async () => {
  const id = await returned();
  const cur0 = idx(id).current;
  await H.invoke('projects:save', { ...proj(id, '남은본편집'), _goneBase: true });
  const e = idx(id).entries.find((x) => x.reason === 'gone-copy');
  assert.ok(e, '[전제] 남긴 칸');
  assert.equal(e.pinned, true, '★핀이 아니다 — 약 20칸 뒤 프룬이 지운다');
  assert.deepEqual(idx(id).current, cur0, '★남긴 본이 «현재»를 바꿨다');
});
test('G5 버전 기록을 못 쓰면 비상 사본으로 남긴다', async () => {
  const id = await returned();
  const h = path.join(dir(id), 'proj_history'); fs.chmodSync(h, 0o500);
  let r; try { r = await H.invoke('projects:save', { ...proj(id, '기록못씀편집'), _goneBase: true }); } finally { fs.chmodSync(h, 0o755); }
  assert.equal(r.reason, 'folder_returned'); assert.equal(r.kept, 'emergency');
  const em = path.join(H.userData, 'emergency-saves');
  assert.ok(fs.readdirSync(em).some((f) => f.startsWith(id) && fs.readFileSync(path.join(em, f), 'utf8').includes('기록못씀편집')), '★어디에도 안 남았다');
  assert.match(JSON.stringify(file(id)), /돌아온 머리/);
});
test('G6 제가 다시 만든 폴더 — 줄에 선 표시 저장은 거절하지 않는다(거짓 «돌아왔다» 없음)', async () => {
  const id = 'proj_' + (9700 + n++);
  assert.equal((await H.invoke('projects:save', proj(id, '처음'))).ok, true);
  fs.renameSync(dir(id), away(id));
  assert.equal(await H.invoke('projects:folder-state', id), 'missing');
  assert.equal((await H.invoke('projects:save', { ...proj(id, '첫저장'), _goneBase: true })).ok, true, '[전제] 다시 만듦');
  const r = await H.invoke('projects:save', { ...proj(id, '줄선저장'), _goneBase: true });
  assert.equal(r.ok, true, '★제가 만든 폴더를 «돌아왔다»고 거절했다');
  assert.match(JSON.stringify(file(id)), /줄선저장 머리/);
});
test('G7 그 뒤 파일로 돌아왔다가 또 없어지고 바뀐 채 돌아오면 다시 거절한다', async () => {
  const id = 'proj_' + (9700 + n++);
  assert.equal((await H.invoke('projects:save', proj(id, '처음'))).ok, true);
  fs.renameSync(dir(id), away(id));
  assert.equal((await H.invoke('projects:save', { ...proj(id, '첫저장'), _goneBase: true })).ok, true);
  assert.equal((await H.invoke('projects:save', proj(id, '평소'))).ok, true);   // 탭이 파일로 돌아왔다
  fs.rmSync(dir(id), { recursive: true }); fs.renameSync(away(id), dir(id));   // 또 없어졌다가 옛 폴더가 돌아왔다(그사이 상태를 물었든 안 물었든)
  const r = await H.invoke('projects:save', { ...proj(id, '남은본편집'), _goneBase: true });
  assert.equal(r.reason, 'folder_returned', '★돌아온 폴더를 덮었다');
  assert.match(JSON.stringify(file(id)), /처음 머리/);
});
