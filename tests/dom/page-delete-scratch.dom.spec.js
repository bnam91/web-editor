/* page-delete-scratch — 보고 있는 페이지를 지우면 스크래치 층도 남을 페이지로 옮긴다 (PAGE-DELETE-SCRATCH-STAYS-ON-DELETED-PAGE-01)
 * 왜: deletePage 가 switchScratchPage 를 안 불러, 층이 지운 페이지 키에 남았다. 그 뒤 넣은 이미지는 지운 키로 저장돼 다시 열면 없다(앱 ×3 · 3/3).
 * 칸: D1 둘에서 지움 · D2 셋의 가운데 · D3 [음성] 안 보는 페이지 지움 = 층 안 움직임 · D4 저장 거부 = 아무것도 안 바뀌고 알림 · D5 기다리는 사이 다른 페이지 ✕ = 마지막 한 장 지킴.
 * 변이(잰 값): 고침 전체 되돌림 또는 호출만 빼면 D1·D2·D4·D5 빨강 · D3 초록 | busy 검사만 빼면 D5 빨강 | 억제 해제만 빼면 D4 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

/* 페이지 n 장을 만들고 장마다 이미지 하나(OLD0·OLD1…) — 끝나면 마지막 페이지를 보고 있다. */
async function setup(page, n) {
  const errs = await bootApp(page);
  const ids = await page.evaluate(async ([src, n]) => {
    window.confirm = () => true;
    await window.initScratchPad('proj_pds', window.state.currentPageId);
    const ids = [window.state.currentPageId];
    await window._scratchAddAndSave(src, 960, 100, 200, undefined, 'OLD0');
    for (let i = 1; i < n; i++) {
      const id = 'page_pds' + i;
      window.state.pages.push({ id, name: 'P' + i, label: '', pageSettings: { ...window.state.pageSettings }, canvas: '' });
      await window.switchPage(id);
      await window._scratchAddAndSave(src, 960, 100, 200, undefined, 'OLD' + i);
      ids.push(id);
    }
    return ids;
  }, [PNG, n]);
  return { errs, ids };
}
const items = (page) => page.evaluate(() => [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchId));
const add = (page, id) => page.evaluate(([src, id]) => window._scratchAddAndSave(src, 960, 400, 200, undefined, id), [PNG, id]);
const goto = (page, id) => page.evaluate((id) => window.switchPage(id), id);

test('D1 둘 중 보고 있는 페이지를 지운다 — 남은 페이지의 이미지가 보이고, 새 이미지가 그 페이지에 남는다', async ({ page }) => {
  const { errs, ids } = await setup(page, 2);
  await page.evaluate((id) => window.deletePage(id), ids[1]);
  expect(await page.evaluate(() => window.state.currentPageId), '[전제] 남은 페이지로 왔다').toBe(ids[0]);
  expect(await items(page), '★남은 페이지의 이미지가 안 보인다').toEqual(['OLD0']);
  await add(page, 'NEW');
  // 다시 읽기: 다른 페이지를 다녀와 디스크(IndexedDB)에서 읽는다
  await page.evaluate(async () => { window.state.pages.push({ id: 'page_pds_x', name: 'X', label: '', pageSettings: { ...window.state.pageSettings }, canvas: '' }); await window.switchPage('page_pds_x'); });
  expect(await items(page), '[전제] 옆 페이지는 비었다').toEqual([]);
  await goto(page, ids[0]);
  expect(await items(page), '★새 이미지가 이 페이지에 안 남았다').toEqual(['OLD0', 'NEW']);
  expect(errs).toEqual([]);
});

test('D2 셋의 가운데를 지운다 — 뒤 페이지 이미지가 보이고, 지운 페이지 이미지가 섞이지 않는다', async ({ page }) => {
  const { errs, ids } = await setup(page, 3);
  await goto(page, ids[1]);
  await page.evaluate((id) => window.deletePage(id), ids[1]);
  expect(await page.evaluate(() => window.state.currentPageId), '[전제] 뒤 페이지로 왔다').toBe(ids[2]);
  expect(await items(page), '★지운 페이지의 이미지가 보인다').toEqual(['OLD2']);
  await add(page, 'NEW');
  await goto(page, ids[0]);
  expect(await items(page)).toEqual(['OLD0']);
  await goto(page, ids[2]);
  expect(await items(page), '★새 이미지가 이 페이지에 안 남았다').toEqual(['OLD2', 'NEW']);
  expect(errs).toEqual([]);
});

test('D3 [음성] 안 보는 페이지를 지운다 — 스크래치 층이 그대로다', async ({ page }) => {
  const { errs, ids } = await setup(page, 3);
  await page.evaluate((id) => window.deletePage(id), ids[0]);
  expect(await page.evaluate(() => window.state.pages.map((p) => p.id))).toEqual([ids[1], ids[2]]);
  expect(await page.evaluate(() => window.state.currentPageId)).toBe(ids[2]);
  expect(await items(page)).toEqual(['OLD2']);
  expect(errs).toEqual([]);
});

test('D4 스크래치 저장이 거부되면 — 페이지도 층도 그대로고, 알리고, 자동저장이 안 묶인다', async ({ page }) => {
  const { errs, ids } = await setup(page, 2);
  const r = await page.evaluate(async (id) => {
    const toasts = []; const oldToast = window.showToast; window.showToast = (m) => { toasts.push(String(m)); };
    // 진짜 _saveScratch 를 거부시킨다 — readwrite 트랜잭션만 막으면 그 Promise 가 거부된다
    const oldTx = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (s, mode, ...a) { if (mode === 'readwrite') throw new DOMException('거부', 'QuotaExceededError'); return oldTx.call(this, s, mode, ...a); };
    await window.deletePage(id);
    IDBDatabase.prototype.transaction = oldTx; window.showToast = oldToast;
    return { toasts, pages: window.state.pages.map((p) => p.id), cur: window.state.currentPageId, held: window.AutoSaveSuppress.inspect().holders.map((x) => x.reason) };
  }, ids[1]);
  expect(r.pages, '★거부됐는데 페이지를 지웠다').toEqual(ids);
  expect(r.cur).toBe(ids[1]);
  expect(await items(page)).toEqual(['OLD1']);
  expect(r.toasts.join(' '), '★거부를 안 알렸다').toContain('지우지 않았습니다');
  expect(r.held, '★자동저장 억제가 남았다').not.toContain('page-delete-scratch');
  expect(errs).toEqual([]);
});

test('D5 기다리는 사이 다른 페이지 ✕ 를 눌러도 — 마지막 한 장이 안 사라진다', async ({ page }) => {
  const { errs, ids } = await setup(page, 2);
  await page.evaluate(async ([a, b]) => { await Promise.all([window.deletePage(a), window.deletePage(b)]); }, [ids[1], ids[0]]);
  expect(await page.evaluate(() => window.state.pages.map((p) => p.id)), '★페이지가 틀리게 지워졌다').toEqual([ids[0]]);
  expect(await page.evaluate(() => window.state.currentPageId)).toBe(ids[0]);
  expect(await items(page)).toEqual(['OLD0']);
  expect(errs).toEqual([]);
});
