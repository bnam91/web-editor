/* stack-convert-drop — 자유→스택 변환 직후 안쪽 프레임에 마우스로 넣어진다(S3 J294L B-5 · 전에는 다시 열어야 됐다).
 * 음성: 끌기 한 번에 사본이 안 생긴다 · ⌘Z 로 처음 부모 · 변환 직후 클릭 고르기가 산다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const STEPS = 12;
const reopen = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
async function scene(page, addCall) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (FR) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__sec = sec.id;
    const add = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.deselectAll(); window._activeFrame = null; return f.id; };
    const text = (par) => { window.selectSection(sec); window._activeFrame = document.getElementById(par); window.addTextBlock('body'); window.deselectAll(); window._activeFrame = null; };
    const R = add(); const G1 = add(R); const A = add(G1); const B = add(G1); text(A); text(B);
    for (const [i, w, h] of [[R, 1000, 1000], [G1, 900, 900], [A, 800, 260], [B, 800, 260]]) window.updateFrameBlock(i, { width: w, height: h });
    for (const [i, l, t] of [[G1, 20, 20], [A, 20, 20], [B, 20, 320]]) { const f = document.getElementById(i); f.style.left = l + 'px'; f.style.top = t + 'px'; f.dataset.offsetX = l; f.dataset.offsetY = t; }
    return { R, G1, A, B }; }, FR);
  await reopen(page); await raf(page);
  await page.evaluate(({ ids, addCall }) => { for (const n of ['A', 'B', 'G1', 'R']) { window.__convertFreeLayoutToStack(document.getElementById(ids[n])); }
    const sec = document.getElementById(window.__sec); const before = new Set(document.querySelectorAll(addCall.sel)); window.deselectAll(); window.selectSection(sec); window._activeFrame = document.getElementById(ids.A); window[addCall.fn](addCall.arg);
    [...document.querySelectorAll(addCall.sel)].find((x) => !before.has(x)).dataset.mk = '1'; window.deselectAll(); window._activeFrame = null; window.clearHistory?.();
    document.getElementById(ids.R).scrollIntoView({ block: 'center' }); }, { ids, addCall });
  await raf(page);
  return { errs, ...ids };
}
const mk = (page) => page.evaluate((FR) => { const e = document.querySelector('[data-mk]'); const r = e.getBoundingClientRect(); return { n: document.querySelectorAll('[data-mk]').length, x: r.left + r.width / 2, y: r.top + r.height / 2, par: e.parentElement.closest(FR)?.id, sel: e.classList.contains('selected') }; }, FR);
const pick = async (page) => { for (let i = 0; i < 5; i++) { const w = await mk(page); if (w.sel) return true; await page.mouse.dblclick(w.x, w.y);  /* B안(현빈 261107): 자식은 더블클릭으로 진입해야 잡힌다 — 한 번 클릭은 바깥 프레임 */ await raf(page); } return (await mk(page)).sel; };
const spot = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.bottom - 8]; }, id);
async function drag(page, x, y, tx, ty) { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x + (tx - x) * i / STEPS, y + (ty - y) * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }
const KINDS = [['에셋', { sel: '.asset-block', fn: 'addAssetBlock' }], ['글자', { sel: '.text-block', fn: 'addTextBlock', arg: 'body' }]];

for (const [name, addCall] of KINDS) {
  test(`${name} — 변환 직후 G1 → A → B 로 놓은 프레임에 들어간다`, async ({ page }) => {
    const s = await scene(page, addCall);
    for (const to of ['G1', 'A', 'B']) {
      expect(await pick(page), `[전제] ${to} 앞 클릭 고르기`).toBe(true);
      const w = await mk(page); const [tx, ty] = await spot(page, s[to]);
      await drag(page, w.x, w.y, tx, ty);
      const a = await mk(page);
      expect(a.n, '사본·유실 없음').toBe(1);
      expect(a.par, `${to} 칸`).toBe(s[to]);
    }
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
test('변환 전부터 있던 글자도 변환 직후 B 로 들어간다 — 자식을 프레임만 묶으면 A 에 남는다', async ({ page }) => {
  const s = await scene(page, KINDS[0][1]);
  await page.evaluate((A) => { document.querySelector('[data-mk]').removeAttribute('data-mk'); document.getElementById(A).querySelector('.text-block').dataset.mk = '1'; }, s.A);
  expect(await pick(page), '[전제] 클릭 고르기').toBe(true);
  const w = await mk(page); expect(w.par, '[전제] A 안').toBe(s.A);
  const [tx, ty] = await spot(page, s.B);
  await drag(page, w.x, w.y, tx, ty);
  const a = await mk(page);
  expect(a.n, '사본·유실 없음').toBe(1);
  expect(a.par).toBe(s.B);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
test('음성 — 넣은 뒤 ⌘Z 를 거듭하면 처음 부모로 돌아온다', async ({ page }) => {
  const s = await scene(page, KINDS[0][1]);
  expect(await pick(page)).toBe(true);
  const w = await mk(page); const [tx, ty] = await spot(page, s.B);
  await drag(page, w.x, w.y, tx, ty);
  expect((await mk(page)).par).toBe(s.B);
  await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); });
  await expect.poll(async () => { await page.keyboard.press('Meta+z'); await raf(page); return (await mk(page)).par; }, { timeout: 10000 }).toBe(s.A);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
