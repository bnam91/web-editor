/* free-frame-pos-survives-render — 자유 프레임 안 자리가 다시 그리기·저장 왕복·⌘Z 에서 안 풀린다.
 * 렌더러가 cssText 통째 쓰기 · position='relative' 로 absolute·left·top 을 지워 7종이 흐름으로 떨어졌다. 음성: 프레임 밖 블럭은 흐름 그대로. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const KINDS = [['innercard-block', 'addInnerCardBlock', 'renderInnerCardBlock'], ['modal-block', 'addModalBlock', 'renderModalBlock'], ['banner02-block', 'addBanner02Block', 'renderBanner02'], ['comparison-block', 'addComparisonBlock', 'renderComparison'], ['canvas-block', 'addCanvasBlock', 'renderCanvas'], ['coupon-block', 'addCouponBlock', 'renderCouponBlock'], ['quote-block', 'addQuoteBlock', 'renderQuoteBlock']];
const STEPS = 8;
const open = async (page) => { await page.setViewportSize({ width: 1500, height: 1400 }); await bootApp(page); await page.evaluate(() => window.applyZoom(40)); await waitZoomSettled(page, 40); };
const scene = (page, cls, entry) => page.evaluate(async ({ cls, entry }) => {
  const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((x) => x.remove()); await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop();
  window.deselectAll(); window.selectSection(sec); window._activeFrame = null; window.addFrameBlock(); const F = [...sec.querySelectorAll('.frame-block:not([data-text-frame])')].pop(); window.updateFrameBlock(F.id, { width: 860, height: 800 });
  window.deselectAll(); window.selectSection(sec); window._activeFrame = null; await window[entry](); const k = sec.querySelector('.' + cls); if (!k.id) k.id = 'k_' + Math.random().toString(36).slice(2, 8);
  window.deselectAll(); window.clearHistory?.(); F.scrollIntoView({ block: 'start' }); return { id: k.id, f: F.id };
}, { cls, entry });
const mid = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
const drag = async (page, from, to) => { await page.mouse.move(from[0], from[1]); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(from[0] + (to[0] - from[0]) * i / STEPS, from[1] + (to[1] - from[1]) * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); };
const pos = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return { p: e.style.position, l: e.style.left, t: e.style.top, x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, par: e.parentElement.id }; }, id);
const reopen = async (page) => { await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); }); await raf(page); };

for (const [cls, entry, render] of KINDS) {
  test(`${cls} — 프레임 안 자리가 다시 그리기·저장 왕복에서 그대로다`, async ({ page }) => {
    await open(page); const s = await scene(page, cls, entry); await raf(page);
    const k0 = await mid(page, s.id), f0 = await mid(page, s.f);
    await page.mouse.click(k0[0], k0[1]); await raf(page); await drag(page, k0, f0);
    expect((await pos(page, s.id)).par, '[전제] 프레임 직속').toBe(s.f);
    const corner = await page.evaluate((f) => { const r = document.getElementById(f).getBoundingClientRect(); return [r.right - 6, r.bottom - 6]; }, s.f);
    await page.mouse.click(corner[0], corner[1]); await raf(page);
    const p = await mid(page, s.id); await page.mouse.click(p[0], p[1]); await raf(page); await drag(page, p, [p[0] + 20, p[1] + 20]);
    const a = await pos(page, s.id);
    expect(a.p, '[전제] 끈 뒤 absolute').toBe('absolute');
    await page.evaluate(([render, id]) => window[render](document.getElementById(id)), [render, s.id]); await raf(page);
    expect(await pos(page, s.id), '다시 그리기').toEqual(a);
    await reopen(page);
    expect(await pos(page, s.id), '저장 왕복').toEqual(a);
  });
}
test('음성 — 프레임 밖 블럭은 저장 왕복 뒤에도 흐름이다', async ({ page }) => {
  await open(page);
  for (const [cls, entry] of KINDS) {
    const s = await scene(page, cls, entry); await raf(page);
    await reopen(page);
    const p = await pos(page, s.id);
    expect(p.p, cls).not.toBe('absolute');
    expect([p.l, p.t], cls).toEqual(['', '']);
  }
});
