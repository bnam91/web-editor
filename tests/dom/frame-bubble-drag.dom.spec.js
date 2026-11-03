/* frame-bubble-drag — 자유 프레임 안 말풍선을 끌면 손을 따라오고 부모가 안 바뀐다(S6 새 발견 ②).
 * 음성: 섹션 직속 말풍선은 HTML5 순서 끌기 그대로 · 누르기만 하면 자리가 안 튄다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const STEPS = 12;
const reopen = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
async function scene(page, depth) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const C = await page.evaluate(async ({ FR, depth }) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); if (depth === 0) return null;
    const add = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.deselectAll(); window._activeFrame = null; return f.id; };
    const R = add(); window.updateFrameBlock(R, { width: 1000, height: 900 }); if (depth === 1) return R;
    const G = add(R); const D = add(G); window.updateFrameBlock(G, { width: 900, height: 700 }); window.updateFrameBlock(D, { width: 700, height: 500 });
    for (const i of [G, D]) { const f = document.getElementById(i); f.style.left = '20px'; f.style.top = '20px'; f.dataset.offsetX = 20; f.dataset.offsetY = 20; }
    return D; }, { FR, depth });
  await reopen(page); await raf(page);
  await page.evaluate((C) => { window.deselectAll(); window.selectSection(document.querySelector('#canvas .section-block')); window._activeFrame = C ? document.getElementById(C) : null; window.addSpeechBubbleBlock(); window.deselectAll(); window._activeFrame = null; window.__ds = []; addEventListener('dragstart', (e) => { const x = e; setTimeout(() => { if (!x.defaultPrevented) window.__ds.push(x.target.id); }, 0); }, true); document.querySelector('#canvas .speech-bubble-block').scrollIntoView({ block: 'center' }); }, C);
  await raf(page);
  return { errs, C };
}
const st = (page) => page.evaluate((FR) => { const e = document.querySelector('#canvas .speech-bubble-block'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, par: e.parentElement.closest(FR)?.id || null, sel: e.classList.contains('selected') }; }, FR);
const pick = async (page) => { for (let i = 0; i < 6; i++) { const w = await st(page); if (w.sel) return true; await page.mouse.click(w.x, w.y); await raf(page); } return (await st(page)).sel; };
async function drag(page, x, y, dx, dy) { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x + dx * i / STEPS, y + dy * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }

for (const depth of [1, 3]) {
  test(`깊이 ${depth} — 끌면 손을 따라오고 부모 그대로 · 다시 열어도 그 자리`, async ({ page }) => {
    const s = await scene(page, depth);
    expect(await pick(page), '[전제] 고름').toBe(true);
    const a = await st(page);
    await drag(page, a.x, a.y, 60, 45);
    const b = await st(page);
    expect(b.par, '부모').toBe(s.C);
    expect([Math.round(b.l - a.l), Math.round(b.t - a.t)]).toEqual([60, 45]);
    expect(await page.evaluate(() => window.__ds), 'HTML5 끌기 없음').toEqual([]);
    await reopen(page); await raf(page);
    const c = await st(page);
    expect([c.par, Math.round(c.l), Math.round(c.t)], '다시 열어도 그 자리').toEqual([s.C, Math.round(b.l), Math.round(b.t)]);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
test('깊이 3 — 끈 뒤 ⌘Z 로 처음 자리', async ({ page }) => {
  const s = await scene(page, 3);
  expect(await pick(page)).toBe(true);
  const a = await st(page);
  await drag(page, a.x, a.y, 60, 45);
  await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z'); await raf(page);
  await expect.poll(async () => { const w = await st(page); return [Math.round(w.l - a.l), Math.round(w.t - a.t)]; }).toEqual([0, 0]);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
test('음성 — 깊이 3 누르고 그대로 놓으면 자리가 안 튄다', async ({ page }) => {
  const s = await scene(page, 3);
  expect(await pick(page)).toBe(true);
  const a = await st(page);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.up(); await raf(page);
  const b = await st(page);
  expect([Math.round(b.l - a.l), Math.round(b.t - a.t)]).toEqual([0, 0]);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
test('음성 — 섹션 직속 말풍선은 HTML5 순서 끌기 그대로', async ({ page }) => {
  const s = await scene(page, 0);
  expect(await pick(page)).toBe(true);
  const a = await st(page);
  await drag(page, a.x, a.y, 0, 120);
  await expect.poll(() => page.evaluate(() => window.__ds.length)).toBeGreaterThan(0);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
