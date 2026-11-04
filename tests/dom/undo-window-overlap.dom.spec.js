/* undo-window-overlap — ⌘Z 직후 rAF 전에 억제 창이 열려도 플래그가 굳지 않는다(리뷰 ③).
 * 변이: restoreSnapshot·restoreSnapshotScoped 의 clearOuter 를 빼면 Q1·Q2 빨강. N1 [음성] 봉인은 안 풀린다. */
const { test, expect } = require('@playwright/test');
const { bootApp, ORIGIN } = require('./_root-harness.js');
const clean = (p) => p.waitForFunction(() => !window.hasUnsavedChanges(), null, { timeout: 15000 });
const inSave = (p, id) => p.evaluate((id) => Object.keys(localStorage).some((x) => x.startsWith('web-editor-autosave') && !x.endsWith('_ts') && (localStorage.getItem(x) || '').includes(id)), id);
const addSec = (p) => p.evaluate(() => { const b = new Set([...document.querySelectorAll('#canvas .section-block')].map((s) => s.id)); window.pushHistory('w'); window.addSection(); return [...document.querySelectorAll('#canvas .section-block')].map((s) => s.id).find((x) => !b.has(x)); });
async function open(page) {
  await bootApp(page);
  await page.goto(`${ORIGIN}/index.html?project=proj_1700000000191`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && document.readyState === 'complete', null, { timeout: 20000 });
  await page.evaluate(() => { document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove()); window.addSection(); window.clearHistory?.(); });
  await clean(page);
  const id = await addSec(page);
  await expect.poll(() => inSave(page, id), { timeout: 15000 }).toBe(true);
  await clean(page);
  return id;
}
/* 복원 → (rAF 전) 창 열기 → rAF 지남 → 창 닫기 */
const overlap = (page, fn) => page.evaluate((fn) => new Promise((res) => { window[fn](); const t = window.AutoSaveSuppress.begin('page-switch'); requestAnimationFrame(() => requestAnimationFrame(() => { window.AutoSaveSuppress.end(t); res(window.state._suppressAutoSave); })); }), fn);

test('Q1 ⌘Z 뒤 창이 겹쳐도 플래그가 안 굳고 그 뒤 편집이 저장된다', async ({ page }) => {
  await open(page);
  expect(await overlap(page, 'undo'), '★창이 닫힌 뒤 억제가 굳었다').toBe(false);
  const id2 = await addSec(page);
  await expect.poll(() => inSave(page, id2), { message: '★그 뒤 편집이 저장본에 안 들었다', timeout: 15000 }).toBe(true);
});
test('Q2 ⌘⇧Z 도 같다', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.undo());
  await page.waitForFunction(() => window.state._suppressAutoSave === false);
  expect(await overlap(page, 'redo')).toBe(false);
});
test('Q3 진짜 페이지 전환이 겹쳐도 ⌘Z 결과가 저장된다', async ({ page }) => {
  const id = await open(page);
  const pid = await page.evaluate(async () => { const a = window.state.currentPageId; window.addPage(); return a; });
  await page.waitForFunction((a) => window.state.currentPageId !== a && !window.AutoSaveSuppress.inspect().holders.length, pid);
  await page.evaluate((a) => window.switchPage(a), pid);
  await page.waitForFunction((a) => window.state.currentPageId === a && !window.AutoSaveSuppress.inspect().holders.length, pid);
  const other = await page.evaluate((a) => window.state.pages.find((p) => p.id !== a).id, pid);
  await page.evaluate(([a, o]) => { window.undo(); window.switchPage(o); }, [pid, other]);
  await page.waitForFunction((o) => window.state.currentPageId === o && !window.AutoSaveSuppress.inspect().holders.length, other);
  await page.waitForFunction(() => window.state._suppressAutoSave === false, null, { timeout: 5000 });
  await expect.poll(() => inSave(page, id), { message: '★⌘Z 결과가 저장본에 안 들었다', timeout: 15000 }).toBe(false);
});
test('N1 [음성] 복원의 rAF 가 봉인을 안 푼다', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => new Promise((res) => { const t = window.AutoSaveSuppress.begin('reload-seal'); window.undo(); requestAnimationFrame(() => requestAnimationFrame(() => { const held = window.state._suppressAutoSave; window.AutoSaveSuppress.end(t); res(held); })); }));
  expect(r).toBe(true);
});
