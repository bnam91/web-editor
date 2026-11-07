/* big-block-dragout — 큰 블럭 윗부분을 잡고 끌 때 커서가 프레임 안이면 안 빠진다(S6 새 발견 ③).
 * 음성: 커서까지 프레임 밖으로 나가면 여태처럼 섹션으로 빠진다 · 작은 글자도 같다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const STEPS = 12;
const reopen = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
async function scene(page, sel, fn, arg) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const F = await page.evaluate(async ({ FR, sel, fn, arg }) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.selectSection(sec); window.addFrameBlock(); const f = sec.querySelector(FR); window.updateFrameBlock(f.id, { width: 860, height: 600 }); return f.id; }, { FR, sel, fn, arg });
  await reopen(page); await raf(page);
  await page.evaluate(({ F, sel, fn, arg }) => { window.deselectAll(); window.selectSection(document.querySelector('#canvas .section-block')); window._activeFrame = document.getElementById(F); window[fn](arg); window.deselectAll(); window._activeFrame = null; document.querySelector('#canvas ' + sel).dataset.mk = '1'; document.getElementById(F).scrollIntoView({ block: 'center' }); }, { F, sel, fn, arg });
  await raf(page);
  return { errs, F };
}
const st = (page, F) => page.evaluate(({ F, FR }) => { const e = document.querySelector('#canvas [data-mk]'); const r = e.getBoundingClientRect(); const f = document.getElementById(F).getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, x: r.left + r.width / 2, y: r.top + r.height / 2, sel: e.classList.contains('selected'), fb: f.bottom, inF: e.parentElement.closest(FR)?.id === F }; }, { F, FR });
const pick = async (page, F) => { for (let i = 0; i < 6; i++) { const w = await st(page, F); if (w.sel) return true; await page.mouse.dblclick(w.x, w.y);  /* B안(현빈 261107): 자식은 더블클릭으로 진입해야 잡힌다 — 한 번 클릭은 프레임 */ await raf(page); } return (await st(page, F)).sel; };
async function drag(page, x, y, dx, dy) { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x + dx * i / STEPS, y + dy * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }

test('비교표 윗부분을 잡고 내려도 커서가 프레임 안이면 안 빠지고 움직인다', async ({ page }) => {
  const s = await scene(page, '.comparison-block', 'addComparisonBlock');
  expect(await pick(page, s.F), '[전제] 고름').toBe(true);
  const a = await st(page, s.F);
  const gy = a.t + 4; const dy = a.fb - gy - 4;
  expect(gy + dy, '[전제] 커서는 끝까지 프레임 안').toBeLessThan(a.fb);
  expect(a.y + dy, '[전제] 중심은 프레임 밑변을 넘는다').toBeGreaterThan(a.fb);
  await drag(page, a.x, gy, 0, dy);
  const b = await st(page, s.F);
  expect(b.inF, '프레임 안에 남는다').toBe(true);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
for (const [name, sel, fn, arg] of [['비교표', '.comparison-block', 'addComparisonBlock'], ['글자', '.text-block', 'addTextBlock', 'body']]) {
  test(`음성 — ${name} 를 커서까지 프레임 밖으로 끌면 섹션으로 빠진다`, async ({ page }) => {
    const s = await scene(page, sel, fn, arg);
    expect(await pick(page, s.F)).toBe(true);
    const a = await st(page, s.F);
    await drag(page, a.x, a.y, 0, a.fb - a.y + 300);
    const b = await st(page, s.F);
    expect(b.inF, '빠진다').toBe(false);
    expect(await page.evaluate(() => document.querySelectorAll('#canvas [data-mk]').length)).toBe(1);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
