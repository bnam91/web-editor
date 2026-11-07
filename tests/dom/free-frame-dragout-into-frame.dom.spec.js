/* free-frame-dragout-into-frame — 자유 프레임 A 안 블럭을 좌표로 끌어 옆 프레임 B 위에 놓으면 B 안에 든다(말풍선이 섹션으로 빠지던 것 · S6 남은 칸).
 * 칸: 말풍선·글자 × 자유 B·스택 B · 제자리면 A · ⌘Z 한 번에 A · ⌘⇧Z.
 * 음성: 빈 섹션 자리면 전처럼 섹션으로 빠진다 · 묶음·오버레이 위면 안 든다.
 * 양성대조: onUp·onMove 의 _outTarget 갈래를 빼면 B 칸·⌘Z 칸 빨강, 제자리·음성 초록. 장면 준비만 evaluate — 끌기는 진짜 마우스. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const STEPS = 12;
const reopen = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
async function scene(page, add) {
  await page.setViewportSize({ width: 1500, height: 1600 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async ({ FR, add }) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__sec = sec.id;
    const mk = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.deselectAll(); window._activeFrame = null; return f.id; };
    const R = mk(); const A = mk(R); const B = mk(R);
    for (const [i, w, h] of [[R, 1000, 1200], [A, 800, 300], [B, 800, 500]]) window.updateFrameBlock(i, { width: w, height: h });
    for (const [i, l, t] of [[A, 20, 20], [B, 20, 500]]) { const f = document.getElementById(i); f.style.left = l + 'px'; f.style.top = t + 'px'; f.dataset.offsetX = l; f.dataset.offsetY = t; }
    const before = new Set(document.querySelectorAll(add.sel)); window.deselectAll(); window.selectSection(sec); window._activeFrame = document.getElementById(A); await window[add.fn](...(add.arg ? [add.arg] : [])); const e = [...document.querySelectorAll(add.sel)].find((x) => !before.has(x)); e.dataset.mk = '1'; window.deselectAll(); window._activeFrame = null;
    return { R, A, B }; }, { FR, add });
  await reopen(page); await raf(page);
  await page.evaluate((R) => document.getElementById(R).scrollIntoView({ block: 'center' }), ids.R); await raf(page);
  return { errs, ...ids };
}
const mk = (page) => page.evaluate((FR) => { const e = document.querySelector('#canvas [data-mk]'); const r = e.getBoundingClientRect(); const u = e.closest('.frame-block[data-text-frame]') || e; return { n: document.querySelectorAll('#canvas [data-mk]').length, x: r.left + r.width / 2, y: r.top + r.height / 2, par: u.parentElement.closest(FR)?.id || null, inSec: !u.parentElement.closest(FR), sel: e.classList.contains('selected'), pos: u.style.position, left: u.style.left, top: u.style.top }; }, FR);
const box = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, id);
const pick = async (page) => { await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; window._enteredFrame = null; }); for (let i = 0; i < 6; i++) { const w = await mk(page); if (w.sel) return true; await page.mouse.dblclick(w.x, w.y);  /* B안(현빈 261107): 자식은 더블클릭으로 진입해야 잡힌다 — 한 번 클릭은 프레임 */ await raf(page); } return (await mk(page)).sel; };
async function drag(page, x, y, tx, ty) { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x + (tx - x) * i / STEPS, y + (ty - y) * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }
const KINDS = [['말풍선', { sel: '.speech-bubble-block', fn: 'addSpeechBubbleBlock' }], ['글자', { sel: '.text-block', fn: 'addTextBlock', arg: 'body' }]];

