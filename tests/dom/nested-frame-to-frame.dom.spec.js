/* nested-frame-to-frame — 안쪽 프레임 K 를 끌면 K 가 움직인다. 제자리면 A, 다른 프레임 B 위에 놓으면 B 안(S6 K).
 * 칸: 깊이 2·3 × 스택 A(변환 직후·왕복 뒤·다시 연 판)·자유 A × 제자리·B. 그릇 A 는 안 움직인다.
 * 음성: K 를 안 고르고 A 를 끌면 A 가 끌린다 · 자유 A 안에서 K 는 좌표로 움직인다 · ⌘Z 한 번에 처음으로.
 * 양성대조: 고른 자식 프레임 비킴 또는 _frameOutsideParentAt 을 빼면 해당 칸 빨강. 장면 준비만 evaluate, 끌기는 진짜 마우스. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const STEPS = 12;
const reopen = async (page) => { await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); }); await raf(page); };
async function scene(page, depth) {
  await page.setViewportSize({ width: 1500, height: 1600 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (depth) => { const FR = '.frame-block:not([data-text-frame])'; const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__sec = sec.id;
    const mk = (par, w, h, l, t) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.updateFrameBlock(f.id, { width: w, height: h }); if (par) { f.style.left = l + 'px'; f.style.top = t + 'px'; f.dataset.offsetX = l; f.dataset.offsetY = t; } window.deselectAll(); window._activeFrame = null; return f.id; };
    const R = mk(null, 1000, 1300);
    const G = depth === 3 ? mk(R, 950, 1250, 10, 10) : R;
    const A = mk(G, 800, 400, 20, 20); const K = mk(A, 300, 100, 10, 10); const B = mk(G, 800, 500, 20, 600);
    return { R, G, A, K, B }; }, depth);
  await reopen(page);
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), ids.G); await raf(page);
  return { errs, ...ids };
}
const conv = async (page, id) => { await page.evaluate((id) => window.__convertFreeLayoutToStack(document.getElementById(id)), id); await raf(page); };
const box = (page, id) => page.evaluate((id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, b: r.bottom, sel: e.classList.contains('selected'), par: e.parentElement.closest('.frame-block')?.id, pos: e.style.position, l: e.style.left, t: e.style.top, dg: e.getAttribute('draggable'), n: document.querySelectorAll(`#canvas [id="${id}"]`).length }; }, id);
const pick = async (page, id) => { await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; window._enteredFrame = null; }); for (let i = 0; i < 6; i++) { const q = await box(page, id); if (q.sel) return true; await page.mouse.dblclick(q.x, q.y);  /* B안(현빈 261107): 자식은 더블클릭으로 진입해야 잡힌다 — 한 번 클릭은 바깥 프레임 */ await raf(page); } return (await box(page, id)).sel; };
async function drag(page, x, y, tx, ty) { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x + (tx - x) * i / STEPS, y + (ty - y) * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }
const trip = async (page, id) => { expect(await pick(page, id)).toBe(true); await page.locator('#ss-to-free-btn').click(); await page.locator('#ss-to-stack-btn').click(); await page.locator('#ss-to-free-btn').waitFor(); await raf(page); };
const PREP = {
  '스택 A 변환 직후': async (page, s) => { await conv(page, s.A); },
  '스택 A 왕복 뒤': async (page, s) => { await conv(page, s.A); await trip(page, s.A); },
  '스택 A 다시 연 판': async (page, s) => { await conv(page, s.A); await reopen(page); },
  '자유 A': async () => {},
};
for (const depth of [2, 3]) for (const [name, prep] of Object.entries(PREP)) {
  test(`깊이 ${depth} ${name} — B 위에 놓으면 B 안, A 는 그대로`, async ({ page }) => {
    const s = await scene(page, depth); await prep(page, s);
    expect(await pick(page, s.K), '[전제] 고르기').toBe(true);
    const k = await box(page, s.K), a0 = await box(page, s.A), b = await box(page, s.B);
    await drag(page, k.x, k.y, b.x, b.y);
    const k1 = await box(page, s.K), a1 = await box(page, s.A);
    expect(k1.n, '사본·유실 없음').toBe(1); expect(k1.par, 'B 안').toBe(s.B);
    expect([a1.l, a1.t], 'A 안 끌림').toEqual([a0.l, a0.t]);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
  test(`깊이 ${depth} ${name} — 제자리 근처면 A, A 는 그대로`, async ({ page }) => {
    const s = await scene(page, depth); await prep(page, s);
    expect(await pick(page, s.K), '[전제] 고르기').toBe(true);
    const k = await box(page, s.K), a0 = await box(page, s.A);
    await drag(page, k.x, k.y, k.x + 20, k.y + 12);
    const k1 = await box(page, s.K), a1 = await box(page, s.A);
    expect(k1.n).toBe(1); expect(k1.par, 'A 안').toBe(s.A);
    expect([a1.l, a1.t], 'A 안 끌림').toEqual([a0.l, a0.t]);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
test('스택 B 위에 놓으면 B 안 흐름이고 다시 끌린다', async ({ page }) => {
  const s = await scene(page, 2);
  await page.evaluate((B) => { const sec = document.getElementById(window.__sec); window.deselectAll(); window.selectSection(sec); window._activeFrame = document.getElementById(B); window.addTextBlock('body'); window.deselectAll(); window._activeFrame = null; window.__convertFreeLayoutToStack(document.getElementById(B)); }, s.B); await raf(page);
  expect(await pick(page, s.K)).toBe(true);
  const k = await box(page, s.K), b = await box(page, s.B);
  await drag(page, k.x, k.y, b.x, b.y);
  const k1 = await box(page, s.K);
  expect(k1.par).toBe(s.B); expect(k1.pos, '흐름').not.toBe('absolute'); expect(k1.dg, '다시 끌린다').toBe('true');
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
for (const [name, prep] of [['스택 A', PREP['스택 A 다시 연 판']], ['자유 A', PREP['자유 A']]]) {
  test(`${name} 에서 자유 B 로 옮긴 K 는 B 안에서 다시 끌린다, A 로 되돌릴 수 있다`, async ({ page }) => {
    const s = await scene(page, 2); await prep(page, s);
    expect(await pick(page, s.K)).toBe(true);
    let k = await box(page, s.K); const b = await box(page, s.B);
    await drag(page, k.x, k.y, b.x, b.y);
    expect((await box(page, s.K)).par, '[전제] B 안').toBe(s.B);
    expect(await pick(page, s.K), '옮긴 뒤 고르기').toBe(true);
    k = await box(page, s.K);
    await drag(page, k.x, k.y, k.x + 30, k.y + 20);
    const k2 = await box(page, s.K);
    expect(k2.par).toBe(s.B); expect(Math.abs(k2.x - k.x - 30), '다시 끌린다').toBeLessThanOrEqual(1);
    expect(await pick(page, s.K)).toBe(true);
    const a = await box(page, s.A);
    await drag(page, k2.x, k2.y, a.x, a.y);
    const k3 = await box(page, s.K);
    expect(k3.n).toBe(1); expect(k3.par, 'A 로 되돌아간다').toBe(s.A);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
test('음성 — K 를 안 고르고 A 만 고른 채 A 빈 데를 끌면 A 가 끌린다', async ({ page }) => {
  const s = await scene(page, 2);
  expect(await pick(page, s.A)).toBe(true);
  const a0 = await box(page, s.A);
  await drag(page, a0.x, a0.b - 12, a0.x + 40, a0.b + 18);
  const a1 = await box(page, s.A);
  expect(parseFloat(a1.t), 'A 가 움직인다').toBeGreaterThan(parseFloat(a0.t));
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
test('음성 — 자유 A 안에서 K 는 좌표로 움직인다, ⌘Z 한 번에 처음으로', async ({ page }) => {
  const s = await scene(page, 2); expect(await pick(page, s.K)).toBe(true);
  const k = await box(page, s.K), a0 = await box(page, s.A);
  await drag(page, k.x, k.y, k.x + 40, k.y + 30);
  const k1 = await box(page, s.K);
  expect(k1.par).toBe(s.A); expect(parseFloat(k1.t)).toBeGreaterThan(parseFloat(k.t));
  await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await box(page, s.K)).t, '한 번에').toBe(k.t);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
test('⌘Z 한 번에 B 에서 A 로', async ({ page }) => {
  const s = await scene(page, 2); expect(await pick(page, s.K)).toBe(true);
  const k = await box(page, s.K), b = await box(page, s.B);
  await drag(page, k.x, k.y, b.x, b.y);
  expect((await box(page, s.K)).par, '[전제]').toBe(s.B);
  await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await expect.poll(async () => (await box(page, s.K)).par, '한 번에').toBe(s.A);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
