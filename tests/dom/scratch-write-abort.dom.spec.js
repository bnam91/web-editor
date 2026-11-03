/* scratch-write-abort — 스크래치 쓰기 tx 가 커밋에서 abort(quota 꼴)로 끝날 때. 진짜 quota 를 채우지 않고 요청 성공 뒤 tx.abort 로 흉내 낸다, error 이벤트 없이 abort 만 난다.
 * 자: promise 가 끝나나 · 항목 id · saveProject 호출 · 토스트. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const S = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
async function ready(page) {
  await bootApp(page);
  await page.evaluate(async () => {
    window.__armed = false; window.__toasts = []; const o = window.showToast; window.showToast = (t, ...a) => { window.__toasts.push(String(t)); return o?.(t, ...a); };
    window.addEventListener('unhandledrejection', (e) => e.preventDefault());
    const ot = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (a, m, ...r) { const t = ot.call(this, a, m, ...r); if (m === 'readwrite' && window.__armed) { const os = t.objectStore.bind(t); t.objectStore = (n) => { const st = os(n); for (const f of ['put', 'delete']) { const op = st[f].bind(st); st[f] = (...x) => { const q = op(...x); q.addEventListener('success', () => { try { t.abort(); } catch (_) {} }); return q; }; } return st; }; } return t; };
    window.__settle = async (p) => { let st = '대기'; Promise.resolve(p).then(() => { st = '끝'; }, () => { st = '거절'; }); for (let i = 0; i < 40 && st === '대기'; i++) await new Promise((r) => setTimeout(r, 50)); return st; };
    await window.switchScratch('proj_1', 'p1');
  });
}
const on = (page) => page.evaluate(() => { window.__armed = true; });
const off = (page) => page.evaluate(() => { window.__armed = false; });
const items = (page) => page.evaluate(() => [...document.querySelectorAll('.scratch-item')].map((e) => e.dataset.scratchId).sort());

test('외부화 쓰기가 abort 나도 멈추지 않는다, 매니페스트는 남는다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await page.evaluate(() => { Object.defineProperty(window, 'electronAPI', { value: { assetsSaveCanvasImage: async () => ({ ok: true, url: 'goya-asset://proj_1/s.png' }) }, configurable: true, writable: true }); });
  await on(page);
  const r = await page.evaluate(async () => { const proj = { pages: [{ id: 'p1' }] }; const st = await window.__settle(window.externalizeScratchpad(proj, 'proj_1')); return { st, src: proj.pages[0].scratchpad?.[0]?.src }; });
  expect(r).toEqual({ st: '끝', src: 'goya-asset://proj_1/s.png' });
});
test('flush 쓰기가 실패해도 그 키를 다시 열면 항목이 돌아온다, 멈추지 않는다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await on(page);
  expect(await page.evaluate((S) => window.__settle(window._scratchAddAndSave(S, 10, 90, 50, null, 's_2')), S)).toBe('거절');
  expect(await page.evaluate(() => window.__settle(window.flushScratchForSwitch()))).toBe('거절');
  await off(page);
  expect(await items(page)).toEqual([]);
  await page.evaluate(() => window.switchScratch('proj_1', 'p1'));
  await expect.poll(() => items(page)).toEqual(['s_1', 's_2']);
  await expect.poll(() => page.evaluate(async () => (await window._scratchExportAll('proj_1', ['p1'])).flatMap((b) => b.items.map((i) => i.id)).sort())).toEqual(['s_1', 's_2']);
});
test('음성: flush 쓰기가 성공하면 되살릴 것이 없다, 다른 키에 안 샌다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await page.evaluate(() => window.flushScratchForSwitch());
  await page.evaluate(() => window.switchScratch('proj_2', 'p1'));
  await expect.poll(() => items(page)).toEqual([]);
  await page.evaluate(() => window.switchScratch('proj_1', 'p1'));
  await expect.poll(() => items(page)).toEqual(['s_1']);
});
test('clearScratchPad 쓰기가 abort 나면 멈추지 않고 거절한다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await on(page);
  expect(await page.evaluate(() => window.__settle(window.clearScratchPad()))).toBe('거절');
});
const WARN = '⚠️ 스크래치를 저장하지 못했습니다. 지금 보이는 이미지가 다시 열면 없을 수 있습니다.';
test('공용 알림: 말없던 자리(안 기다리는 저장 포함)에서 알리고, 연달아 실패해도 한 번이다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  await on(page);
  await page.evaluate(() => window._scratchSaveSoon(0));
  await expect.poll(() => page.evaluate(() => window.__toasts)).toEqual([WARN]);
  await page.evaluate((S) => window.__settle(window._scratchAddAndSave(S, 10, 90, 50, null, 's_2')), S);
  expect(await page.evaluate(() => window.__toasts)).toEqual([WARN]);
});
test('음성 공용 알림: 저장이 되면 안 알린다, 넣기 실패는 부르는 쪽 말에 맡긴다', async ({ page }) => {
  await ready(page);
  await page.evaluate((S) => window._scratchAddAndSave(S, 10, 10, 50, null, 's_1'), S);
  expect(await page.evaluate(() => window.__toasts)).toEqual([]);
  await on(page);
  expect(await page.evaluate((S) => window.__settle(window._scratchImportAll('proj_3', [{ pageId: 'p1', items: [{ id: 'x', src: S, x: 1, y: 1, w: 1 }] }])), S)).toBe('거절');
  expect(await page.evaluate(() => window.__toasts)).toEqual([]);
});
