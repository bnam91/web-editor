/* missing-folder-returned-save — 남은 본으로 연 탭의 저장은 돌아온 폴더를 안 덮는다(MISSING-FOLDER-RETURNS-WHILE-VIEWING-OVERWRITES-01 · 탭 쪽은 tests/dom/missing-folder-returns-while-viewing).
 * 앱 값(MPT-리뷰8-203500 · L3 3/3): 폴더 없는 탭을 LS 본으로 보는 중 폴더가 돌아오고 그 탭에서 편집하면 돌아온 파일이 proj_backup 한 칸에만 남는다.
 * 칸: 진짜 main 핸들러(_ipc-harness). G1 비동기 저장 거절 · G2 동기(종료·새로고침) 저장 거절 · G3 거절한 본은 버전 기록에 남는다(편집을 안 버린다).
 * 칸(리뷰 1): G4 남긴 본은 핀(프룬·핀 상한 밖)이고 버전 목록의 «현재»를 안 바꾼다 · G5 버전 기록을 못 쓰면 비상 사본으로 남긴다 · 렌더러 칸(줄 선 저장)은 DOM V5.
 * 칸(리뷰 2): G6 제가 다시 만든 폴더에 줄 선 표시 저장은 거절하지 않는다 · G7 그 뒤 탭이 파일로 돌아왔다가(표시 없는 저장) 폴더가 바뀌어 돌아오면 다시 거절한다.
 * 칸(리뷰 3): G8 다시 만들기 쓰기가 실패하면 제 폴더로 기억하지 않는다 — 그 뒤 밖에서 돌아오면 거절한다.
 * 칸(-02 · 미카사 int-3 실앱 2/2): returned() 가 실앱 순서(남은 본 자동저장이 폴더를 다시 만든 뒤 원래 폴더가 Finder 대치로 돌아옴)를 탄다 ⇒ G1~G5 가 그 길 ·
 *   G9 다시 만들기 없는 옛 순서도 거절 · G10 다시 만든 뒤 제 저장이 이어져도 거절 없음 → 대치로 돌아오면 거절 · G11 그 사이 표시 없는 쓰기(이름 바꾸기·복원)가 껴도 거짓 거절 없음(리뷰 1). 기준 int-3 은 G1~G5·G10 빨강(제 폴더라 기억한 id 만 보고 덮었다).
 * 칸(-02b): G12 보는 동안 빠진 폴더를 표시 없는 저장이 다시 만든 뒤 대치로 돌아오면 거절 · 열며 읽은 뒤엔 평소.
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
/* 폴더를 앱 밖으로 옮겼다가 되돌린 꼴 — 그사이 다른 곳에서 고친 «돌아온» 내용이 들어 있다.
   ★-02 실앱 순서(미카사 int-3 2/2): 폴더가 없는 동안 남은 본 탭의 자동저장이 «표시 저장»으로 폴더를 다시 만들고,
     사용자는 원래 폴더를 Finder 로 «대치»해 되돌린다(앱이 만든 폴더는 치워진다). recreate:false = 그 저장 없이 바로 돌아온 옛 순서. */
async function returned({ recreate = true } = {}) {
  const id = 'proj_' + (9700 + n++);
  assert.equal((await H.invoke('projects:save', proj(id, '처음'))).ok, true);
  fs.renameSync(dir(id), away(id));
  assert.equal(await H.invoke('projects:folder-state', id), 'missing');
  if (recreate) {
    assert.equal((await H.invoke('projects:save', { ...proj(id, '남은본자동'), _goneBase: true })).ok, true, '[전제] 남은 본 자동저장이 폴더를 다시 만든다');
    fs.renameSync(dir(id), away(id) + '-app');   // Finder 대치 — 앱이 만든 폴더를 치우고(지우지 않고 옮긴다 · tmproot-sole-owner)
  }
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
  fs.renameSync(dir(id), away(id) + '-2'); fs.renameSync(away(id), dir(id));   // 또 없어졌다가 옛 폴더가 돌아왔다(그사이 상태를 물었든 안 물었든) · 지우지 않고 옮긴다 — 임시물 치우기는 _tmproot 몫(tmproot-sole-owner)
  const r = await H.invoke('projects:save', { ...proj(id, '남은본편집'), _goneBase: true });
  assert.equal(r.reason, 'folder_returned', '★돌아온 폴더를 덮었다');
  assert.match(JSON.stringify(file(id)), /처음 머리/);
});
test('G8 다시 만들기가 실패하면 제 폴더로 기억하지 않는다 — 밖에서 돌아온 파일을 안 덮는다', async () => {
  const id = 'proj_' + (9700 + n++);
  assert.equal((await H.invoke('projects:save', proj(id, '처음'))).ok, true);
  fs.renameSync(dir(id), away(id));
  fs.chmodSync(H.projectsDir, 0o500);   // 뿌리에 못 쓴다 — 다시 만들기가 던진다
  let r1; try { r1 = await H.invoke('projects:save', { ...proj(id, '실패한저장'), _goneBase: true }); } catch (_) { r1 = { ok: false, threw: true }; } finally { fs.chmodSync(H.projectsDir, 0o755); }
  assert.equal(r1.ok, false, '[전제] 다시 만들기가 실패했다');
  fs.renameSync(away(id), dir(id));   // 밖에서 돌아왔다 · 탭은 안 옮겼다(folder-state 를 안 물었다)
  const r = await H.invoke('projects:save', { ...proj(id, '남은본편집'), _goneBase: true });
  assert.equal(r.reason, 'folder_returned', '★실패한 다시 만들기를 제 폴더로 기억해 돌아온 파일을 덮었다');
  assert.match(JSON.stringify(file(id)), /처음 머리/);
});

