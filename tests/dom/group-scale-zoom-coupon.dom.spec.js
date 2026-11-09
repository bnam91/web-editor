/* group-scale-zoom-coupon.dom.spec.js — GROUP-SCALE-ZOOM-COUPON-01: ⌘G 묶음 손잡이로 늘린 확대블럭이 «다음 렌더»에 옛 크기로 튀었다
 *   (재현: 묶음 520×320 → 620×380 · 확대블럭 그린 상자 310×166 → renderZoomBlock 뒤 260×140, x·y 도 260,180 으로 되돌아감).
 * 뿌리: t2-02d 그라데이션과 같다 — 정본은 dataset(x·y·w·h)이고 renderZoomBlock 이 cssText 를 그 키로 다시 쓴다.
 *   고침 = window._scaleZoomFromSnap(js/blocks/zoom-block.js). 쿠폰은 재현 안 됨(손잡이가 dataset.width 를 이미 쓴다) → 안 고침 · 여기 없음.
 * 양성대조: 44bb93a8e 의 js 로 돌리면 Z1·Z2·Z3·Z4·F1 빨강. 고정 대기 0. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const HANDLE = (d) => `#ss-handles-overlay .ss-resize-handle.${d}`;
const mid = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, sel);

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
  await page.evaluate(() => {
    const sec = document.getElementById('sG');
    // ⚠️도형과 떨어뜨린다 — 확대블럭의 광원(12시 방향 170px)이 위를 덮어 도형 ⌘클릭을 가로챈다
    window.deselectAll(); window.selectSection(sec); window.addZoomBlock({ x: 300, y: 220 }); [...sec.querySelectorAll('.zoom-block')].pop().id = 'z1';
    window.deselectAll(); window.selectSection(sec); const b = new Set(sec.querySelectorAll('.shape-block')); window.addShapeBlock('rectangle');
    const sh = [...sec.querySelectorAll('.shape-block')].find((x) => !b.has(x)); sh.id = 'sh1';
    const shf = sh.closest('.frame-block'); shf.id = 'shf'; window.updateFrameBlock?.(shf.id, { width: 160, height: 100 });
    const p = window.OverlayFloat.posElOf(shf); window.OverlayFloat.enterFloat(p); p.style.left = '40px'; p.style.top = '40px'; p.dataset.offsetX = '40'; p.dataset.offsetY = '40';
    window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  });
  let [x, y] = await mid(page, '#z1'); await page.mouse.click(x, y);
  await page.keyboard.down('Meta'); [x, y] = await mid(page, '#sh1'); await page.mouse.click(x, y); await page.keyboard.up('Meta');
  await page.keyboard.press('Meta+g');
  await page.locator(HANDLE('se')).waitFor({ state: 'attached' });
  const ok = await page.evaluate(() => { const g = document.getElementById('z1').closest('[data-group="true"]'); return !!g && document.getElementById('shf').closest('[data-group="true"]') === g; });
  expect(ok, '[전제] 둘이 한 묶음').toBe(true);
  return errs;
}
async function drag(page, sel, dx, dy) {
  const [x, y] = await mid(page, sel);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.mouse.up();
}
/** 묶음 기준 그려진 상자 [left, top, w, h](줌 100) · 확대블럭 정본 키(테두리 끔 → 상자 = 도형) */
const read = (page) => page.evaluate(() => {
  const g = document.getElementById('z1').closest('[data-group="true"]'); const gr = g.getBoundingClientRect();
  const box = (e) => { const r = e.getBoundingClientRect(); return [r.left - gr.left, r.top - gr.top, r.width, r.height]; };
  const z = document.getElementById('z1'); const d = z.dataset; const { hw, hh } = { hw: z.offsetWidth / 2, hh: z.offsetHeight / 2 };
  return { g: [gr.width, gr.height], z1: box(z), shf: box(document.getElementById('shf')), d: [+d.x, +d.y, d.w ? +d.w : hw * 2, d.h ? +d.h : hh * 2] };
});
const rerender = (page) => page.evaluate(() => window.renderZoomBlock(document.getElementById('z1')));
function expectFollows(a, b, tag, ids = ['z1', 'shf']) {
  const sx = b.g[0] / a.g[0], sy = b.g[1] / a.g[1];
  for (const id of ids) [sx, sy, sx, sy].forEach((s, i) => expect(Math.abs(b[id][i] - a[id][i] * s), `${tag} ${id}[${i}] ${b[id][i]} vs ${a[id][i] * s}`).toBeLessThanOrEqual(1.5));
  if (ids.includes('z1')) b.d.forEach((v, i) => expect(Math.abs(v - b.z1[i]), `${tag} 정본 ${b.d} = 그린 상자 ${b.z1}`).toBeLessThanOrEqual(1.5));
}

