/* group-scale-vector.dom.spec.js — VECTOR-GROUP-SCALE-SNAP-CHECK-01: ⌘G 묶음 손잡이로 늘린 벡터가 «다음 렌더»에 옛 크기로 튀나.
 * 뿌리(코드 읽기): 벡터 크기 정본은 dataset.w·h 이고 renderVector 가 style.width·height 를 그 키로 다시 쓴다.
 *   묶음 손잡이의 바닥 길은 style 만 늘려 dataset.w·h 가 옛 값 그대로 → 다시 그리면 튄다(줌 GROUP-SCALE-ZOOM-COUPON-01 과 같은 꼴).
 *   고침 = window._scaleVectorFromSnap(js/blocks/vector-block.js) + overlay-handles.js 스냅·틱 한 줄씩. 바닥 8px · 범위로 안 조임.
 * 장면은 group-scale-zoom-coupon 과 같다: 진짜 ⌘G(클릭 + ⌘클릭 + Meta+g) · 떠 있는 도형 · 손잡이 끌기 · 다시 그리기 · 저장 왕복.
 * 양성대조: 03bbdd494 의 js/blocks/vector-block.js js/overlay-handles.js 로 돌리면 V1·V2·V3·F1 빨강 예상(V4 는 다시 열 때 renderVector 를 타는지에 달림). 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const HANDLE = (d) => `#ss-handles-overlay .ss-resize-handle.${d}`;
const mid = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, sel);
/* 진짜 내용 든 벡터 — 칠한 도형 셋(색 치환 대상 포함) */
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80"><rect x="4" y="4" width="50" height="30" fill="black"/><circle cx="90" cy="40" r="24" fill="#000000"/><path d="M10 70 L60 50 L110 70 Z" fill="currentColor"/></svg>';

async function grouped(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = [...c.querySelectorAll('.section-block')].pop(); sec.id = 'sG';
    sec.querySelector('.section-inner').insertAdjacentHTML('beforeend', '<div class="gap-block" id="gbG" data-type="gap" style="height:500px"></div>');
    window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  await page.evaluate((svg) => {
    const sec = document.getElementById('sG');
    window.deselectAll(); window.selectSection(sec);
    const vb = window.addVectorBlock(svg, { w: 180, h: 120, color: '#3366cc', label: '벡터' }); vb.id = 'v1';
    const vp = window.OverlayFloat.posElOf(vb); window.OverlayFloat.enterFloat(vp); vp.style.left = '300px'; vp.style.top = '220px'; vp.dataset.offsetX = '300'; vp.dataset.offsetY = '220';
    window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll('.shape-block')); window.addShapeBlock('rectangle');
    const sh = [...sec.querySelectorAll('.shape-block')].find((x) => !b.has(x)); sh.id = 'sh1';
    const shf = sh.closest('.frame-block'); shf.id = 'shf'; window.updateFrameBlock?.(shf.id, { width: 160, height: 100 });
    const p = window.OverlayFloat.posElOf(shf); window.OverlayFloat.enterFloat(p); p.style.left = '40px'; p.style.top = '40px'; p.dataset.offsetX = '40'; p.dataset.offsetY = '40';
    window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  }, SVG);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('v1')).position), '[전제] 벡터가 떠 있다').toBe('absolute');
  let [x, y] = await mid(page, '#v1'); await page.mouse.click(x, y);
  await page.keyboard.down('Meta'); [x, y] = await mid(page, '#sh1'); await page.mouse.click(x, y); await page.keyboard.up('Meta');
  await page.keyboard.press('Meta+g');
  await page.locator(HANDLE('se')).waitFor({ state: 'attached' });
  const ok = await page.evaluate(() => { const g = document.getElementById('v1').closest('[data-group="true"]'); return !!g && document.getElementById('shf').closest('[data-group="true"]') === g; });
  expect(ok, '[전제] 둘이 한 묶음').toBe(true);
  return errs;
}
async function drag(page, sel, dx, dy) {
  const [x, y] = await mid(page, sel);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}
