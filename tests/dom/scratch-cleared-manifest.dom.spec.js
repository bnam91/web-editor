/* scratch-cleared-manifest — clearScratchPad 로 비운 스크래치가 저장 뒤 다시 열면 돌아오지 않는다 (SCRATCH-CLEARED-MANIFEST-STAYS-01)
 * 왜: clearScratchPad 가 IDB 키를 «지웠다». 외부화(externalizeScratchpad)는 키 없음 = «모름» 이라 매니페스트를 보존 ⇒ 디스크에 2 그대로,
 *   로드(_loadScratch)는 키 없음 + 매니페스트 있음 = 다른 맥 ⇒ 매니페스트로 되채움 ⇒ 같은 맥에서도 다시 열면 2장이 돌아왔다.
 * 디스크: proj 객체(= proj.json 의 pages[].scratchpad)를 저장마다 그대로 이어 쓴다. 다시 열기 = state.pages 를 디스크로 갈고 initScratchPad(읽기만).
 * 칸: M1 비움→저장→매니페스트 0·다시 열면 0 · M2 [대조] 안 비움→2 유지 · M3 [가드] 키 없음(이 맥에서 아직 안 읽음)→매니페스트 안 지움 · M4 ⌘Z 는 비움을 안 되돌린다(이력 없음).
 * 변이: 고침만 되돌리면 M1·M4 빨강 · M2·M3 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

// 진짜 그림: 2×2 빨강 PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==';
const ASSET = 'goya-asset://proj_m/b3f1c2.png';

async function setup(page) {
  const errs = await bootApp(page);
  await page.evaluate(async ({ PNG, ASSET }) => {
    let n = 0;
    window.electronAPI = { assetsSaveCanvasImage: async ({ projectId, mime }) => ({ ok: true, url: `goya-asset://${projectId}/h${++n}.${mime.split('/')[1]}` }) };
    window.state.pages = [{ id: 'p1' }];
    window.__disk = { pages: [{ id: 'p1' }] };
    window.__save = async () => { const proj = JSON.parse(JSON.stringify(window.__disk)); await window.externalizeScratchpad(proj, 'proj_m'); window.__disk = proj; return (proj.pages[0].scratchpad || null); };
    window.__reopen = async () => { window.state.pages = JSON.parse(JSON.stringify(window.__disk.pages)); await window.initScratchPad('proj_m', 'p1'); };   // 앱 다시 실행 = 저장 없이 읽기만(switchScratch 는 먼저 [] 를 써서 버그를 가린다)
    window.__items = () => [...document.querySelectorAll('.scratch-item')].map(e => e.dataset.scratchId).sort();
    await window.switchScratch('proj_m', 'p1');
    await window._scratchAddAndSaveFx(PNG, 700, 200, 300, undefined, 'sp_img', undefined, [{ text: '여름 신상 30% 할인 — 7/1~7/14', at: 1 }]);
    await window._scratchAddAndSave(ASSET, 700, 600, 240, undefined, 'sp_asset');
    window.clearHistory?.();
  }, { PNG, ASSET });
  const m = await page.evaluate(() => window.__save());
  expect(m.map(i => i.id).sort(), '[전제] 디스크 매니페스트 2').toEqual(['sp_asset', 'sp_img']);
  expect(m.find(i => i.id === 'sp_img').src, '[전제] 그림이 에셋으로 나갔다').toMatch(/^goya-asset:\/\/proj_m\//);
  expect(m.find(i => i.id === 'sp_img').ocr?.[0]?.text, '[전제] 글 기록이 실렸다').toBe('여름 신상 30% 할인 — 7/1~7/14');
  return errs;
}

test('M1 비우고 저장하면 매니페스트 0, 다시 열면 비어 있다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.clearScratchPad());
  expect(await page.evaluate(() => window.__items())).toEqual([]);
  expect.soft(await page.evaluate(() => window.__save()), '★비운 뒤 저장한 매니페스트').toEqual([]);
  await page.evaluate(() => window.__reopen());
  expect(await page.evaluate(() => window.__items()), '★다시 열면 돌아왔다').toEqual([]);
  expect(errs).toEqual([]);
});
test('M2 [대조] 안 비우면 저장·다시 열기에 둘 다 남는다', async ({ page }) => {
  const errs = await setup(page);
  expect((await page.evaluate(() => window.__save())).map(i => i.id).sort()).toEqual(['sp_asset', 'sp_img']);
  await page.evaluate(() => window.__reopen());
  expect(await page.evaluate(() => window.__items())).toEqual(['sp_asset', 'sp_img']);
  expect(errs).toEqual([]);
});
test('M3 [가드] 이 맥 IDB 에 키가 없으면(아직 안 읽음) 저장이 매니페스트를 안 지운다', async ({ page }) => {
  const errs = await setup(page);
  // 다른 맥에서 연 꼴: 이 맥 IDB 엔 키가 없고 디스크엔 2. 현재 판은 다른 프로젝트라 로드 전이다.
  await page.evaluate(async () => {
    await window.switchScratch('proj_other', 'p1');
    await new Promise((res, rej) => { const q = indexedDB.open('ScratchPadDB'); q.onsuccess = (e) => { const db = e.target.result; const tx = db.transaction('scratch', 'readwrite'); tx.objectStore('scratch').delete('scratch-pad-proj_m-p1'); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = rej; }; });
  });
  expect((await page.evaluate(() => window.__save())).map(i => i.id).sort(), '★로드 전 저장이 매니페스트를 지웠다').toEqual(['sp_asset', 'sp_img']);
  await page.evaluate(() => window.__reopen());
  expect(await page.evaluate(() => window.__items())).toEqual(['sp_asset', 'sp_img']);
  expect(errs).toEqual([]);
});
test('M4 비움 뒤 ⌘Z — 비움은 이력이 없어 안 되돌아오고, 저장해도 0 이다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.clearScratchPad());
  await page.keyboard.press('Meta+z');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  expect(await page.evaluate(() => window.__items())).toEqual([]);
  expect(await page.evaluate(() => window.__save())).toEqual([]);
  await page.evaluate(() => window.__reopen());
  expect(await page.evaluate(() => window.__items())).toEqual([]);
  expect(errs).toEqual([]);
});

/* ★적대 리뷰(261110) — 로드가 도는 «중»에 비우기: 늦은 읽기가 옛 두 장을 다시 그려 «화면엔 있는데 IDB·디스크엔 없음» 이었다.
   ⇒ 비우기가 도는 로드를 낡게 만든다 — 화면 = IDB = 디스크 = 0. */