for (const [n, dir, dx, dy] of [[1, 'se', 100, 60], [2, 'nw', -100, -60]]) {
  test(`Z${n} ${dir} 손잡이 ${dx},${dy} — 강제 다시 그린 뒤에도 확대블럭이 묶음 비율대로`, async ({ page }) => {
    const errs = await grouped(page);
    const a = await read(page);
    await drag(page, HANDLE(dir), dx, dy);
    await rerender(page);
    const b = await read(page);
    console.log(`[Z${n}] ` + JSON.stringify({ a, b }));
    expect([b.g[0] - a.g[0], b.g[1] - a.g[1]], '묶음 +100,+60').toEqual([100, 60]);
    expectFollows(a, b, `Z${n}`);
    expect(errs).toEqual([]);
  });
}

test('Z3 ⌘Z 한 번이 정확히 되돌린다', async ({ page }) => {
  const errs = await grouped(page);
  const a = await read(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  let b;
  await expectOneUndoStep(page, async () => { await drag(page, HANDLE('se'), 100, 60); await rerender(page); b = await read(page); }, '묶음 손잡이 확대블럭');
  expectFollows(a, b, 'Z3 끈 뒤');
  expect(await read(page), '⌘Z 뒤 = 끌기 전').toEqual(a);
  expect(errs).toEqual([]);
});

test('Z4 저장 → 다시 열기 뒤 같은 상자', async ({ page }) => {
  const errs = await grouped(page);
  const a = await read(page);
  await drag(page, HANDLE('se'), 100, 60);
  const b = await read(page);
  await page.evaluate(async () => { window.deselectAll(); const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; await window.applyProjectData(d); });
  await page.waitForFunction(() => !!document.getElementById('z1')?.closest('[data-group="true"]'));
  const r = await read(page);
  expectFollows(a, r, 'Z4 다시 연 뒤');
  r.z1.forEach((v, i) => expect(Math.abs(v - b.z1[i]), `Z4 다시 열어도 끈 직후와 같다 ${r.z1} vs ${b.z1}`).toBeLessThanOrEqual(1.5));
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

test('F1 바닥 — 0.001 배로 줄여도 확대블럭 w·h = 8px · 1.5 배는 그대로(범위로 안 조임)', async ({ page }) => {
  const errs = await grouped(page);
  const r = await page.evaluate(() => {
    const z = document.getElementById('z1'); const d0 = { ...z.dataset }; const w0 = z.offsetWidth, h0 = z.offsetHeight;
    window._scaleZoomFromSnap(z, d0, 0.001, 0.001);
    const a = { w: z.dataset.w, h: z.dataset.h, rw: z.offsetWidth, rh: z.offsetHeight };
    window._scaleZoomFromSnap(z, d0, 1.5, 1.5);
    return { a, b: { w: z.dataset.w, h: z.dataset.h }, w0, h0 };
  });
  expect(r.a, JSON.stringify(r)).toEqual({ w: '8', h: '8', rw: 8, rh: 8 });
  expect(r.b, JSON.stringify(r)).toEqual({ w: String(Math.round(r.w0 * 1.5)), h: String(Math.round(r.h0 * 1.5)) });
  expect(errs).toEqual([]);
});
