/* undo-to-empty-save — ⌘Z 로 빈 캔버스에 돌아오면 저장한다(리뷰 ②). 건너뛰면 다시 열 때 섹션이 살아난다.
 * 변이: __noteRestoredCanvas 를 끄면 E1 빨강. N1·N2·N3 [음성] S11 보호는 그대로. */
const { test, expect } = require('@playwright/test');
const { bootApp, ORIGIN } = require('./_root-harness.js');
const clean = (p) => p.waitForFunction(() => !window.hasUnsavedChanges(), null, { timeout: 15000 });
const inSave = (p, id) => p.evaluate((id) => Object.keys(localStorage).some((x) => x.startsWith('web-editor-autosave') && !x.endsWith('_ts') && (localStorage.getItem(x) || '').includes(id)), id);
const past = async (p, ms) => { const t = await p.evaluate(() => performance.now()); await p.waitForFunction(([t, m]) => performance.now() - t > m, [t, ms]); };
async function open(page) {
  await bootApp(page);
  await page.goto(`${ORIGIN}/index.html?project=proj_1700000000192`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && document.readyState === 'complete', null, { timeout: 20000 });
  await page.evaluate(() => { document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove()); window.clearHistory?.(); });
  const id = await page.evaluate(() => { window.pushHistory('e'); window.addSection(); return document.querySelector('#canvas .section-block').id; });
  await expect.poll(() => inSave(page, id), { message: '전제', timeout: 15000 }).toBe(true);
  await clean(page);
  return id;
}
const empty = (p) => p.evaluate(() => !document.querySelector('#canvas .section-block'));

test('E1 ⌘Z 로 빈 캔버스 — 저장본에서 섹션이 빠진다', async ({ page }) => {
  const id = await open(page);
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await page.waitForFunction(() => !document.querySelector('#canvas .section-block'));
  await expect.poll(() => inSave(page, id), { message: '★빈 캔버스가 저장 안 돼 다시 열면 섹션이 살아난다', timeout: 15000 }).toBe(false);
  await clean(page);
});
test('N1 [음성] ⌘Z 없이 DOM 이 비면 저장을 건너뛴다(S11)', async ({ page }) => {
  const id = await open(page);
  await page.evaluate(() => { document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove()); window.scheduleAutoSave(); });
  await past(page, 2500);
  expect(await inSave(page, id)).toBe(true);
});
test('N2 [음성] ⌘Z 로 빈 뒤 다시 채웠다 비면 표식이 풀려 건너뛴다', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { window.undo(); });
  await page.waitForFunction(() => !document.querySelector('#canvas .section-block'));
  await clean(page);
  const id2 = await page.evaluate(() => { window.addSection(); return document.querySelector('#canvas .section-block').id; });
  await expect.poll(() => inSave(page, id2), { timeout: 15000 }).toBe(true);
  await clean(page);
  await page.evaluate(() => { document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove()); window.scheduleAutoSave(); });
  await past(page, 2500);
  expect(await inSave(page, id2)).toBe(true);
});
test('N3 [음성] ⌘Z 로 빈 뒤 로드가 끼면 표식이 풀린다', async ({ page }) => {
  const id = await open(page);
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); window.undo(); window.applyProjectData(d); document.querySelectorAll('#canvas .section-block').forEach((s) => s.remove()); });
  await past(page, 2500);
  expect(await inSave(page, id)).toBe(true);
});
