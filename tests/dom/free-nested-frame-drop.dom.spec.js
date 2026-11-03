/* free-nested-frame-drop — 자유 프레임 R 안 자식 프레임은 놓는 자리다. 겹쳐서 R 이 자유로 남은 장면에서 스택 A 안 블럭을 끌어도 R 로 안 빠진다(S6 챗).
 * 칸: 종류 넷 × 변환 직후·다시 연 판 × 제자리 근처(A)·B 로(B 안). 음성: 안 겹쳐 R 도 스택이면 그대로 · 묶음 안 자식 프레임은 놓는 자리가 안 된다.
 * 양성대조: bindFrameDropZone 의 absolute 갈래 묶기를 빼면 8+8 칸 빨강(블럭이 R 로 absolute), 음성 초록. 조커 칸은 조커 갈래의 bindPlacementDrag 를 빼면 빨강. 장면 준비만 evaluate — 고르기·끌기는 진짜 마우스. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FR = '.frame-block:not([data-text-frame])';
const STEPS = 12;
const reopen = (page) => page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
async function scene(page, add, { overlap = true } = {}) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async (FR) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.__sec = sec.id;
    const mk = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; const b = new Set(sec.querySelectorAll(FR)); window.addFrameBlock(); const f = [...sec.querySelectorAll(FR)].find((x) => !b.has(x)); window.deselectAll(); window._activeFrame = null; return f.id; };
    const R = mk(); const A = mk(R); const B = mk(R);
    for (const [i, w, h] of [[R, 1000, 1000], [A, 800, 260], [B, 800, 260]]) window.updateFrameBlock(i, { width: w, height: h });
    for (const [i, l, t] of [[A, 20, 20], [B, 20, 700]]) { const f = document.getElementById(i); f.style.left = l + 'px'; f.style.top = t + 'px'; f.dataset.offsetX = l; f.dataset.offsetY = t; }
    return { R, A, B }; }, FR);
  await reopen(page); await raf(page);
  await page.evaluate(async ({ ids, add }) => { const sec = document.getElementById(window.__sec); const before = new Set(document.querySelectorAll(add.sel)); window.deselectAll(); window.selectSection(sec); window._activeFrame = document.getElementById(ids.A); await window[add.fn](...(add.arg ? [add.arg] : [])); const e = [...document.querySelectorAll(add.sel)].find((x) => !before.has(x)); e.dataset.mk = '1'; window.deselectAll(); window._activeFrame = null; }, { ids, add });
  await reopen(page); await raf(page);
  await page.evaluate(({ ids, overlap }) => { for (const n of ['A', 'B']) window.__convertFreeLayoutToStack(document.getElementById(ids[n]));
    if (overlap) { const a = document.getElementById(ids.A), b = document.getElementById(ids.B); const t = a.offsetTop + a.offsetHeight - 8; b.style.top = t + 'px'; b.dataset.offsetY = t; }
    window.__convertFreeLayoutToStack(document.getElementById(ids.R)); }, { ids, overlap });
  await raf(page);
  return { errs, ...ids };
}
const mk = (page) => page.evaluate((FR) => { const e = document.querySelector('#canvas [data-mk]'); const r = e.getBoundingClientRect(); const u = e.closest('.frame-block[data-text-frame]') || e.closest('.row') || e; return { n: document.querySelectorAll('#canvas [data-mk]').length, x: r.left + r.width / 2, y: r.top + r.height / 2, par: e.parentElement.closest(FR)?.id, sel: e.classList.contains('selected'), pos: u.style.position }; }, FR);
const frameBox = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, free: document.getElementById(id).dataset.freeLayout }; }, id);
/* 겹침으로 가운데가 B 밑일 수 있어(큰 에셋) 위쪽 보이는 자리를 누른다 */
const spot = (page) => page.evaluate(() => { const e = document.querySelector('#canvas [data-mk]'); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); for (const b of [0.5, 0.3, 0.15, 0.05]) { const x = q.left + q.width / 2, y = q.top + q.height * b; const t = document.elementFromPoint(x, y); if (!t?.closest('.frame-block') || t.closest('.frame-block').contains(e) || e.contains(t)) return [x, y]; } return [q.left + q.width / 2, q.top + 2]; });
const pick = async (page) => { await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; window._enteredFrame = null; }); for (let i = 0; i < 6; i++) { if ((await mk(page)).sel) return true; const [x, y] = await spot(page); await page.mouse.click(x, y); await raf(page); } return (await mk(page)).sel; };
async function drag(page, x, y, tx, ty) { await page.mouse.move(x, y); await page.mouse.down(); for (let i = 1; i <= STEPS; i++) { await page.mouse.move(x + (tx - x) * i / STEPS, y + (ty - y) * i / STEPS); await raf(page); } await page.mouse.up(); await raf(page); }
const KINDS = [['챗', { sel: '.chat-block', fn: 'addChatBlock' }], ['글자', { sel: '.text-block', fn: 'addTextBlock', arg: 'body' }], ['에셋', { sel: '.asset-block', fn: 'addAssetBlock' }], ['쿠폰', { sel: '.coupon-block', fn: 'addCouponBlock' }]];

