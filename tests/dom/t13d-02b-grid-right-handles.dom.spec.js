/* t13d-02b — 0.9.13 t13D-02 옵션①(현빈 261121): 1행 그리드에서도 오른쪽 손잡이(ne·e·se)를 잡을 수 있게 — 오른쪽 ＋ 를 오른쪽 변 «바깥»으로 비킴
 * 고침: grid-block.js _placeGridAddBtns — 오른쪽 ＋ 왼쪽 끝 = 손잡이 상자(gridVisualBox) 오른쪽 끝 + GRID_PLUS_EDGE_CLEAR(6 화면 px)
 *   (옛 H10: ＋ 중심 = 블럭 오른쪽 끝 → 반이 안쪽이라 1행이면 ne·e·se 를 덮고 P4 ⒜ 가 그 셋을 숨겼다 · 2행이면 e 를 숨겼다)
 * Q1 1행·2행 — ne·e·se 가 보이고 · 오른쪽 ＋ 와 겹친 넓이 0 · 그 손잡이 중심의 임자 = 그 손잡이
 * Q2 1행·2행 — e 손잡이 진짜 끌기 −100 → 폭 −100
 * Q3 1행·2행 — 오른쪽 ＋ 진짜 클릭 → 열 +1(그대로)
 * 양성대조: _patches/t13d-02b-CTL-plus-out.patch(grid-block.js 옛 자리) → Q1·Q2 빨강 · Q3 초록.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

async function scene(page, rows) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); c.querySelector('.section-block').id = 'sQ'; window.applyZoom?.(100); });
  await waitZoomSettled(page, 100);
  await page.evaluate((rows) => {
    const sec = document.getElementById('sQ'); document.getElementById('canvas-wrap').scrollTop = 0; sec.scrollIntoView({ block: 'start' });
    window.deselectAll(); window.selectSection(sec); document.getElementById('fp-grid-btn').click();
    const g = sec.querySelector('.grid-block'); g.id = 'grdQ';
    for (let i = 1; i < rows; i++) window.gridAddAtEnd(g, 'row');
  }, rows);
  await page.waitForFunction(() => document.getElementById('grdQ')?.classList.contains('selected') && document.querySelectorAll('#ss-handles-overlay [data-grd-resize-dir]').length === 8 && document.querySelector('#grd-plus-layer > .grd-add-btn[data-grd-add="col"][data-grd-for="grdQ"]'), null, { timeout: 5000 });
  await raf(page);   // 첫 칠해진 장면 — ＋ 가림(P4 ⒜)이 rAF 루프에서 걸린 뒤(t13d-02 7a07060b2 와 같은 자리)
  const n = await page.evaluate(() => (JSON.parse(document.getElementById('grdQ').dataset.rows || '[{}]')).length);
  expect(n, `[전제] ${rows}행`).toBe(rows);
  return errs;
}
const right = (page) => page.evaluate(() => {
  const R = (e) => { const q = e.getBoundingClientRect(); return { l: q.left, t: q.top, r: q.right, b: q.bottom }; };
  const P = R(document.querySelector('#grd-plus-layer > .grd-add-btn[data-grd-add="col"][data-grd-for="grdQ"]'));
  return ['ne', 'e', 'se'].map((d) => { const h = document.querySelector(`#ss-handles-overlay [data-grd-resize-dir="${d}"]`), vis = getComputedStyle(h).display !== 'none', q = R(h);
    const area = Math.max(0, Math.min(q.r, P.r) - Math.max(q.l, P.l)) * Math.max(0, Math.min(q.b, P.b) - Math.max(q.t, P.t));
    const cx = (q.l + q.r) / 2, cy = (q.t + q.b) / 2, who = vis ? document.elementFromPoint(cx, cy)?.dataset?.grdResizeDir ?? null : null;
    return { dir: d, vis, area: vis ? area : null, who, at: [cx, cy] }; });
});
const model = (page) => page.evaluate(() => { const g = document.getElementById('grdQ'); return { w: g.offsetWidth, cols: JSON.parse(g.dataset.cols || '[]').length }; });

for (const rows of [1, 2]) {
  test(`Q1 ${rows}행 — ne·e·se 보임 · 오른쪽 ＋ 와 겹친 넓이 0 · 손잡이 중심 임자 = 그 손잡이`, async ({ page }) => {
    const errs = await scene(page, rows);
    const hs = await right(page);
    expect(hs.map((h) => [h.dir, h.vis, h.area, h.who]), `★오른쪽 손잡이 ${JSON.stringify(hs)}`).toEqual([['ne', true, 0, 'ne'], ['e', true, 0, 'e'], ['se', true, 0, 'se']]);
    expect(errs).toEqual([]);
  });

  test(`Q2 ${rows}행 — e 손잡이 진짜 끌기 −100 → 폭 −100`, async ({ page }) => {
    const errs = await scene(page, rows);
    const e = (await right(page)).find((h) => h.dir === 'e');
    expect(e.vis && e.who === 'e', `[전제] e 손잡이가 잡힌다 ${JSON.stringify(e)}`).toBe(true);
    const a = await model(page);
    await page.mouse.move(e.at[0], e.at[1]); await page.mouse.down(); await page.mouse.move(e.at[0] - 100, e.at[1], { steps: 8 }); await page.mouse.up(); await raf(page);
    const b = await model(page);
    expect(b.w, `★폭 ${a.w} → ${b.w}`).toBe(a.w - 100);
    expect(b.cols, '열 수 그대로').toBe(a.cols);
    expect(errs).toEqual([]);
  });

  test(`Q3 ${rows}행 — 오른쪽 ＋ 진짜 클릭 → 열 +1(그대로)`, async ({ page }) => {
    const errs = await scene(page, rows);
    const p = await page.evaluate(() => { const q = document.querySelector('#grd-plus-layer > .grd-add-btn[data-grd-add="col"][data-grd-for="grdQ"]').getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
    const a = await model(page);
    await page.mouse.click(p[0], p[1]); await raf(page);
    expect((await model(page)).cols, '★열 +1').toBe(a.cols + 1);
    expect(errs).toEqual([]);
  });
}
