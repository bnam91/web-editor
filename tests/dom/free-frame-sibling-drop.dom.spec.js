/* free-frame-sibling-drop — FREE-FRAME-SIBLING-DROP-A-01 (현빈 ⓐ 피그마식 · 0.9.11): 자유 프레임 R 안 자식 프레임 Z 를 끌어 «같은 R 안 형제 프레임» 위에 놓으면 그 안으로 든다.
 *   현빈 실앱: ss_bm4m9_0zktntz 를 ss_bm4m9_fh1q8kw 안으로 옮긴 뒤 같은 fh 안 빈 자유 프레임 ss_bm4m9_72pbzds 로 끌면 점선도 안 뜨고 안 들어갔다(겹쳐 놓일 뿐).
 *   뿌리: js/block-drag.js _frameOutsideParentAt — 커서가 부모 «밖»일 때만 표적을 찾았다(가이드도 같은 조건).
 *   W1 자유 형제 T 위 — 끄는 동안 T 점선(ss-drag-over) · 놓으면 Z ⊂ T · absolute · 화면 자리 그대로(±1px) · 기준판 빨강
 *   W2 ⌘Z 한 번 → Z 는 R 안 처음 자리 · W3 저장 왕복(serialize→apply) 뒤에도 Z ⊂ T
 *   W4 쌓기 형제 P 위 — 기존 쌓기 넣기 규칙(흐름 자식 · position 비움) · 끄는 동안 P 점선 + 표시선 · 기준판 빨강
 *   N1 [대조] R 안 빈 곳 — 점선 0 · Z ⊂ R 그대로 좌표만 · N2 [대조·순환] T 를 골라 Q 자리를 잡고 끌기 — 자기·자손 점선 0 · T⊂R·Q⊂T
 * ★양성대조: _frameOutsideParentAt 의 «부모 안» 줄을 옛 `return null` 로 되돌리면 W1·W2·W3·W4 빨강 · N1·N2 초록.
 * 하네스 = nested-frame-to-frame 꼴(장면만 evaluate · 끌기는 진짜 마우스 · 고르기는 B안 더블클릭). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const STEPS = 12;
const FR = '.frame-block:not([data-text-frame])';
const reopen = async (page) => { await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); }); await raf(page); };
async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1600 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (FR) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block');
    const mk = (par, w, h, l, t) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.updateFrameBlock(f.id, { width: w, height: h }); if (par) { f.style.left = l + 'px'; f.style.top = t + 'px'; f.dataset.offsetX = l; f.dataset.offsetY = t; } window.deselectAll(); window._activeFrame = null; return f.id; };
    const R = mk(null, 1000, 900);
    const Z = mk(R, 160, 80, 40, 40); const T = mk(R, 400, 300, 40, 200); const Q = mk(T, 120, 80, 20, 20); const P = mk(R, 400, 300, 500, 200);
    return { R, Z, T, Q, P }; }, FR);
  await page.evaluate((id) => window.__convertFreeLayoutToStack(document.getElementById(id)), ids.P);
  await reopen(page);
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), ids.R); await raf(page);
  return { errs, ...ids };
}
const box = (page, id) => page.evaluate(({ id, FR }) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, sel: e.classList.contains('selected'), par: e.parentElement.closest(FR)?.id || null, pos: e.style.position, sl: e.style.left, st: e.style.top }; }, { id, FR });
const pick = async (page, id) => { await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; window._enteredFrame = null; }); for (let i = 0; i < 6; i++) { const q = await box(page, id); if (q.sel) return true; await page.mouse.dblclick(q.x, q.y); await raf(page); } return (await box(page, id)).sel; };
/* 놓기 직전 점선·표시선과 끌던 것의 화면 자리를 재고 놓는다 */
async function drag(page, id, from, to) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  for (let i = 1; i <= STEPS; i++) { await page.mouse.move(from.x + (to.x - from.x) * i / STEPS, from.y + (to.y - from.y) * i / STEPS); await raf(page); }
  const during = await page.evaluate(() => ({ over: [...document.querySelectorAll('.ss-drag-over')].map((e) => e.id), ind: document.querySelectorAll('.drop-indicator').length }));
  const pre = await box(page, id);
  await page.mouse.up(); await raf(page);
  return { during, pre, post: await box(page, id), left: await page.evaluate(() => document.querySelectorAll('.ss-drag-over, .drop-indicator').length) };
}

