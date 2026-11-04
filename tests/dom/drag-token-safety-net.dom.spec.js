/* drag-token-safety-net — 끌기 창이 dragend 없이 남아도 다음 손짓에 닫힌다(리뷰 ① · 자동저장이 조용히 멈추는 자리).
 * 값: 끌기 중 ⌘Z 는 keydown 자체가 안 온다(K0). 끌던 줄이 다시 그려져도 그 요소에 dragend 가 와 닫힌다(K1).
 *     그래도 dragend 가 안 오는 때를 대비한다: 합성 dragstart 로 창만 연 꼴(T1).
 * 변이: endOnNextGesture 를 끄면 T1·T2 빨강 · K0·K1·N1 초록. */
const { test, expect } = require('@playwright/test');
const { bootApp, ORIGIN } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const held = (p) => p.evaluate(() => window.AutoSaveSuppress.inspect().holders.map((h) => h.reason));
async function open(page) {
  await bootApp(page);
  await page.goto(`${ORIGIN}/index.html?project=proj_1700000000190`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && document.readyState === 'complete', null, { timeout: 20000 });
  await page.evaluate(() => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); window.addSection(); window.addSection(); window.addSection(); window.clearHistory?.(); window.pushHistory?.('e'); window.addSection(); window.pushHistory?.('f'); window.buildLayerPanel?.(); });
  await page.waitForFunction(() => !window.hasUnsavedChanges(), null, { timeout: 15000 });
}
const row = (page) => page.evaluate(() => { const a = [...document.querySelectorAll('.layer-item[draggable="true"]')].filter((e) => e.offsetWidth)[0]; a.scrollIntoView({ block: 'center' }); const q = a.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
const startDrag = async (page, r) => { await page.mouse.move(r.x, r.y); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(r.x + i, r.y + i * 3); await raf(page); };

test('K0 끌기 중 ⌘Z 는 앱에 안 온다 — keydown 0 · 되돌림 0', async ({ page }) => {
  await open(page); const r = await row(page);
  await page.evaluate(() => { window.__k = 0; document.addEventListener('keydown', () => { window.__k++; }, true); });
  const n0 = await page.evaluate(() => document.querySelectorAll('#canvas .section-block').length);
  await startDrag(page, r);
  expect(await held(page), '전제 — 끌기 창이 열렸다').toEqual(['layer-drag']);
  await page.keyboard.press('Meta+z'); await raf(page);
  expect(await page.evaluate(() => window.__k), 'keydown').toBe(0);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .section-block').length)).toBe(n0);
  await page.mouse.up(); await expect.poll(() => held(page)).toEqual([]);
});
test('K1 끌던 줄이 다시 그려져도 창이 닫힌다', async ({ page }) => {
  await open(page); const r = await row(page);
  await startDrag(page, r);
  await page.evaluate(() => window.buildLayerPanel());
  await page.mouse.up();
  await expect.poll(() => held(page)).toEqual([]);
  expect(await page.evaluate(() => window.state._suppressAutoSave)).toBe(false);
});
test('T1 dragend 가 안 와도 다음 손짓에 창이 닫히고 저장이 돈다', async ({ page }) => {
  await open(page);
  await page.evaluate(() => { const a = [...document.querySelectorAll('.layer-item[draggable="true"]')].filter((e) => e.offsetWidth)[0]; const e = new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() }); a.dispatchEvent(e); });
  expect(await held(page), '전제 — dragend 없이 창이 열렸다').toEqual(['layer-drag']);
  await page.mouse.move(800, 500); await page.mouse.down(); await page.mouse.up();
  await expect.poll(() => held(page), { message: '★창이 안 닫혀 자동저장이 멈춘 채다' }).toEqual([]);
  const id = await page.evaluate(() => { const b = new Set([...document.querySelectorAll('#canvas .section-block')].map((s) => s.id)); window.addSection(); return [...document.querySelectorAll('#canvas .section-block')].map((s) => s.id).find((x) => !b.has(x)); });
  await expect.poll(() => page.evaluate((id) => Object.keys(localStorage).some((x) => x.startsWith('web-editor-autosave') && !x.endsWith('_ts') && (localStorage.getItem(x) || '').includes(id)), id), { message: '★그 뒤 편집이 저장본에 안 들었다', timeout: 15000 }).toBe(true);
});
test('T2 다시 끌면 새 창이 열린다(닫힌 토큰을 안 쥔다)', async ({ page }) => {
  await open(page);
  const dragStart = () => page.evaluate(() => { const a = [...document.querySelectorAll('.layer-item[draggable="true"]')].filter((e) => e.offsetWidth)[0]; window.__a = window.__a || a; window.__a.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: new DataTransfer() })); });
  await dragStart(page);
  await page.mouse.move(800, 500); await page.mouse.down(); await page.mouse.up();
  await expect.poll(() => held(page)).toEqual([]);
  await dragStart(page);
  expect(await held(page)).toEqual(['layer-drag']);
  await page.evaluate(() => window.__a.dispatchEvent(new DragEvent('dragend', { bubbles: true })));
  await expect.poll(() => held(page)).toEqual([]);
});
test('N1 [음성] 놓기 처리는 창 안이다 — 보통 끌기는 끝날 때까지 창이 열려 있다', async ({ page }) => {
  await open(page); const r = await row(page);
  await page.evaluate(() => { window.__atDrop = null; document.addEventListener('drop', () => { window.__atDrop = window.AutoSaveSuppress.inspect().holders.length; }, true); });
  const t = await page.evaluate(() => { const a = [...document.querySelectorAll('.layer-item[draggable="true"]')].filter((e) => e.offsetWidth).pop(); const q = a.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.bottom - 3 }; });
  await startDrag(page, r);
  await page.mouse.move(t.x, t.y, { steps: 4 }); await raf(page);
  await page.mouse.up();
  await expect.poll(() => held(page)).toEqual([]);
  const d = await page.evaluate(() => window.__atDrop);
  if (d !== null) expect(d, '놓는 순간 창이 열려 있다').toBeGreaterThan(0);
});
