/* scratch-db-open-fail — SCRATCH-DB-OPEN-FAIL-RECOVERY-WIPES-ALL-01: 스크래치 저장소(IndexedDB ScratchPadDB)를 못 열어도 «통째 지우기»를 안 한다
 *   옛: 열기 실패 → indexedDB.deleteDatabase(ScratchPadDB) 로 모든 프로젝트·페이지 스크래치를 지우고 다시 열었다 · 막힘으로 거절한 뒤 늦게 열리면 _db 를 새 빈 연결로 갈았다.
 *   D1 열기 실패 → deleteDatabase 0 · 메모리 폴백으로 넣은 장이 화면에 있고 저장(외부화) 매니페스트에 실린다 · 토스트 1번
 *   D2 막힘 → 폴백 → 늦게 열림(onsuccess) → _db 는 폴백 그대로(폴백에 넣은 장이 읽힌다) · 늦은 연결은 닫힌다
 *   D3 _scratchAddAndSave 결과: 정상 { ok:true, id } · 프로젝트 없음 { ok:false, reason:'no-context' }
 * ★양성대조: js/scratch-pad.js 를 기준판(f5e4970d9)으로 되돌리면 D1(deleteDatabase 1)·D2(늦은 연결로 갈림)·D3 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==';

/* mode: 'fail' = ScratchPadDB 열기 onerror · 'blockedLate' = onblocked 뒤 300ms 에 진짜 열기 결과로 onsuccess */
async function stubIDB(page, mode) {
  await page.addInitScript((mode) => {
    window.__idb = { del: 0, opens: 0, lateClosed: 0 };
    const realOpen = indexedDB.open.bind(indexedDB), realDel = indexedDB.deleteDatabase.bind(indexedDB);
    indexedDB.deleteDatabase = (n) => { if (n === 'ScratchPadDB') window.__idb.del++; return realDel(n); };
    indexedDB.open = (n, v) => {
      if (n !== 'ScratchPadDB') return realOpen(n, v);
      window.__idb.opens++;
      const req = {}; 
      if (mode === 'fail') setTimeout(() => req.onerror?.({ target: { error: new Error('stub open fail') } }));
      if (mode === 'blockedLate') {
        setTimeout(() => req.onblocked?.());
        const r = realOpen(n, v);
        r.onupgradeneeded = (e) => { try { e.target.result.createObjectStore('scratch'); } catch (_) {} };
        r.onsuccess = (e) => setTimeout(() => { const db = e.target.result; const c = db.close.bind(db); db.close = () => { window.__idb.lateClosed++; c(); }; window.__lateDb = db; req.onsuccess?.({ target: { result: db } }); }, 300);
      }
      return req;
    };
  }, mode);
}
async function setup(page, mode) {
  await stubIDB(page, mode);
  const errs = await bootApp(page);
  await page.evaluate(() => {
    window.__toasts = []; const o = window.showToast; window.showToast = (m) => { window.__toasts.push(String(m)); try { o?.(m); } catch (_) {} };
    let n = 0;
    window.electronAPI = { assetsSaveCanvasImage: async ({ projectId, mime }) => ({ ok: true, url: `goya-asset://${projectId}/h${++n}.${mime.split('/')[1]}` }) };
    window.state.pages = [{ id: 'p1' }];
    window.__save = async () => { const proj = { pages: [{ id: 'p1' }] }; await window.externalizeScratchpad(proj, 'proj_d'); return (proj.pages[0].scratchpad || null); };
  });
  return errs;
}

test('D1 열기 실패 → 통째 지우기 0 · 폴백 장이 화면·저장 매니페스트에 · 토스트 1번', async ({ page }) => {
  const errs = await setup(page, 'fail');
  const r = await page.evaluate(async (PNG) => { await window.switchScratch('proj_d', 'p1'); return window._scratchAddAndSave(PNG, 700, 200, 300, undefined, 'sp_d'); }, PNG);
  expect(await page.evaluate(() => window.__idb.opens), '[전제] 스크래치 저장소 열기를 시도했다').toBeGreaterThan(0);
  expect(await page.evaluate(() => window.__idb.del), '★ScratchPadDB 를 통째 지웠다').toBe(0);
  expect(r).toEqual({ ok: true, id: 'sp_d' });
  expect(await page.evaluate(() => !!document.querySelector('.scratch-item[data-scratch-id="sp_d"]'))).toBe(true);
  expect((await page.evaluate(() => window.__save())).map(i => i.id), '★폴백 장이 파일 매니페스트에 안 실렸다').toEqual(['sp_d']);
  expect(await page.evaluate(() => window.__toasts.filter(t => /스크래치 저장소를 열지 못했습니다/.test(t)).length), '토스트 1번').toBe(1);
  expect(errs).toEqual([]);
});

test('D2 막힘 → 폴백 → 늦게 열려도 _db 는 폴백 그대로 · 늦은 연결은 닫힌다', async ({ page }) => {
  const errs = await setup(page, 'blockedLate');
  await page.evaluate(async (PNG) => { await window.switchScratch('proj_d', 'p1'); await window._scratchAddAndSave(PNG, 700, 200, 300, undefined, 'sp_late'); }, PNG);
  await page.waitForFunction(() => !!window.__lateDb, null, { timeout: 5000 });
  await expect.poll(() => page.evaluate(() => window.__idb.lateClosed), { message: '★늦은 연결을 안 닫았다' }).toBeGreaterThan(0);
  expect((await page.evaluate(() => window.__save())).map(i => i.id), '★늦은 빈 연결로 갈려 폴백 장을 잃었다').toEqual(['sp_late']);
  expect(await page.evaluate(() => window.__idb.del)).toBe(0);
  expect(errs).toEqual([]);
});

test('D3 _scratchAddAndSave 결과 — 정상 ok · 프로젝트 없음 no-context', async ({ page }) => {
  await bootApp(page);
  const r = await page.evaluate(async (PNG) => {
    await window.switchScratch(null, null);
    const a = await window._scratchAddAndSave(PNG, 700, 200, 300, undefined, 'sp_n');
    await window.switchScratch('proj_d3', 'p1');
    const b = await window._scratchAddAndSave(PNG, 700, 300, 300, undefined, 'sp_y');
    return { a, b };
  }, PNG);
  expect(r.a).toEqual({ ok: false, reason: 'no-context', id: 'sp_n' });
  expect(r.b).toEqual({ ok: true, id: 'sp_y' });
});
