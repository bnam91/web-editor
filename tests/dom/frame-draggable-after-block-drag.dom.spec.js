/* frame-draggable-after-block-drag — 스택 프레임 안 블럭을 HTML5 로 끈 뒤 곧바로 프레임 면을 끌면 프레임이 끌린다(S6 새 발견 ⑦).
 * 음성: 블럭 안 끌고 프레임 면 끌기 · 블럭 누르는 동안은 그릇 draggable 이 꺼져 있다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const STEPS = 12;
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const F = await page.evaluate(async (FR) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.selectSection(sec); window.addFrameBlock(); const f = sec.querySelector(FR); window.updateFrameBlock(f.id, { width: 800, height: 300 }); window.selectSection(sec); window._activeFrame = f; window.addTextBlock('body'); window.__convertFreeLayoutToStack(f); window.deselectAll(); window.selectSection(sec); window._activeFrame = f; window.addAssetBlock();
    const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.deselectAll(); window._activeFrame = null; window.clearHistory?.(); const n = document.getElementById(f.id); n.style.paddingBottom = '60px'; n.scrollIntoView({ block: 'center' });
    window.__live = []; addEventListener('dragstart', (e) => { const id = e.target.id; setTimeout(() => { if (!e.defaultPrevented) window.__live.push(id); }, 0); }, true); return f.id; }, FR);
  await raf(page);
  return { errs, F };
}
const rect = (page, s) => page.evaluate((s) => { const e = document.querySelector(s); const q = e.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2, b: q.bottom, sel: e.classList.contains('selected') }; }, s);
const dg = (page, F) => page.evaluate((F) => document.getElementById(F).getAttribute('draggable'), F);
const live = (page) => page.evaluate(() => new Promise((r) => setTimeout(() => r(window.__live.splice(0)), 0)));
async function drag(page, x, y, dx, dy) { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x + dx * i / STEPS, y + dy * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }
const ASSET = '#canvas .asset-block';
async function pickAsset(page) { for (let i = 0; i < 4; i++) { const w = await rect(page, ASSET); if (w.sel) return true; await page.mouse.click(w.x, w.y); await raf(page); } return (await rect(page, ASSET)).sel; }

test('블럭을 끈 뒤 그릇 draggable 이 돌아오고 곧바로 프레임 면 끌기가 산다', async ({ page }) => {
  const { errs, F } = await scene(page);
  expect(await pickAsset(page), '[전제] 고름').toBe(true);
  const w = await rect(page, ASSET);
  await drag(page, w.x, w.y, 0, -30);
  expect((await live(page)).length, '[전제] 블럭 HTML5 끌기가 살았다').toBeGreaterThan(0);
  expect(await dg(page, F), '놓은 뒤 복귀').toBe('true');
  const f = await rect(page, '#' + F);
  await drag(page, f.x, f.b - 4, 0, 40);
  expect(await live(page)).toContain(F);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('음성 — 블럭 안 끌고 프레임 면을 끌면 프레임이 끌린다', async ({ page }) => {
  const { errs, F } = await scene(page);
  const f = await rect(page, '#' + F);
  await page.mouse.click(f.x, f.b - 4); await raf(page);
  await drag(page, f.x, f.b - 4, 0, 40);
  expect(await live(page)).toContain(F);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('음성 — 블럭을 누르는 동안은 그릇 draggable 이 꺼지고, 그냥 놓으면 돌아온다', async ({ page }) => {
  const { errs, F } = await scene(page);
  expect(await pickAsset(page)).toBe(true);
  const w = await rect(page, ASSET);
  await page.mouse.move(w.x, w.y); await page.mouse.down(); await raf(page);
  expect(await dg(page, F), '누르는 동안').toBe('false');
  await page.mouse.up(); await raf(page);
  expect(await dg(page, F), '놓은 뒤').toBe('true');
  expect(errs, errs.join(' | ')).toEqual([]);
});
