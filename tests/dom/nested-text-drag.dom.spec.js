/* nested-text-drag — 중첩 자유 프레임 안 고른 글자를 끌면 글자가 손을 따라온다(S3 J294L B-8).
 * 음성: 맨 위 프레임 안 글자 · 중첩 프레임 안 에셋은 그대로 · 고르지 않은 글자는 안 끌린다 · 편집 중 끌기는 글자 프레임을 안 옮긴다 · 저장본 좌표가 끈 자리다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const STEPS = 12;
const reopen = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
/* depth 1 = 맨 위 프레임 안 · depth 3 = R > G > C 안 */
async function scene(page, depth, sel, fn, arg) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async ({ FR, depth }) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__sec = sec.id;
    const add = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.deselectAll(); window._activeFrame = null; return f.id; };
    const R = add(); window.updateFrameBlock(R, { width: 1000, height: 900 }); if (depth === 1) return { R, C: R };
    const G = add(R); const C = add(G); window.updateFrameBlock(G, { width: 900, height: 700 }); window.updateFrameBlock(C, { width: 700, height: 500 });
    for (const i of [G, C]) { const f = document.getElementById(i); f.style.left = '20px'; f.style.top = '20px'; f.dataset.offsetX = 20; f.dataset.offsetY = 20; }
    return { R, G, C }; }, { FR, depth });
  await reopen(page); await raf(page);
  await page.evaluate(({ ids, sel, fn, arg }) => { const sec = document.getElementById(window.__sec); const b = new Set(document.querySelectorAll(sel)); window.deselectAll(); window.selectSection(sec); window._activeFrame = document.getElementById(ids.C); window[fn](arg); [...document.querySelectorAll(sel)].find((x) => !b.has(x)).dataset.mk = '1'; window.deselectAll(); window._activeFrame = null; window.clearHistory?.(); document.getElementById(ids.R).scrollIntoView({ block: 'center' }); }, { ids, sel, fn, arg });
  await raf(page);
  return { errs, ...ids };
}
const mk = (page) => page.evaluate((FR) => { const e = document.querySelector('[data-mk]'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, par: e.parentElement.closest(FR)?.id, sel: e.classList.contains('selected') }; }, FR);
const pick = async (page) => { for (let i = 0; i < 6; i++) { const w = await mk(page); if (w.sel) return true; await page.mouse.dblclick(w.x, w.y);  /* B안(현빈 261107): 자식은 더블클릭으로 진입해야 잡힌다 — 한 번 클릭은 바깥 프레임 */ await raf(page); } return (await mk(page)).sel; };
async function drag(page, x, y, dx, dy) { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x + dx * i / STEPS, y + dy * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }
const frameAt = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left, r.top]; }, id);
const TEXT = ['.text-block', 'addTextBlock', 'body'];

for (const [name, depth, s] of [['중첩 글자', 3, TEXT], ['음성 — 맨 위 프레임 글자', 1, TEXT], ['음성 — 중첩 에셋', 3, ['.asset-block', 'addAssetBlock']]]) {
  test(`${name} — 고른 뒤 끌면 손을 따라오고 그릇은 제자리다`, async ({ page }) => {
    const sc = await scene(page, depth, ...s);
    expect(await pick(page), '[전제] 클릭 고르기').toBe(true);
    const a = await mk(page); const f0 = await frameAt(page, sc.C);
    await drag(page, a.x, a.y, 60, 45);
    const b = await mk(page);
    expect(Math.abs(b.x - a.x - 60), `x ${b.x - a.x}`).toBeLessThan(12);
    expect(Math.abs(b.y - a.y - 45), `y ${b.y - a.y}`).toBeLessThan(12);
    expect(await frameAt(page, sc.C), '그릇 제자리').toEqual(f0);
    expect(b.par).toBe(sc.C);
    expect(sc.errs, sc.errs.join(' | ')).toEqual([]);
  });
}
test('중첩 글자 — 끈 자리가 저장본에 남고 ⌘Z 로 돌아온다', async ({ page }) => {
  const sc = await scene(page, 3, ...TEXT);
  expect(await pick(page)).toBe(true);
  const left = () => page.evaluate(() => document.querySelector('[data-mk]').closest('.frame-block[data-text-frame]').style.left);
  const l0 = await left(); const a = await mk(page);
  await drag(page, a.x, a.y, 60, 45);
  const l1 = await left(); expect(l1).not.toBe(l0);
  const saved = await page.evaluate(() => { const d = new DOMParser().parseFromString('<div>' + window.getSerializedCanvas() + '</div>', 'text/html'); return d.querySelector('[data-mk]').closest('.frame-block[data-text-frame]').style.left; });
  expect(saved).toBe(l1);
  await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z'); await raf(page);
  await expect.poll(left).toBe(l0);
  expect(sc.errs, sc.errs.join(' | ')).toEqual([]);
});
test('음성 — 고르지 않은 중첩 글자의 글자칸을 끌어도 글자가 안 움직인다', async ({ page }) => {
  const sc = await scene(page, 3, ...TEXT);
  expect(await pick(page)).toBe(true);
  await page.evaluate((C) => { const e = document.querySelector('[data-mk]'); e.classList.remove('selected'); document.getElementById(C).classList.add('selected'); }, sc.C); await raf(page);
  const left = () => page.evaluate(() => document.querySelector('[data-mk]').closest('.frame-block[data-text-frame]').style.left);
  const l0 = await left(); const a = await mk(page);
  await drag(page, a.x, a.y, 60, 45);
  expect(await left()).toBe(l0);
  expect(sc.errs, sc.errs.join(' | ')).toEqual([]);
});
test('음성 — 편집 중 끌기는 글자 프레임을 안 옮긴다', async ({ page }) => {
  const sc = await scene(page, 3, ...TEXT);
  expect(await pick(page)).toBe(true);
  const a = await mk(page);
  await page.mouse.dblclick(a.x, a.y); await raf(page);
  expect(await page.evaluate(() => document.querySelector('[data-mk]').classList.contains('editing')), '[전제] 편집 진입').toBe(true);
  const left = () => page.evaluate(() => document.querySelector('[data-mk]').closest('.frame-block[data-text-frame]').style.left);
  const l0 = await left();
  await drag(page, a.x, a.y, 30, 0);
  expect(await left()).toBe(l0);
  expect(sc.errs, sc.errs.join(' | ')).toEqual([]);
});
