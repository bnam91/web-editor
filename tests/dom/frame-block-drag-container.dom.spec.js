/* frame-block-drag-container — 자유 프레임 안 블럭을 끌면 블럭이 움직이고 그릇 프레임은 안 끌린다(FREE-FRAME-BLOCK-DRAG-GRABS-CONTAINER-01).
 * 음성: 프레임 빈 자리 끌기는 여태처럼 HTML5 · 놓은 뒤 draggable 복귀 · 이미 되던 종(표)은 그대로. 자식 프레임 끌기는 child-frame-drag-294 가 지킨다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const STEPS = 12;
const reopen = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
async function scene(page, add) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const F = await page.evaluate(async ({ FR, add }) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    window.selectSection(sec); window.addFrameBlock(); const f = sec.querySelector(FR); window.updateFrameBlock(f.id, { width: 860, height: 600 });
    window.deselectAll(); window.selectSection(sec); window._activeFrame = f; await window[add](); window.deselectAll(); window._activeFrame = null;
    window.__ds = []; addEventListener('dragstart', (e) => window.__ds.push(e.target.id), true); f.scrollIntoView({ block: 'center' }); return f.id; }, { FR, add });
  await reopen(page); await raf(page);
  return { errs, F };
}
const rect = (page, sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
async function drag(page, x, y, dx, dy) { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x + dx * i / STEPS, y + dy * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }
async function pick(page, sel) { for (let i = 0; i < 5; i++) { if (await page.evaluate((s) => document.querySelector(s).classList.contains('selected'), sel)) return true; const b = await rect(page, sel); await page.mouse.click(b.x, b.y); await raf(page); } return false; }

for (const [kind, add] of [['chat', 'addChatBlock'], ['coupon', 'addCouponBlock'], ['quote', 'addQuoteBlock'], ['radial', 'addRadialBlock'], ['laurel', 'addLaurelBlock'], ['qa', 'addQABlock'], ['table(음성 · 전부터 정상)', 'addTableBlock']]) {
  test(`${kind} — 끌면 블럭이 손을 따라오고 그릇 프레임은 HTML5 끌기가 안 시작된다`, async ({ page }) => {
    const sel = '#canvas .' + (kind.startsWith('table') ? 'table' : add.replace(/^add|Block$/g, '').toLowerCase()) + '-block';
    const { errs, F } = await scene(page, add);
    expect(await pick(page, sel), '[전제] 진짜 클릭으로 골라진다').toBe(true);
    const a = await rect(page, sel); const f0 = await rect(page, '#' + F);
    await drag(page, a.x, a.y, 60, 45);
    expect(await page.evaluate(() => window.__ds), 'HTML5 끌기 없음').toEqual([]);
    const b = await rect(page, sel); const f1 = await rect(page, '#' + F);
    expect(Math.abs((b.x - a.x) - 60), `x ${b.x - a.x}`).toBeLessThan(12);
    expect(Math.abs((b.y - a.y) - 45), `y ${b.y - a.y}`).toBeLessThan(12);
    expect([f1.l, f1.t], '그릇 제자리').toEqual([f0.l, f0.t]);
    expect(await page.evaluate(([s, F]) => document.querySelector(s).parentElement.closest('.frame-block:not([data-text-frame])')?.id === F, [sel, F]), '부모 그대로').toBe(true);
    expect(await page.evaluate((F) => document.getElementById(F).getAttribute('draggable'), F), '놓은 뒤 그릇 draggable 복귀').toBe('true');
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
test('음성 — 그릇 빈 자리를 끌면 그릇 HTML5 끌기가 그대로 시작된다', async ({ page }) => {
  const { errs, F } = await scene(page, 'addChatBlock');
  const f = await rect(page, '#' + F);
  await page.mouse.click(f.l + 300, f.b - 10); await raf(page);
  await drag(page, f.l + 300, f.b - 10, 0, 60);
  expect(await page.evaluate(() => window.__ds)).toContain(F);
  expect(errs, errs.join(' | ')).toEqual([]);
});
