/* label-chip-drag — 프레임 안 라벨 묶음을 칩 위에서 끌어도 블럭이 손을 따라온다(S3 B-8 · 지디 판정 ①).
 * 음성: 칩 클릭은 칩을 고른다 · 더블클릭은 글자를 연다 · 칩 밖 끌기는 그대로. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const STEPS = 12;
const reopen = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
async function scene(page, depth) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const C = await page.evaluate(async ({ FR, depth }) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    const add = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.deselectAll(); window._activeFrame = null; return f.id; };
    const R = add(); window.updateFrameBlock(R, { width: 1000, height: 900 }); if (depth === 1) return R;
    const G = add(R); const D = add(G); window.updateFrameBlock(G, { width: 900, height: 700 }); window.updateFrameBlock(D, { width: 700, height: 500 });
    for (const i of [G, D]) { const f = document.getElementById(i); f.style.left = '20px'; f.style.top = '20px'; f.dataset.offsetX = 20; f.dataset.offsetY = 20; }
    return D; }, { FR, depth });
  await reopen(page); await raf(page);
  await page.evaluate((C) => { window.deselectAll(); window.selectSection(document.querySelector('#canvas .section-block')); window._activeFrame = document.getElementById(C); window.addLabelGroupBlock(); window.deselectAll(); window._activeFrame = null; document.querySelector('#canvas .label-group-block').scrollIntoView({ block: 'center' }); }, C);
  await raf(page);
  return { errs, C };
}
const st = (page) => page.evaluate(() => { const e = document.querySelector('#canvas .label-group-block'); const r = e.getBoundingClientRect(); const i = e.querySelector('.label-item').getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, ix: i.left + i.width / 2, iy: i.top + i.height / 2, sel: e.classList.contains('selected') }; });
const pick = async (page) => { for (let i = 0; i < 6; i++) { const w = await st(page); if (w.sel) return true; await page.mouse.dblclick(w.r - 4, w.b - 3);  /* B안(현빈 261107): 자식은 더블클릭으로 진입해야 잡힌다 — 한 번 클릭은 바깥 프레임 */ await raf(page); } return (await st(page)).sel; };
async function drag(page, x, y, dx, dy) { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x + dx * i / STEPS, y + dy * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }

for (const depth of [1, 3]) {
  test(`깊이 ${depth} — 칩 위 끌기에 블럭이 손을 따라온다`, async ({ page }) => {
    const s = await scene(page, depth);
    expect(await pick(page), '[전제] 고름').toBe(true);
    const a = await st(page);
    await drag(page, a.ix, a.iy, 60, 45);
    const b = await st(page);
    expect([Math.round(b.l - a.l), Math.round(b.t - a.t)]).toEqual([60, 45]);
    expect(await page.evaluate(([C, FR]) => document.querySelector('#canvas .label-group-block').parentElement.closest(FR).id === C, [s.C, FR])).toBe(true);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
  test(`음성 깊이 ${depth} — 칩 밖 끌기는 그대로 따라온다`, async ({ page }) => {
    const s = await scene(page, depth);
    expect(await pick(page)).toBe(true);
    const a = await st(page);
    await drag(page, a.r - 4, a.b - 3, 60, 45);
    const b = await st(page);
    expect([Math.round(b.l - a.l), Math.round(b.t - a.t)]).toEqual([60, 45]);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
test('음성 — 칩 클릭은 칩을 고르고 더블클릭은 글자를 연다, 블럭은 안 움직인다', async ({ page }) => {
  const s = await scene(page, 3);
  expect(await pick(page)).toBe(true);
  const a = await st(page);
  await page.mouse.click(a.ix, a.iy); await raf(page);
  expect(await page.evaluate(() => document.querySelector('#canvas .label-item').classList.contains('item-selected')), '칩 고름').toBe(true);
  await page.mouse.dblclick(a.ix, a.iy); await raf(page);
  expect(await page.evaluate(() => document.activeElement?.classList?.contains('label-item-text') && document.activeElement.isContentEditable), '글자 열림').toBe(true);
  const b = await st(page);
  expect([b.l, b.t]).toEqual([a.l, a.t]);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
