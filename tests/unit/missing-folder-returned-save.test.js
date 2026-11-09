/* missing-folder-returned-save — 남은 본으로 연 탭의 저장은 돌아온 폴더를 안 덮는다(MISSING-FOLDER-RETURNS-WHILE-VIEWING-OVERWRITES-01 · 탭 쪽은 tests/dom/missing-folder-returns-while-viewing).
 * 앱 값(MPT-리뷰8-203500 · L3 3/3): 폴더 없는 탭을 LS 본으로 보는 중 폴더가 돌아오고 그 탭에서 편집하면 돌아온 파일이 proj_backup 한 칸에만 남는다.
 * 칸: 진짜 main 핸들러(_ipc-harness). G1 비동기 저장 거절 · G2 동기(종료·새로고침) 저장 거절 · G3 거절한 본은 버전 기록에 남는다(편집을 안 버린다).
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
    assert.equal(r.kept, true, (sync ? '동기' : '비동기') + ' kept');
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