/** 묶음 기준 그려진 상자 [left, top, w, h](줌 100) · 벡터 정본 키 [offsetX, offsetY, w, h] */
const read = (page) => page.evaluate(() => {
  const g = document.getElementById('v1').closest('[data-group="true"]'); const gr = g.getBoundingClientRect();
  const box = (e) => { const r = e.getBoundingClientRect(); return [r.left - gr.left, r.top - gr.top, r.width, r.height]; };
  const v = document.getElementById('v1'); const d = v.dataset;
  return { g: [gr.width, gr.height], v1: box(v), shf: box(document.getElementById('shf')), d: [parseInt(v.style.left) || 0, parseInt(v.style.top) || 0, +d.w, +d.h], svg: !!v.querySelector('.vb-inner svg circle') };
});
const rerender = (page) => page.evaluate(() => window.renderVector(document.getElementById('v1')));
function expectFollows(a, b, tag, ids = ['v1', 'shf']) {
  const sx = b.g[0] / a.g[0], sy = b.g[1] / a.g[1];
  for (const id of ids) [sx, sy, sx, sy].forEach((s, i) => expect(Math.abs(b[id][i] - a[id][i] * s), `${tag} ${id}[${i}] ${b[id][i]} vs ${a[id][i] * s}`).toBeLessThanOrEqual(1.5));
  if (ids.includes('v1')) [2, 3].forEach((i) => expect(Math.abs(b.d[i] - b.v1[i]), `${tag} 정본 w·h ${b.d} = 그린 상자 ${b.v1}`).toBeLessThanOrEqual(1.5));
}

for (const [n, dir, dx, dy] of [[1, 'se', 100, 60], [2, 'nw', -100, -60]]) {
  test(`V${n} ${dir} 손잡이 ${dx},${dy} — 강제 다시 그린 뒤에도 벡터가 묶음 비율대로`, async ({ page }) => {
    const errs = await grouped(page);
    const a = await read(page);
    await drag(page, HANDLE(dir), dx, dy);
    await rerender(page);
    const b = await read(page);
    console.log(`[V${n}] ` + JSON.stringify({ a, b }));
    expect([b.g[0] - a.g[0], b.g[1] - a.g[1]], '묶음 +100,+60').toEqual([100, 60]);
    expectFollows(a, b, `V${n}`);
    expect(b.svg, '그림 내용 그대로').toBe(true);
    expect(errs).toEqual([]);
  });
}

test('V3 ⌘Z 한 번이 정확히 되돌린다', async ({ page }) => {
  const errs = await grouped(page);
  const a = await read(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  let b;
  await expectOneUndoStep(page, async () => { await drag(page, HANDLE('se'), 100, 60); await rerender(page); b = await read(page); }, '묶음 손잡이 벡터');
  expectFollows(a, b, 'V3 끈 뒤');
  expect(await read(page), '⌘Z 뒤 = 끌기 전').toEqual(a);
  expect(errs).toEqual([]);
});

test('V4 저장 → 다시 열기 뒤 같은 상자', async ({ page }) => {
  const errs = await grouped(page);
  const a = await read(page);
  await drag(page, HANDLE('se'), 100, 60);
  const b = await read(page);
  await page.evaluate(async () => { window.deselectAll(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; await window.applyProjectData(d); });
  await page.waitForFunction(() => !!document.getElementById('v1')?.closest('[data-group="true"]'));
  await rerender(page);   // 다시 연 뒤 첫 렌더(속성 패널·펜 편집이 부르는 것)
  const r = await read(page);
  expectFollows(a, r, 'V4 다시 연 뒤');
  r.v1.forEach((v, i) => expect(Math.abs(v - b.v1[i]), `V4 다시 열어도 끈 직후와 같다 ${r.v1} vs ${b.v1}`).toBeLessThanOrEqual(1.5));
  expect(errs).toEqual([]);
});

test('C1 [대조] 같은 묶음의 도형은 바닥 길 그대로 비율대로', async ({ page }) => {
  const errs = await grouped(page);
  const a = await read(page);
  await drag(page, HANDLE('se'), 100, 60);
  await rerender(page);
  const b = await read(page);
  expectFollows(a, b, 'C1', ['shf']);
  expect(errs).toEqual([]);
});

test('F1 바닥 — 0.001 배로 줄여도 벡터 w·h = 8px · 50 배는 그대로(범위 4000 으로 안 조임)', async ({ page }) => {
  const errs = await grouped(page);
  const r = await page.evaluate(() => {
    const v = document.getElementById('v1'); const d0 = { ...v.dataset }; const L = parseInt(v.style.left) || 0, T = parseInt(v.style.top) || 0;
    window._scaleVectorFromSnap(v, d0, 0.001, 0.001, L, T);
    const a = { w: v.dataset.w, h: v.dataset.h, rw: v.offsetWidth, rh: v.offsetHeight };
    window._scaleVectorFromSnap(v, d0, 50, 50, L, T);
    return { a, b: { w: v.dataset.w, h: v.dataset.h }, w0: +d0.w, h0: +d0.h };
  });
  expect(r.a, JSON.stringify(r)).toEqual({ w: '8', h: '8', rw: 8, rh: 8 });
  expect(r.b, JSON.stringify(r)).toEqual({ w: String(r.w0 * 50), h: String(r.h0 * 50) });
  expect(errs).toEqual([]);
});