test('M5 로드 도중 비우기 — 화면·IDB·저장 매니페스트 셋 다 0(늦은 읽기가 옛 장을 다시 그리지 않음)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async () => {
    const load = window.initScratchPad('proj_m', 'p1');   // 기다리지 않는다 — IDB 읽기가 도는 중
    const clear = window.clearScratchPad();
    await Promise.all([load, clear]);
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const db = await new Promise((res, rej) => { const q = indexedDB.open('ScratchPadDB'); q.onsuccess = () => res(q.result); q.onerror = rej; }).catch(() => null);
    let idb = 'n/a';
    if (db && db.objectStoreNames.contains('scratch')) { const st = 'scratch'; idb = await new Promise((res) => { const g = db.transaction(st).objectStore(st).get('scratch-pad-proj_m-p1'); g.onsuccess = () => res(g.result); g.onerror = () => res('err'); }); }
    return { screen: window.__items(), idb };
  });
  expect(r.screen, '★화면에 옛 장이 다시 그려졌다').toEqual([]);
  expect(r.idb, 'IDB = [] (비움)').toEqual([]);
  expect(await page.evaluate(() => window.__save()), '저장 매니페스트').toEqual([]);
  expect(errs).toEqual([]);
});

/* ★적대 리뷰 2(261110) — 페이지 바꾸는 중 비우기: 스크래치는 새 페이지 p2 로 넘어갔는데 캔버스(state.currentPageId)는 아직 p1.
   옛(5d2ebb71a): 도는 로드를 버리고 아직 안 보인 p2 의 장을 지웠다. ⇒ 지금: 거절 — p1·p2 장 둘 다 그대로. 전환이 끝나면(화면 = p2) 비우기는 p2 를 비운다. */
test('M6 페이지 바꾸는 «중» 비우기 = 거절(떠난 p1·새 p2 장 둘 다 그대로) · 전환이 끝난 뒤 비우기는 그 페이지만', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async ({ PNG }) => {
    const get = async (k) => { const db = await new Promise((res) => { const q = indexedDB.open('ScratchPadDB'); q.onsuccess = () => res(q.result); }); return new Promise((res) => { const g = db.transaction('scratch').objectStore('scratch').get(k); g.onsuccess = () => res((g.result || []).map((i) => i.id).sort()); }); };
    window.state.pages = [{ id: 'p1' }, { id: 'p2' }];
    await window.switchScratchPage('p2');
    await window._scratchAddAndSaveFx(PNG, 700, 200, 300, undefined, 'sp_p2', undefined, [{ text: 'p2 메모', at: 1 }]);
    await window.switchScratchPage('p1');
    // 전환 «중»(p1 → p2 저장·로드가 도는 동안) 비우기
    const sw = window.switchScratchPage('p2');
    const refused = await window.clearScratchPad();
    await sw;
    const mid = { p1: await get('scratch-pad-proj_m-p1'), p2: await get('scratch-pad-proj_m-p2'), screen: window.__items() };
    const done = await window.clearScratchPad();   // 전환 끝 — 지금 컨텍스트 p2 를 비운다
    const after = { p1: await get('scratch-pad-proj_m-p1'), p2: await get('scratch-pad-proj_m-p2') };
    return { refused, done, mid, after };
  }, { PNG });
  expect(r.refused, '전환 중엔 거절(false)').toBe(false);
  expect(r.mid.p1, '★떠난 p1 의 장').toEqual(['sp_asset', 'sp_img']);
  expect(r.mid.p2, '★새 p2 의 장').toEqual(['sp_p2']);
  expect(r.mid.screen, '화면 = p2 장').toEqual(['sp_p2']);
  expect(r.after, '전환 끝난 뒤 비우기 = p2 만').toEqual({ p1: ['sp_asset', 'sp_img'], p2: [] });
  expect(errs.filter((e) => !/clearScratchPad 거절/.test(e))).toEqual([]);
});
