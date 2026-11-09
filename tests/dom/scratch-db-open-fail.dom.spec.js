/* scratch-db-open-fail — SCRATCH-DB-OPEN-FAIL-RECOVERY-WIPES-ALL-01: 스크래치 저장소(IndexedDB ScratchPadDB)를 못 열어도 «통째 지우기»를 안 한다
 *   옛: 열기 실패 → indexedDB.deleteDatabase(ScratchPadDB) 로 모든 프로젝트·페이지 스크래치를 지우고 다시 열었다 · 막힘으로 거절한 뒤 늦게 열리면 _db 를 새 빈 연결로 갈았다.
 *   D1 열기 실패 → deleteDatabase 0 · 메모리 폴백으로 넣은 장이 화면에 있고 저장(외부화) 매니페스트에 실린다 · 토스트 1번
 *   D2 막힘 → 폴백 → 늦게 열림(onsuccess) → _db 는 폴백 그대로(폴백에 넣은 장이 읽힌다) · 늦은 연결은 닫힌다
 *   D3 _scratchAddAndSave 결과: 정상 { ok:true, id } · 프로젝트 없음 { ok:false, reason:'no-context' } (폴백이면 D1: 'memory-only')
 *   D4 (적대 리뷰 1) 지난 폴백 세션이 매니페스트로만 남긴 키 → 다음 진짜 로드는 옛 DB 값 대신 매니페스트(그 세션 편집)를 쓰고 DB 에 적은 뒤 표식을 지운다
 *      D1 은 폴백 외부화가 그 표식을 남기는지도 잰다 · 양성대조: 표식 갈래를 빼면 D4 빨강(옛 DB [A] 가 이김)
 *   D5 (리뷰 2 #1) DB 가 매니페스트보다 새 것(DB [A,B] · 매니페스트 [A] · 표식) → 합침 = [A,B](B 를 안 잃음)
 *   D6 (리뷰 2 #2) 안 가 본 표식 페이지 p2 — 진짜 DB 에서 외부화해도 p2 매니페스트 [A,B] 를 옛 DB [A] 로 안 덮는다
 *   D7 (리뷰 3 #1) 합쳐 읽은 뒤 첫 저장이 실패해도 다음 성공 저장에서 표식을 지운다 → 외부화가 그 페이지 새 장을 매니페스트에 싣는다
 *   D8 (리뷰 3 #2) 열린 프로젝트가 아닌 L 내보내기 — 넘긴 pages(L 의 매니페스트)로 합친다
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
  expect(r, '폴백 = 메모리에만').toEqual({ ok: false, reason: 'memory-only', id: 'sp_d' });
  expect(await page.evaluate(() => !!document.querySelector('.scratch-item[data-scratch-id="sp_d"]'))).toBe(true);
  expect((await page.evaluate(() => window.__save())).map(i => i.id), '★폴백 장이 파일 매니페스트에 안 실렸다').toEqual(['sp_d']);
  expect(await page.evaluate(() => window.__toasts.filter(t => /스크래치 저장소를 열지 못했습니다/.test(t)).length), '토스트 1번').toBe(1);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('scratch-manifest-wins') || '[]')), '★폴백 외부화가 «매니페스트가 이긴다» 표식을 안 남겼다').toEqual(['scratch-pad-proj_d-p1']);
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

test('D4 지난 폴백 세션의 매니페스트가 다음 진짜 로드에서 옛 DB 값을 이긴다 · DB 에 적고 표식을 지운다', async ({ page }) => {
  const errs = await bootApp(page);
  const r = await page.evaluate(async (PNG) => {
    const K = 'scratch-pad-proj_d4-p1';
    const A = { id: 'sp_a', src: PNG, x: 700, y: 200, w: 300 }, B = { id: 'sp_b', src: PNG, x: 700, y: 600, w: 300 };
    // 진짜 DB 에 «폴백 세션 전» 값 [A] — 폴백 세션은 이 DB 를 안 건드렸다
    await new Promise((res, rej) => { const q = indexedDB.open('ScratchPadDB', 1); q.onupgradeneeded = e => { try { e.target.result.createObjectStore('scratch'); } catch (_) {} };
      q.onsuccess = e => { const db = e.target.result; const tx = db.transaction('scratch', 'readwrite'); tx.objectStore('scratch').put([A], K); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = rej; }; q.onerror = rej; });
    // 폴백 세션이 남긴 것: 파일 매니페스트 [A,B] + 표식
    localStorage.setItem('scratch-manifest-wins', JSON.stringify([K]));
    window.state.pages = [{ id: 'p1', scratchpad: [A, B] }];
    await window.initScratchPad('proj_d4', 'p1');
    const shown = [...document.querySelectorAll('.scratch-item')].map(e => e.dataset.scratchId).sort();
    await new Promise(res => setTimeout(res, 300));
    const inDb = await new Promise((res) => { const q = indexedDB.open('ScratchPadDB', 1); q.onsuccess = e => { const db = e.target.result; const g = db.transaction('scratch').objectStore('scratch').get(K); g.onsuccess = () => { res((g.result || []).map(i => i.id).sort()); db.close(); }; }; });
    return { shown, inDb, mark: JSON.parse(localStorage.getItem('scratch-manifest-wins') || '[]') };
  }, PNG);
  expect(r.shown, '★옛 DB [A] 가 이겨 폴백 세션의 B 를 잃었다').toEqual(['sp_a', 'sp_b']);
  expect(r.inDb, 'DB 에도 적혔다').toEqual(['sp_a', 'sp_b']);
  expect(r.mark, '적은 뒤 표식을 지웠다').toEqual([]);
  expect(errs).toEqual([]);
});

async function putIdb(page, K, items) {
  await page.evaluate(async ([K, items]) => { await new Promise((res, rej) => { const q = indexedDB.open('ScratchPadDB', 1); q.onupgradeneeded = e => { try { e.target.result.createObjectStore('scratch'); } catch (_) {} };
    q.onsuccess = e => { const db = e.target.result; const tx = db.transaction('scratch', 'readwrite'); tx.objectStore('scratch').put(items, K); tx.oncomplete = () => { db.close(); res(); }; tx.onerror = rej; }; q.onerror = rej; }); }, [K, items]);
}
test('D5 DB 가 매니페스트보다 새 것이면 합친다 — 표식이 DB 에만 있는 장을 안 지운다', async ({ page }) => {
  const errs = await bootApp(page);
  const A = { id: 'sp_a', src: PNG, x: 700, y: 200, w: 300 }, B = { id: 'sp_b', src: PNG, x: 700, y: 600, w: 300 };
  await putIdb(page, 'scratch-pad-proj_d5-p1', [A, B]);
  const shown = await page.evaluate(async ([A]) => { localStorage.setItem('scratch-manifest-wins', JSON.stringify(['scratch-pad-proj_d5-p1'])); window.state.pages = [{ id: 'p1', scratchpad: [A] }];
    await window.initScratchPad('proj_d5', 'p1'); return [...document.querySelectorAll('.scratch-item')].map(e => e.dataset.scratchId).sort(); }, [A]);
  expect(shown, '★표식이 DB 에만 있던 B 를 지웠다').toEqual(['sp_a', 'sp_b']);
  expect(errs).toEqual([]);
});
test('D6 안 가 본 표식 페이지 — 진짜 DB 에서 외부화해도 그 매니페스트를 옛 DB 값으로 안 덮는다', async ({ page }) => {
  const errs = await bootApp(page);
  const A = { id: 'sp_a', src: 'goya-asset://proj_d6/a.png', x: 700, y: 200, w: 300 }, B = { id: 'sp_b', src: 'goya-asset://proj_d6/b.png', x: 700, y: 600, w: 300 };
  await putIdb(page, 'scratch-pad-proj_d6-p2', [A]);
  const m = await page.evaluate(async ([A, B]) => {
    window.electronAPI = { assetsSaveCanvasImage: async () => ({ ok: true, url: 'goya-asset://proj_d6/x.png' }) };
    localStorage.setItem('scratch-manifest-wins', JSON.stringify(['scratch-pad-proj_d6-p2']));
    window.state.pages = [{ id: 'p1' }, { id: 'p2', scratchpad: [A, B] }];
    await window.initScratchPad('proj_d6', 'p1');
    const proj = { pages: [{ id: 'p1' }, { id: 'p2', scratchpad: [A, B] }] };
    await window.externalizeScratchpad(proj, 'proj_d6');
    return proj.pages[1].scratchpad.map(i => i.id).sort();
  }, [A, B]);
  expect(m, '★옛 DB [A] 로 매니페스트 [A,B] 를 덮었다').toEqual(['sp_a', 'sp_b']);
  expect(errs).toEqual([]);
});

test('D7 합친 뒤 첫 저장이 실패해도 다음 성공 저장에서 표식이 지워지고 외부화가 새 장을 싣는다', async ({ page }) => {
  const errs = await bootApp(page);
  const A = { id: 'sp_a', src: 'goya-asset://proj_d7/a.png', x: 700, y: 200, w: 300 }, B = { id: 'sp_b', src: 'goya-asset://proj_d7/b.png', x: 700, y: 600, w: 300 };
  await putIdb(page, 'scratch-pad-proj_d7-p1', [A]);
  const r = await page.evaluate(async ([A, B, PNG]) => {
    window.electronAPI = { assetsSaveCanvasImage: async () => ({ ok: true, url: 'goya-asset://proj_d7/c.png' }) };
    localStorage.setItem('scratch-manifest-wins', JSON.stringify(['scratch-pad-proj_d7-p1']));
    window.state.pages = [{ id: 'p1', scratchpad: [A, B] }];
    const put = IDBObjectStore.prototype.put; let once = true;
    IDBObjectStore.prototype.put = function (...a) { if (once && this.name === 'scratch') { once = false; throw new DOMException('stub abort', 'AbortError'); } return put.apply(this, a); };
    await window.initScratchPad('proj_d7', 'p1');
    await new Promise(res => setTimeout(res, 200));
    const markAfterFail = JSON.parse(localStorage.getItem('scratch-manifest-wins') || '[]');
    await window._scratchAddAndSave(PNG, 700, 900, 300, undefined, 'sp_c');
    const markAfterOk = JSON.parse(localStorage.getItem('scratch-manifest-wins') || '[]');
    const proj = { pages: [{ id: 'p1', scratchpad: [A, B] }] };
    await window.externalizeScratchpad(proj, 'proj_d7');
    return { once, markAfterFail, markAfterOk, m: (proj.pages[0].scratchpad || []).map(i => i.id).sort() };
  }, [A, B, PNG]);
  expect(r.once, '[전제] 첫 쓰기가 실패했다').toBe(false);
  expect(r.markAfterFail, '[전제] 실패한 뒤엔 표식이 남는다').toEqual(['scratch-pad-proj_d7-p1']);
  expect(r.markAfterOk, '★다음 성공 저장에도 표식이 안 지워졌다').toEqual([]);
  expect(r.m, '★외부화가 그 페이지를 건너뛰어 새 장 C 가 매니페스트에 없다').toEqual(['sp_a', 'sp_b', 'sp_c']);
  errs.length = 0;   // 일부러 낸 쓰기 실패 경고
});
test('D8 열린 프로젝트가 아닌 L 의 표식 페이지 내보내기 — 넘긴 pages 매니페스트로 합친다', async ({ page }) => {
  await bootApp(page);
  const A = { id: 'sp_a', src: 'goya-asset://L/a.png', x: 1, y: 1, w: 300 }, B = { id: 'sp_b', src: 'goya-asset://L/b.png', x: 1, y: 400, w: 300 };
  await putIdb(page, 'scratch-pad-proj_L-p1', [A]);
  const out = await page.evaluate(async ([A, B]) => {
    localStorage.setItem('scratch-manifest-wins', JSON.stringify(['scratch-pad-proj_L-p1']));
    window.state.pages = [{ id: 'p1', scratchpad: [] }];   // 열린 것은 다른 프로젝트
    const r = await window._scratchExportAll('proj_L', ['p1'], [{ id: 'p1', scratchpad: [A, B] }]);
    return r.map(x => ({ pageId: x.pageId, ids: x.items.map(i => i.id).sort() }));
  }, [A, B]);
  expect(out, '★L 의 매니페스트 대신 열린 프로젝트 pages 로 합쳤다').toEqual([{ pageId: 'p1', ids: ['sp_a', 'sp_b'] }]);
});