for (const [name, add] of KINDS) for (const opened of [false, true]) {
  const label = `${name} ${opened ? '다시 연 판' : '변환 직후'}`;
  test(`${label} — 제자리 근처면 A 에 남는다`, async ({ page }) => {
    const s = await scene(page, add); if (opened) { await reopen(page); await raf(page); }
    expect((await frameBox(page, s.R)).free, '[전제] 겹쳐서 R 은 자유로 남는다').toBe('true');
    expect(await pick(page), '[전제] 고르기').toBe(true);
    const [x, y] = await spot(page); const a = await frameBox(page, s.A);
    await drag(page, x, y, Math.min(x + 40, a.r - 4), Math.min(y + 30, a.b - 14));
    const m = await mk(page);
    expect(m.n, '사본·유실 없음').toBe(1); expect(m.par, 'A 그대로').toBe(s.A); expect(m.pos, 'absolute 로 안 바뀐다').not.toBe('absolute');
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
  test(`${label} — B 로 끌면 B 안에 들어간다`, async ({ page }) => {
    const s = await scene(page, add); if (opened) { await reopen(page); await raf(page); }
    expect(await pick(page), '[전제] 고르기').toBe(true);
    const [x, y] = await spot(page); const b = await frameBox(page, s.B), r = await frameBox(page, s.R);
    await drag(page, x, y, (b.l + b.r) / 2, Math.min(b.b, r.b) - 10);
    const m = await mk(page);
    expect(m.n, '사본·유실 없음').toBe(1); expect(m.par, 'B 안').toBe(s.B);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
/* 조커는 끌기 묶기 전에 돌아가 흐름에서 HTML5 끌기가 없었다 — 블럭은 그대로고 그릇 A 가 끌렸다 */
const JOKER = { sel: '.joker-block', fn: 'addJokerBlock' };
for (const opened of [false, true]) {
  const label = `조커 ${opened ? '다시 연 판' : '변환 직후'}`;
  test(`${label} — 제자리 근처면 A, draggable 이 산다`, async ({ page }) => {
    const s = await scene(page, JOKER); if (opened) { await reopen(page); await raf(page); }
    expect(await pick(page), '[전제] 고르기').toBe(true);
    expect(await page.evaluate(() => document.querySelector('#canvas [data-mk]').getAttribute('draggable'))).toBe('true');
    const [x, y] = await spot(page); const a = await frameBox(page, s.A);
    await drag(page, x, y, Math.min(x + 40, a.r - 4), Math.min(y + 30, a.b - 14));
    const m = await mk(page);
    expect(m.n).toBe(1); expect(m.par).toBe(s.A); expect(m.pos).not.toBe('absolute');
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
  test(`${label} — B 로 끌면 B 안에 들어간다`, async ({ page }) => {
    const s = await scene(page, JOKER); if (opened) { await reopen(page); await raf(page); }
    expect(await pick(page), '[전제] 고르기').toBe(true);
    const [x, y] = await spot(page); const b = await frameBox(page, s.B), r = await frameBox(page, s.R);
    await drag(page, x, y, (b.l + b.r) / 2, Math.min(b.b, r.b) - 10);
    const m = await mk(page);
    expect(m.n).toBe(1); expect(m.par).toBe(s.B);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}
test('음성 — 자유 프레임 안 absolute 조커는 그대로 좌표로 끌린다', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1400 }); const errs = await bootApp(page);
  const id = await page.evaluate(async (FR) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); const sec = c.querySelector('.section-block'); window.selectSection(sec); window.addFrameBlock(); const f = sec.querySelector(FR); window.updateFrameBlock(f.id, { width: 800, height: 400 }); window._activeFrame = f; window.addJokerBlock(); const j = f.querySelector('.joker-block'); j.dataset.mk = '1'; window.deselectAll(); window._activeFrame = null; return f.id; }, FR);
  await raf(page);
  expect(await pick(page), '[전제] 고르기').toBe(true);
  expect(await page.evaluate(() => document.querySelector('#canvas [data-mk]').getAttribute('draggable')), '좌표 끌기라 HTML5 는 꺼져 있다').not.toBe('true');
  const before = await mk(page); const fr0 = await frameBox(page, id);
  await drag(page, before.x, before.y, before.x + 40, before.y + 30);
  const after = await mk(page); const fr1 = await frameBox(page, id);
  /* 뜻은 «손을 따라온다»이다. 줌 40% 에서 좌표는 정수 레이아웃 px 로 저장된다(시작값 parseInt 1 + 끝값 Math.round 0.5 = 1.5 레이아웃 px = 화면 0.6px). 지디 판에서 40,29 가 1번 났다. 화면 1px 안이면 같은 자리다. */
  expect(Math.abs(after.x - before.x - 40), '블럭이 가로로 손을 따라온다').toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - before.y - 30), '블럭이 세로로 손을 따라온다').toBeLessThanOrEqual(1);
  expect([fr1.l, fr1.t], '프레임은 그대로').toEqual([fr0.l, fr0.t]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('음성 — 안 겹쳐 R 도 스택이면 제자리는 A, B 로 끌면 B 안', async ({ page }) => {
  const s = await scene(page, KINDS[0][1], { overlap: false });
  expect((await frameBox(page, s.R)).free, '[전제] R 도 스택').not.toBe('true');
  expect(await pick(page)).toBe(true);
  const [x, y] = await spot(page); const b = await frameBox(page, s.B);
  await drag(page, x, y, (b.l + b.r) / 2, b.b - 10);
  expect((await mk(page)).par).toBe(s.B);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
test('음성 — 묶음 안 자식 프레임과 오버레이는 놓는 자리가 안 된다', async ({ page }) => {
  const s = await scene(page, KINDS[0][1], { overlap: false });
  const bound = await page.evaluate(({ B }) => { const sec = document.getElementById(window.__sec); const g = document.createElement('div'); g.className = 'frame-block'; g.id = 'grp_x'; g.dataset.group = 'true'; g.dataset.freeLayout = 'true'; g.style.position = 'absolute'; const k = document.createElement('div'); k.className = 'frame-block'; k.id = 'kid_x'; k.style.position = 'absolute'; g.appendChild(k);
    const o = document.createElement('div'); o.className = 'frame-block'; o.id = 'ovl_x'; o.dataset.overlayBlock = 'true'; o.style.position = 'absolute'; const free = document.getElementById(B); free.dataset.freeLayout = 'true'; free.appendChild(o); sec.appendChild(g);
    window.bindFrameDropZone(g); window.bindFrameDropZone(k); window.bindFrameDropZone(o); return [g._flowDropBound, k._flowDropBound, o._flowDropBound]; }, s);
  expect(bound.map(Boolean)).toEqual([false, false, false]);
});
