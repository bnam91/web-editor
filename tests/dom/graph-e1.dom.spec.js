/* graph-e1.dom.spec.js — 묶음 E1 그래프 둘 (태양 lane-e1-plus 2026-10-05)
 *   H1 세로·비교 막대 두께 상한 = «그 막대가 선 칸의 폭»(GRAPH_LIMITS.BAR_THICKNESS_V_MAX 'column') — 옛: 60.
 *     실측(실앱 d1f642ff, $S/e1/real/h1.json): 5항목 860 블럭 칸 127 · 두께 120→막대 120 · 200→127 · 1000→127(렌더 max-width:100%) · 넘침·겹침 0.
 *   H7 격자선 색 칸 — 비우면 옛 그대로(currentColor × 0.2 · 옛 그래프 무변) · 고르면 그 색.
 * 순서 = 실앱 순서: 그래프를 진짜 클릭으로 고른다 → 패널 칸에 친다/고른다.
 * 양성대조: d1f642ff 나무 안 → T1 T2 T3 C1 C2 빨강 · T4 초록 (predict: $S/e1/predict.md).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-e1.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function setup(page, opts = {}) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  const id = await page.evaluate((opts) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    window.selectSection(document.getElementById('sG')); window.addGraphBlock(opts);
    const g = [...document.querySelectorAll('#sG .graph-block')].pop(); window.deselectAll?.(); g.scrollIntoView({ block: 'center' }); return g.id;
  }, opts);
  return { errs, id };
}
async function pick(page, id) {
  const r = await waitStableRect(page, `#${id}`);
  await clickAt(page, r.left + r.width * 0.1, r.top + 10, { sel: `[id="${id}"]` }, { label: '그래프 고르기' });
  await page.waitForFunction(() => !!document.getElementById('grb-bar-thickness-number'), null, { timeout: 3000 });
}
const colW = (page, id) => page.evaluate((id) => { const f = document.querySelector(`#${id} .grb-bar-fill`); return Math.floor(f.parentElement.clientWidth); }, id);
const barW = (page, id) => page.evaluate((id) => Math.round(document.querySelector(`#${id} .grb-bar-fill`).offsetWidth), id);
async function typeThickness(page, v) {
  await page.fill('#grb-bar-thickness-number', String(v));
  await page.dispatchEvent('#grb-bar-thickness-number', 'change');
}

test('T1 ★H1 — 세로 막대 패널 두께 상한 = 칸 폭(옛 60)', async ({ page }) => {
  const { errs, id } = await setup(page);
  await pick(page, id);
  const cw = await colW(page, id);
  expect(cw, '전제 — 칸이 60 보다 넓다').toBeGreaterThan(60);
  expect(await page.evaluate(() => [document.getElementById('grb-bar-thickness-slider').max, document.getElementById('grb-bar-thickness-number').max]), `★max = 칸 폭 ${cw}`).toEqual([String(cw), String(cw)]);
  expect(errs).toEqual([]);
});
test('T2 ★H1 — 칸 폭보다 큰 수 → 칸 폭으로 잘린다 · 막대 = 칸 폭(넘침 0)', async ({ page }) => {
  const { errs, id } = await setup(page);
  await pick(page, id);
  const cw = await colW(page, id);
  await typeThickness(page, cw + 40);
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.vBarThickness, id)).toBe(String(cw));
  expect(await barW(page, id), '★막대 = 칸 폭').toBe(cw);
  expect(errs).toEqual([]);
});
test('T3 ★H1 — 60 과 칸 폭 사이(100) → 그대로 100 · 막대 100(옛: 60 으로 잘림)', async ({ page }) => {
  const { errs, id } = await setup(page);
  await pick(page, id);
  expect(await colW(page, id), '전제 — 칸 > 100').toBeGreaterThan(100);
  await typeThickness(page, 100);
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.vBarThickness, id)).toBe('100');
  expect(await barW(page, id)).toBe(100);
  expect(errs).toEqual([]);
});
test('T4 지킴 — 가로 막대 두께 상한 60 그대로', async ({ page }) => {
  const { errs, id } = await setup(page, { chartType: 'bar-h' });
  await pick(page, id);
  expect(await page.evaluate(() => document.getElementById('grb-bar-thickness-number').max)).toBe('60');
  expect(errs).toEqual([]);
});

async function gridOn(page) {
  const r = await waitStableRect(page, '#grb-show-grid + .prop-toggle-track');
  await clickAt(page, r.cx, r.cy, { sel: '.prop-toggle' }, { label: '격자선 켜기' });
  await page.waitForFunction(() => document.getElementById('grb-show-grid').checked, null, { timeout: 3000 });
}
const gridLine = (page, id) => page.evaluate((id) => { const l = document.querySelector(`#${id} .grb-ov-grid`); return l && { stroke: l.getAttribute('stroke'), op: l.getAttribute('stroke-opacity'), key: document.getElementById(id).dataset.gridColor ?? null }; }, id);

test('C1 ★H7 — 격자선 켜기(색 안 고름) → 선은 옛 그대로(currentColor · 0.2) · 패널 「격자선 색」 = 블럭 글자색 · 20%', async ({ page }) => {
  const { errs, id } = await setup(page);
  await pick(page, id);
  await gridOn(page);
  await page.waitForFunction((id) => !!document.querySelector(`#${id} .grb-ov-grid`), id, { timeout: 3000 });
  expect(await gridLine(page, id), '★옛 꼴 그대로(키 없음)').toEqual({ stroke: 'currentColor', op: '0.2', key: null });
  await page.waitForFunction(() => !!document.getElementById('grb-grid-hex'), null, { timeout: 3000 }).catch(() => {});
  const f = await page.evaluate((id) => { const h = document.getElementById('grb-grid-hex'), a = document.getElementById('grb-grid-alpha');
    const m = (getComputedStyle(document.querySelector(`#${id} .grb-ov`)).color.match(/\d+/g) || []).slice(0, 3).map(x => (+x).toString(16).padStart(2, '0')).join('').toUpperCase();
    return { hex: h && h.value, alpha: a && a.value, ink: m }; }, id);
  expect(f.hex, `★패널 칸 있음 · 블럭 글자색 ${JSON.stringify(f)}`).toBe(f.ink);
  expect(f.alpha).toBe('20');
  expect(errs).toEqual([]);
});
test('C2 ★H7 — 패널 hex 에 FF0000 → 격자선 #ff0000 · 불투명 · 키 저장', async ({ page }) => {
  const { errs, id } = await setup(page);
  await pick(page, id);
  await gridOn(page);
  await page.waitForFunction(() => !!document.getElementById('grb-grid-hex'), null, { timeout: 3000 });
  await page.fill('#grb-grid-hex', 'FF0000');
  await page.press('#grb-grid-hex', 'Enter');
  await expect.poll(() => gridLine(page, id)).toMatchObject({ op: '1' });
  const g = await gridLine(page, id);
  expect(/^(#ff0000|rgba?\(255, ?0, ?0(, ?0?\.2)?\))$/i.test(g.stroke) || g.stroke.toLowerCase().startsWith('rgba(255, 0, 0'), `★선 색 ${JSON.stringify(g)}`).toBe(true);
  expect(g.key, '★키 저장').toBeTruthy();
  expect(errs).toEqual([]);
});