for (const [name, add] of KINDS) {
  test(`${name} — 자유 B 위에 놓으면 놓은 자리로 B 안에 든다`, async ({ page }) => {
    const s = await scene(page, add); expect(await pick(page), '[전제] 고르기').toBe(true);
    const w = await mk(page); const b = await box(page, s.B);
    await drag(page, w.x, w.y, b.cx, b.cy);
    const a = await mk(page);
    expect(a.n, '사본·유실 없음').toBe(1); expect(a.par).toBe(s.B); expect(a.pos).toBe('absolute');
    expect(Math.abs(a.y - b.cy), '놓은 자리').toBeLessThan(6);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
  test(`${name} — 스택 B 위에 놓으면 B 안 흐름으로 든다`, async ({ page }) => {
    const s = await scene(page, add);
    const free = await page.evaluate((B) => { const sec = document.getElementById(window.__sec); window.deselectAll(); window.selectSection(sec); window._activeFrame = document.getElementById(B); window.addTextBlock('body'); window.deselectAll(); window._activeFrame = null; window.__convertFreeLayoutToStack(document.getElementById(B)); return document.getElementById(B).dataset.freeLayout; }, s.B); await raf(page);
    expect(free, '[전제] B 는 스택(빈 프레임은 안 바뀌어 글자를 넣었다)').not.toBe('true');
    expect(await pick(page), '[전제] 고르기').toBe(true);
    const w = await mk(page); const b = await box(page, s.B);
    await drag(page, w.x, w.y, b.cx, b.cy);
    const a = await mk(page);
    expect(a.n).toBe(1); expect(a.par).toBe(s.B); expect(a.pos, '흐름').not.toBe('absolute');
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
  test(`${name} — ⌘Z 한 번에 A 로, ⌘⇧Z 로 다시 B`, async ({ page }) => {
    const s = await scene(page, add); expect(await pick(page)).toBe(true);
    const w = await mk(page); const b = await box(page, s.B);
    await drag(page, w.x, w.y, b.cx, b.cy);
    expect((await mk(page)).par, '[전제]').toBe(s.B);
    await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); });
    await page.keyboard.press('Meta+z');
    await expect.poll(async () => (await mk(page)).par, '한 번에').toBe(s.A);
    await page.keyboard.press('Meta+Shift+z');
    await expect.poll(async () => (await mk(page)).par).toBe(s.B);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
  test(`${name} — 제자리 근처면 A 에 남는다`, async ({ page }) => {
    const s = await scene(page, add); expect(await pick(page)).toBe(true);
    const w = await mk(page);
    await drag(page, w.x, w.y, w.x + 30, w.y + 12);
    const a = await mk(page);
    expect(a.n).toBe(1); expect(a.par).toBe(s.A);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
test('큰 에셋을 자유 B 에 놓아도 B 위로 안 삐져나온다', async ({ page }) => {
  const s = await scene(page, { sel: '.asset-block', fn: 'addAssetBlock' });
  const top = () => page.evaluate(() => { const r = document.querySelector('#canvas [data-mk]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + 20]; });
  const [x, y] = await top();
  await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; window._enteredFrame = null; });
  for (let i = 0; i < 6 && !(await mk(page)).sel; i++) { await page.mouse.dblclick(x, y); await raf(page); }  // B안: 더블클릭 진입
  expect((await mk(page)).sel, '[전제] 고르기').toBe(true);
  const b = await box(page, s.B);
  await drag(page, x, y, b.cx, b.cy);
  const a = await mk(page);
  expect(a.n).toBe(1); expect(a.par).toBe(s.B);
  expect(parseFloat(a.top), 'top').toBeGreaterThanOrEqual(0); expect(parseFloat(a.left), 'left').toBeGreaterThanOrEqual(0);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
test('음성 — 프레임 없는 섹션 자리에 놓으면 전처럼 섹션으로 빠진다', async ({ page }) => {
  const s = await scene(page, KINDS[1][1]); expect(await pick(page)).toBe(true);
  const w = await mk(page); const r = await box(page, s.R);
  await drag(page, w.x, w.y, r.r + 60, r.t + 40);
  const a = await mk(page);
  expect(a.n).toBe(1); expect(a.inSec, '섹션 직속').toBe(true);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
test('음성 — 묶음 위에 놓아도 묶음 안에 안 든다', async ({ page }) => {
  const s = await scene(page, KINDS[1][1]);
  await page.evaluate((B) => { const b = document.getElementById(B); b.dataset.group = 'true'; }, s.B);
  expect(await pick(page)).toBe(true);
  const w = await mk(page); const b = await box(page, s.B);
  await drag(page, w.x, w.y, b.cx, b.cy);
  const a = await mk(page);
  expect(a.n).toBe(1); expect(a.par, 'B 아님').not.toBe(s.B);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