test('W1·W2 자유 형제 프레임 위에 놓으면 그 안으로 — 화면 자리 그대로 · ⌘Z 한 번', async ({ page }) => {
  const s = await scene(page);
  expect(await pick(page, s.Z), '[전제] 고르기').toBe(true);
  const z0 = await box(page, s.Z), t = await box(page, s.T);
  const r = await drag(page, s.Z, z0, { x: t.x + 60, y: t.y + 40 });
  expect(r.during.over, '★끄는 동안 형제 T 에 점선이 없다').toEqual([s.T]);
  expect({ par: r.post.par, pos: r.post.pos }, '★형제 프레임 위에 놓았는데 안 들어갔다').toEqual({ par: s.T, pos: 'absolute' });
  expect(Math.abs(r.post.l - r.pre.l), `화면 x ${r.pre.l}→${r.post.l}`).toBeLessThanOrEqual(1);
  expect(Math.abs(r.post.t - r.pre.t), `화면 y ${r.pre.t}→${r.post.t}`).toBeLessThanOrEqual(1);
  expect(r.left, '놓은 뒤 가이드가 남았다').toBe(0);
  await page.keyboard.press('Meta+z'); await raf(page);
  const u = await box(page, s.Z);
  expect({ par: u.par, sl: u.sl, st: u.st }, '⌘Z 한 번에 처음으로').toEqual({ par: s.R, sl: z0.sl, st: z0.st });
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('W3 저장 왕복 — 형제 안으로 넣은 뒤 다시 열어도 Z ⊂ T · 같은 자리', async ({ page }) => {
  const s = await scene(page);
  expect(await pick(page, s.Z)).toBe(true);
  const t = await box(page, s.T);
  const r = await drag(page, s.Z, await box(page, s.Z), { x: t.x + 60, y: t.y + 40 });
  expect(r.post.par, '[전제]').toBe(s.T);
  await reopen(page);
  const z = await box(page, s.Z);
  expect({ par: z.par, sl: z.sl, st: z.st }, '저장 왕복 뒤').toEqual({ par: s.T, sl: r.post.sl, st: r.post.st });
});

test('W4 쌓기 형제 프레임 위 — 기존 쌓기 넣기 규칙(흐름 자식)', async ({ page }) => {
  const s = await scene(page);
  expect(await pick(page, s.Z)).toBe(true);
  const r = await drag(page, s.Z, await box(page, s.Z), await box(page, s.P));
  expect(r.during.over, '★끄는 동안 쌓기 형제 P 에 점선이 없다').toEqual([s.P]);
  expect(r.during.ind, '쌓기는 표시선도').toBeGreaterThan(0);
  expect({ par: r.post.par, pos: r.post.pos }, '★쌓기 형제 위에 놓았는데 안 들어갔다').toEqual({ par: s.P, pos: '' });
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('N1 [대조] 부모 안 빈 곳에 놓으면 지금처럼 그 부모 안 좌표 이동', async ({ page }) => {
  const s = await scene(page);
  expect(await pick(page, s.Z)).toBe(true);
  const z0 = await box(page, s.Z);
  const r = await drag(page, s.Z, z0, { x: z0.x + 200, y: z0.y + 20 });
  expect(r.during).toEqual({ over: [], ind: 0 });
  expect(r.post.par).toBe(s.R);
  expect(parseFloat(r.post.sl)).toBeGreaterThan(parseFloat(z0.sl));
});

test('N2 [대조·순환] T 를 골라 제 자식 Q 자리를 잡고 끌어도 순환이 안 생긴다(자기·자손은 표적 아님)', async ({ page }) => {
  const s = await scene(page);
  expect(await pick(page, s.T)).toBe(true);
  const q = await box(page, s.Q);
  const r = await drag(page, s.T, q, { x: q.x + 90, y: q.y + 70 });
  expect(r.during.over, '끄는 동안 자기·자손에 점선').not.toContain(s.T);
  expect(r.during.over).not.toContain(s.Q);
  const g = await page.evaluate(({ T, Q }) => ({ tIn: document.getElementById(T).parentElement.closest('.frame-block')?.id, qIn: document.getElementById(Q).parentElement.closest('.frame-block')?.id, cyc: document.getElementById(Q).contains(document.getElementById(T)) }), s);
  expect(g).toEqual({ tIn: s.R, qIn: s.T, cyc: false });
});