test('G9 다시 만들기 없이 바로 돌아온 옛 순서도 거절한다', async () => {
  const id = await returned({ recreate: false });
  const r = await H.invoke('projects:save', { ...proj(id, '남은본편집'), _goneBase: true });
  assert.equal(r.reason, 'folder_returned');
  assert.match(JSON.stringify(file(id)), /돌아온 머리/);
});
test('G10 다시 만든 뒤 제 저장이 이어져도 거절이 없다 → 원래 폴더가 대치로 돌아오면 거절한다', async () => {
  const id = 'proj_' + (9700 + n++);
  assert.equal((await H.invoke('projects:save', proj(id, '처음'))).ok, true);
  fs.renameSync(dir(id), away(id));
  for (const tag of ['자동1', '자동2', '자동3']) {
    const r = await H.invoke('projects:save', { ...proj(id, tag), _goneBase: true });
    assert.equal(r.ok, true, `★제가 다시 만든 폴더에 이어 쓴 저장(${tag})을 «돌아왔다»고 거절했다`);
  }
  assert.match(JSON.stringify(file(id)), /자동3 머리/);
  fs.renameSync(dir(id), away(id) + '-app');   // Finder 대치
  fs.renameSync(away(id), dir(id));
  const r = await H.invoke('projects:save', { ...proj(id, '남은본편집'), _goneBase: true });
  assert.equal(r.reason, 'folder_returned', '★대치로 돌아온 원래 폴더를 덮었다');
  assert.match(JSON.stringify(file(id)), /처음 머리/);
  assert.ok(history(id).some((h) => /남은본편집 머리/.test(h)), '거절한 본은 버전 기록에 남는다');
});

test('G11 다시 만든 폴더 위의 표시 없는 쓰기(이름 바꾸기·버전 복원 꼴) 뒤에도 그 탭의 표시 저장을 «돌아왔다»고 거절하지 않는다(리뷰 1)', async () => {
  const id = 'proj_' + (9700 + n++);
  assert.equal((await H.invoke('projects:save', proj(id, '처음'))).ok, true);
  fs.renameSync(dir(id), away(id));
  assert.equal((await H.invoke('projects:save', { ...proj(id, '자동1'), _goneBase: true })).ok, true, '[전제] 다시 만듦');
  assert.equal((await H.invoke('projects:save', { ...proj(id, '이름바꿈'), name: '새 이름' })).ok, true, '표시 없는 쓰기(제 폴더 위)');
  const r = await H.invoke('projects:save', { ...proj(id, '자동2'), _goneBase: true });
  assert.equal(r.ok, true, `★제 폴더인데 «돌아왔다»고 거절했다(${r.reason})`);
  assert.match(JSON.stringify(file(id)), /자동2 머리/);
  fs.renameSync(dir(id), away(id) + '-app'); fs.renameSync(away(id), dir(id));   // 그 뒤 대치로 돌아오면 여전히 거절
  assert.equal((await H.invoke('projects:save', { ...proj(id, '남은본편집'), _goneBase: true })).reason, 'folder_returned');
});

test('G12 보는 동안 폴더가 빠져 표시 없는 저장이 다시 만든 뒤 원본이 대치로 돌아오면 — 표시 없어도 거절 · 파일을 열며 읽은 뒤엔 평소 저장(-02b)', async () => {
  const id = 'proj_' + (9700 + n++);
  assert.equal((await H.invoke('projects:save', proj(id, '처음'))).ok, true);
  fs.renameSync(dir(id), away(id));   // 보는 동안 밖으로
  const re = await H.invoke('projects:save', proj(id, '보는중'));   // 표시 없는 자동저장 — 평소 길로 다시 만든다
  assert.equal(re.ok, true); assert.equal(re.recreated, true, '[전제] 평소 길의 다시 만들기');
  assert.equal((await H.invoke('projects:save', proj(id, '보는중2'))).ok, true, '★제가 다시 만든 폴더 위 이어 쓴 저장을 거절했다');
  fs.writeFileSync(path.join(away(id), 'proj.json'), JSON.stringify(proj(id, '밖에서고침')));   // 밖에 있는 동안 고침
  fs.renameSync(dir(id), away(id) + '-app'); fs.renameSync(away(id), dir(id));   // Finder 대치
  const r = await H.invoke('projects:save', proj(id, '대치뒤편집'));
  assert.equal(r.reason, 'folder_returned', '★표시 없는 저장이 대치로 돌아온 원본을 덮었다');
  assert.match(JSON.stringify(file(id)), /밖에서고침 머리/);
  assert.ok(history(id).some((h) => /대치뒤편집 머리/.test(h)), '거절한 본은 버전 기록에 남는다');
  await H.invoke('projects:load', id, { open: true });   // 탭이 파일로 다시 열림
  assert.equal((await H.invoke('projects:save', proj(id, '다시연뒤'))).ok, true, '★파일을 열며 읽은 뒤의 평소 저장을 거절했다');
  assert.match(JSON.stringify(file(id)), /다시연뒤 머리/);
});
