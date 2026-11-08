/* frame-child-drag-all-kinds — 자유 프레임 안 블럭이 asset 처럼 끌린다(365 뒤 · 부모 프레임 HTML5 끌기가 끼면 자기 좌표 끌기가 첫 틱에 끊긴다).
 * 놓은 뒤 좌표·부모·부모의 HTML5 끌기 없음을 잰다. 음성: 프레임 빈 자리 끌기는 여태처럼 HTML5. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const KINDS = [['asset-block', 'addAssetBlock'], ['chat-block', 'addChatBlock'], ['radial-block', 'addRadialBlock'], ['laurel-block', 'addLaurelBlock'], ['qa-block', 'addQABlock'], ['coupon-block', 'addCouponBlock'], ['quote-block', 'addQuoteBlock']];
const STEPS = 8;
const open = async (page) => { await page.setViewportSize({ width: 1500, height: 1400 }); await bootApp(page); await page.evaluate(() => window.applyZoom(40)); await waitZoomSettled(page, 40); await page.evaluate(() => { window.__ds = []; addEventListener('dragstart', (e) => window.__ds.push(e.target.id || e.target.className), true); }); };
const scene = (page, cls, entry) => page.evaluate(async ({ cls, entry }) => {
  const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((x) => x.remove()); await window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop();
  window.deselectAll(); window.selectSection(sec); window._activeFrame = null; window.addFrameBlock(); const F = [...sec.querySelectorAll('.frame-block:not([data-text-frame])')].pop(); window.updateFrameBlock(F.id, { width: 860, height: 800 });
  window.deselectAll(); window.selectSection(sec); window._activeFrame = null; await window[entry](); const k = sec.querySelector('.' + cls); if (!k.id) k.id = 'k_' + Math.random().toString(36).slice(2, 8);
  window.deselectAll(); window.clearHistory?.(); F.scrollIntoView({ block: 'start' }); return { id: k.id, f: F.id };
}, { cls, entry });
const mid = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
const corner = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.right - 6, r.bottom - 6]; }, id);
const drag = async (page, from, to) => { await page.mouse.move(from[0], from[1]); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(from[0] + (to[0] - from[0]) * i / STEPS, from[1] + (to[1] - from[1]) * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); };
const at = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); return { l: parseInt(e.style.left), t: parseInt(e.style.top), par: e.parentElement.id }; }, id);
const parentOfFrame = (page, f) => page.evaluate((f) => document.getElementById(f).parentElement.className.split(' ')[0], f);

for (const [cls, entry] of KINDS) {
  test(`${cls} — 끌어 넣은 뒤 프레임 고르고 블럭 고르고 끌면 좌표가 끝까지 움직이고 부모는 안 끌린다`, async ({ page }) => {
    await open(page); const s = await scene(page, cls, entry); await raf(page);
    const k0 = await mid(page, s.id), f0 = await mid(page, s.f);
    await page.mouse.click(k0[0], k0[1]); await raf(page); await drag(page, k0, f0);
    const a = await at(page, s.id); expect(a.par, '[전제] 프레임 직속').toBe(s.f);
    const c = await corner(page, s.f); await page.mouse.click(c[0], c[1]); await raf(page);
    const p = await mid(page, s.id); await page.mouse.dblclick(p[0], p[1]); await raf(page);   // B안(현빈 261107): 프레임 뒤 블럭은 더블클릭 진입으로 고른다(옛: 한 번 클릭 드릴인)
    expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), s.id), '[전제] 블럭 고름').toBe(true);
    const fpar = await parentOfFrame(page, s.f);
    await page.evaluate(() => { window.__ds.length = 0; });
    await drag(page, p, [p[0] + 30, p[1] + 30]);
    const b = await at(page, s.id);
    expect(await page.evaluate(() => window.__ds), 'HTML5 끌기 없음').toEqual([]);
    expect(b.par, '그 프레임 안').toBe(s.f);
    expect(b.t - a.t, '배율 40 에 30 → 모델 75').toBe(75);
    expect(b.l - a.l, '가로도').toBe(75);
    expect(await parentOfFrame(page, s.f), '프레임 제자리').toBe(fpar);
  });
}
test('음성 — 프레임 빈 자리를 끌면 프레임 HTML5 끌기가 그대로 시작된다', async ({ page }) => {
  await open(page); const [cls, entry] = KINDS[1]; const s = await scene(page, cls, entry); await raf(page);
  const c = await corner(page, s.f); await page.mouse.click(c[0], c[1]); await raf(page);
  await page.evaluate(() => { window.__ds.length = 0; });
  await drag(page, c, [c[0], c[1] + 40]);
  expect(await page.evaluate(() => window.__ds), '프레임').toContain(s.f);
});
