/* stack-gap-surface-drag — 스택 프레임의 빈 데(패딩 gap)를 끌면 gap 이 아니라 프레임이 끌린다, 변환 직후도 다시 연 판도(S6 새 발견 ⑤).
 * 또 변환 직후 옛 좌표 끌기가 프레임에 좌표를 안 쓴다(새 발견 ④).
 * 음성: gap 을 클릭하면 gap 을 고르고, 고른 gap 은 제가 끌린다 · 안쪽 블럭 끌기는 그대로 · 놓은 뒤 gap draggable 복귀. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const STEPS = 12;
const reopen = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
async function scene(page, mode) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (FR) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    const add = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.deselectAll(); window._activeFrame = null; return f.id; };
    const text = (par) => { window.selectSection(sec); window._activeFrame = document.getElementById(par); window.addTextBlock('body'); window.deselectAll(); window._activeFrame = null; };
    const R = add(); const A = add(R); const Q = add(); text(A);
    for (const [i, w, h] of [[R, 1000, 700], [A, 800, 260]]) window.updateFrameBlock(i, { width: w, height: h });
    const f = document.getElementById(A); f.style.left = '20px'; f.style.top = '20px'; f.dataset.offsetX = 20; f.dataset.offsetY = 20;
    return { R, A, Q }; }, FR);
  await reopen(page); await raf(page);
  await page.evaluate((ids) => { for (const n of ['A', 'R']) window.__convertFreeLayoutToStack(document.getElementById(ids[n])); window.deselectAll(); window._activeFrame = null; }, ids);
  if (mode === 'reopen') await reopen(page);
  await page.evaluate((R) => { window.clearHistory?.(); window.__live = []; addEventListener('dragstart', (e) => { const id = e.target.id; setTimeout(() => { if (!e.defaultPrevented) window.__live.push(id); }, 0); }, true); document.getElementById(R).scrollIntoView({ block: 'center' }); }, ids.R);
  await raf(page);
  return { errs, ...ids };
}
const gap = (page, A) => page.evaluate((A) => { const g = document.getElementById(A).querySelector(':scope > .gap-block'); if (!g.id) g.id = 'gap_test'; const r = g.getBoundingClientRect(); return { id: g.id, x: r.left + r.width / 2, y: r.top + r.height / 2, sel: g.classList.contains('selected'), dg: g.getAttribute('draggable') }; }, A);
const live = (page) => page.evaluate(() => new Promise((r) => setTimeout(() => r(window.__live.splice(0)), 0)));
const pickA = async (page, s) => { const g = await gap(page, s.A); await page.mouse.click(g.x, g.y); await raf(page); await page.mouse.click(g.x, g.y); await raf(page); return page.evaluate((A) => document.getElementById(A).classList.contains('selected'), s.A); };
async function drag(page, x, y, dx, dy) { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x + dx * i / STEPS, y + dy * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }

for (const mode of ['fresh', 'reopen']) {
  test(`${mode} — 빈 데를 끌면 프레임이 끌리고 gap 은 안 끌린다 · gap draggable 복귀`, async ({ page }) => {
    const s = await scene(page, mode);
    expect(await pickA(page, s), '[전제] A 고름').toBe(true);
    const g = await gap(page, s.A);
    await drag(page, g.x, g.y, 0, 40);
    const l = await live(page);
    expect(l, '프레임').toContain(s.A);
    expect(l, 'gap 아님').not.toContain(g.id);
    expect((await gap(page, s.A)).dg, 'gap draggable 복귀').toBe('true');
    expect(await page.evaluate((A) => document.getElementById(A).style.left, s.A), '옛 좌표를 안 쓴다').toBe('');
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
  test(`음성 ${mode} — gap 을 클릭하면 gap 을 고르고, 고른 gap 은 제가 끌린다`, async ({ page }) => {
    const s = await scene(page, mode);
    expect(await pickA(page, s)).toBe(true);
    const g = await gap(page, s.A);
    await page.mouse.click(g.x, g.y); await raf(page);
    expect((await gap(page, s.A)).sel, 'gap 고름').toBe(true);
    await page.evaluate(() => { window.__live.length = 0; });
    await drag(page, g.x, g.y, 0, 40);
    expect(await live(page), '고른 gap').toContain(g.id);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
