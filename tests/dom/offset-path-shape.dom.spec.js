/* offset-path-shape — 0.9.13 77 t13B-04 Offset Path 1차(현빈 261119 ⓑ 일러 꼴 · 지디 261125 R2 ⓐ·R3) · 셈 = js/offset-path-geom.js · 몸 = js/offset-path.js · 입구 = 도형 패널 «Offset Path» 절
 * O1 떠 있는 사각 · 거리 10 · Round → 새 도형 하나 · 원본 outerHTML 무변 · 새 상자 = 원본 +20 · 자리 = 원본 −10 · 반경 10 · 원본 «바로 앞»(= 한 층 아래) · 새 것이 골라짐
 * O2 ⌘Z 한 번 = 새 도형만 사라짐(원본 그대로)
 * O3 Miter = 반경 0(뾰족 그대로) · 원 = 상자 ±2d
 * O4 [양성] 거리 20 = 상자가 O1 보다 20 더 큼(시험이 거리를 실제로 읽는 증명)
 * O5 흐름 안 도형 = 새 도형 0 · «먼저 Ignore Auto Layout» 알림 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, { type = 'rectangle', float = true } = {}) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ({ type, float }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); sec.id = 'sO'; window.applyZoom?.(100);
    window.deselectAll(); window.selectSection(sec); window.addShapeBlock(type);
    const shp = [...sec.querySelectorAll('.shape-block')].pop(), wr = shp.parentElement; shp.id = 'oS'; wr.id = 'oW';
    if (float) { const p = window.OverlayFloat.posElOf(shp) || wr; window.OverlayFloat.enterFloat(p); }
    window.__toasts = []; const t = window.showToast; window.showToast = (m, ...a) => { window.__toasts.push(String(m)); return t?.(m, ...a); };
    window.deselectAll(); window.selectBlock('oS'); window.showShapeProperties(shp); window.clearHistory?.();
  }, { type, float });
  await waitZoomSettled(page, 100); await raf(page);
  return errs;
}
const unitOf = (id) => `(document.getElementById('${id}').parentElement.matches('.frame-block') ? document.getElementById('${id}').parentElement : document.getElementById('${id}'))`;
const st = (page) => page.evaluate(() => {
  const o = document.getElementById('oS'), ou = o.parentElement;
  const shapes = [...document.querySelectorAll('#sO .shape-block')];
  const n = shapes.find((s) => s !== o), nu = n?.parentElement;
  const box = (u) => u && { w: u.offsetWidth, h: u.offsetHeight, x: Number(u.dataset.offsetX ?? parseFloat(u.style.left)), y: Number(u.dataset.offsetY ?? parseFloat(u.style.top)), r: u.dataset.radius ?? null };
  return { count: shapes.length, o: box(ou), n: box(nu), nBefore: !!nu && nu.nextElementSibling === ou, nSel: !!n?.classList.contains('selected'), oHtml: (() => { const k = ou.cloneNode(true); k.querySelectorAll('[data-corner], [data-dir]').forEach((h) => h.remove()); return k.outerHTML.replace(/ class="[^"]*"/g, ''); })(), toasts: window.__toasts.slice() };
});
async function apply(page, d, join) {
  await page.waitForSelector('#shape-offset-apply', { state: 'attached' });
  await page.fill('#shape-offset-d', String(d));
  if (join) await page.selectOption('#shape-offset-join', join);
  await page.locator('#shape-offset-apply').scrollIntoViewIfNeeded(); await page.click('#shape-offset-apply'); await raf(page);
}

test('O1·O2 떠 있는 사각 Round 10 → 새 도형(원본 무변 · +20 · −10 · 반경 10 · 한 층 아래 · 골라짐) · ⌘Z 한 번 = 새 것만 빠짐', async ({ page }) => {
  const errs = await scene(page);
  const a = await st(page);
  expect([a.count, a.o.x != null], '[전제] 떠 있는 사각 하나').toEqual([1, true]);
  await apply(page, 10, 'round');
  const b = await st(page);
  console.log('[77 O1 실측]', JSON.stringify({ a: a.o, b: { o: b.o, n: b.n, nBefore: b.nBefore, nSel: b.nSel, count: b.count } }));
  expect(b.count, '★새 도형 하나').toBe(2);
  expect(b.oHtml, '★원본 무변').toBe(a.oHtml);
  expect([b.n.w, b.n.h, b.n.x, b.n.y, b.n.r], '★상자 +20 · 자리 −10 · 반경 10').toEqual([a.o.w + 20, a.o.h + 20, a.o.x - 10, a.o.y - 10, '10']);
  expect([b.nBefore, b.nSel], '★원본 바로 앞(한 층 아래) · 새 것이 골라짐').toEqual([true, true]);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await raf(page);
  const c = await st(page);
  expect([c.count, c.oHtml], '★⌘Z 한 번 = 새 도형만 빠짐').toEqual([1, a.oHtml]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('O3 Miter = 반경 0 · 원 = 상자 ±2d', async ({ page }) => {
  const errs = await scene(page);
  const a = await st(page);
  await apply(page, 10, 'miter');
  const b = await st(page);
  expect([b.n.w, b.n.r], '★Miter = 반경 키 없음(뾰족)').toEqual([a.o.w + 20, null]);
  const errs2 = await scene(page, { type: 'ellipse' });
  const e0 = await st(page);
  await apply(page, 6);
  const e1 = await st(page);
  expect([e1.n.w, e1.n.h, e1.n.x, e1.n.y], '★원 = ±2d · −d').toEqual([e0.o.w + 12, e0.o.h + 12, e0.o.x - 6, e0.o.y - 6]);
  expect([...errs, ...errs2], [...errs, ...errs2].join(' | ')).toEqual([]);
});

test('O4 [양성] 거리 20 = 상자가 거리 10 보다 20 더 큼', async ({ page }) => {
  await scene(page);
  const a = await st(page);
  await apply(page, 20, 'round');
  const b = await st(page);
  expect([b.n.w - a.o.w, b.n.h - a.o.h], '★거리를 실제로 읽음(+40)').toEqual([40, 40]);
});

test('O5 흐름 안 도형 = 새 도형 0 · «먼저 Ignore Auto Layout» 알림', async ({ page }) => {
  const errs = await scene(page, { float: false });
  await apply(page, 10, 'round');
  const b = await st(page);
  expect(b.count, '★새 도형 없음').toBe(1);
  expect(b.toasts.some((t) => t.includes('Ignore Auto Layout')), `★알림 ${JSON.stringify(b.toasts)}`).toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});
