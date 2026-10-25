/* t5-15-grid-plus-copy.dom.spec.js — t5-15 「'+'를 눌러서 열추가시에, 직전 로우와 칼럼이 복사되도록」(현빈 · 2026-10-26)
 *   캔버스 ＋(G15) 로 열을 더하면 ★직전(마지막) 열 · 행을 더하면 ★직전(마지막) 행을 «통째로» 베낀다
 *   (열: 폭 · 열 기본값 · 줄 · 각 행의 칸 꾸밈·줄 / 행: 높이 · 칸 꾸밈·줄).
 *   옛: 새 칸 = 「내용을 입력하세요.」 기본 줄(복사 아님). 기본 그리드는 두 열이 이미 기본 줄이라 G15 P1·P2 단언은 그대로다.
 *   ★인포그래픽(ifgPreset) 그리드는 1017t1i1 「이웃 칸의 꼴」 길이 그대로 먼저다(여기서 안 바꿈).
 *
 * 양성대조 핀 3fd83619(origin/dev, 이 고침 전): GD1001_ROOT=<핀 사본> 으로 같은 시험 → C·R·R0 빨강.
 * 하네스 = bootApp(앱 통째 · 진짜 마우스로 ＋ 클릭).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js t5-15-grid-plus-copy
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sG" data-section="1" data-name="sG"><div class="section-hitzone"></div><div class="section-inner" id="innerG">
  <div class="gap-block" data-type="gap" style="height:60px"></div>
  <div id="slotA"></div>
  <div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`;

/* 원 블럭 꼴(저장본 원 그리드: ◯원형 줄 + POINT/h3)을 본뜬 «중립» 내용 — 공개 저장소라 글은 지어낸 것 */
const COLS = [
  { width: 0.8, align: 'center', lines: [{ type: 'image', imgSrc: '', imgShape: 'circle', height: 120, widthPct: 100, bg: '#b46249', text: 'A0', color: '#ffffff' }] },
  { width: 1.2, lines: [{ type: 'body', text: 'B0', fontSize: 20, color: '#808080' }, { type: 'h3', text: 'B0h' }] },
];
const ROWS2 = [{ height: 'auto' }, { height: 90 }];
const CELLS2 = [[{}, { bg: '#eeeeee' }],
  [{ lines: [{ type: 'image', imgSrc: '', imgShape: 'circle', height: 100, widthPct: 100, bg: '#4a7bb4', text: 'A1' }] },
   { bg: '#dddddd', lines: [{ type: 'body', text: 'B1' }, { type: 'h3', text: 'B1h' }] }]];

async function setup(page, rows) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  const id = await page.evaluate(([html, cols, rows, cells]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
    window.applyZoom?.(100);
    const { row, block } = window.makeGridBlock({});
    document.getElementById('slotA').replaceWith(row); window.bindBlock(block);
    block.dataset.cols = JSON.stringify(cols);
    if (rows) { block.dataset.rows = JSON.stringify(rows); block.dataset.cells = JSON.stringify(cells); }
    else { delete block.dataset.rows; delete block.dataset.cells; }
    window.renderGridBlock(block); window.rebindAll?.();
    return block.id;
  }, [SEC, COLS, rows ? ROWS2 : null, CELLS2]);
  await page.waitForFunction((id) => document.getElementById(id)?.querySelectorAll(':scope > .grd-inner > .grd-cell').length > 0, id, { timeout: 5000 });
  return { errs, id };
}

const model = (page, id) => page.evaluate((id) => JSON.parse(JSON.stringify(window.getGridModel(document.getElementById(id)))), id);

async function plus(page, id, axis) {
  const [x, y] = await page.evaluate((id) => {
    const g = document.getElementById(id); g.scrollIntoView({ block: 'center' });
    const r = (g.querySelector(':scope > .grd-inner') || g).getBoundingClientRect(); return [r.left + r.width * 0.25, r.top + r.height / 2];
  }, id);
  await page.mouse.click(x, y);
  await page.waitForFunction((id) => document.querySelectorAll(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"]`).length === 2, id, { timeout: 3000 });
  /* 고른 뒤 패널이 열리며 캔버스가 다시 놓인다 — ＋ 자리가 두 프레임 내리 같을 때 누른다(고정 대기 대신) */
  const b = await page.evaluate(([id, axis]) => new Promise((done) => {
    const at = () => { const r = document.querySelector(`#grd-plus-layer > .grd-add-btn[data-grd-for="${id}"][data-grd-add="${axis}"]`)?.getBoundingClientRect(); return r ? [r.left + r.width / 2, r.top + r.height / 2] : null; };
    let prev = null, same = 0;
    const tick = () => { const p = at(); if (p && prev && p[0] === prev[0] && p[1] === prev[1] && document.elementFromPoint(p[0], p[1])?.closest('.grd-add-btn')) { if (++same >= 2) return done(p); } else same = 0; prev = p; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), [id, axis]);
  const n0 = await page.evaluate(([id, axis]) => { const m = window.getGridModel(document.getElementById(id)); return axis === 'col' ? m.cols.length : m.rows.length; }, [id, axis]);
  await page.mouse.click(b[0], b[1]);
  await page.waitForFunction(([id, axis, n0]) => { const m = window.getGridModel(document.getElementById(id)); return (axis === 'col' ? m.cols.length : m.rows.length) === n0 + 1; }, [id, axis, n0], { timeout: 3000 });
}
/* 칸의 «내용» — 줄 + 꾸밈(행 0 의 줄은 cols[c].lines 에 산다) */
const cellOf = (m, r, c) => { const { lines, ...deco } = m.cells?.[r]?.[c] || {}; return { lines: r === 0 ? m.cols[c].lines : lines, deco }; };
const colMeta = (col) => { const { lines, ...rest } = col; return rest; };

test('P0 전제 — 2×2 원 그리드 꼴이 그대로 읽힌다', async ({ page }) => {
  const { errs, id } = await setup(page, true);
  const m = await model(page, id);
  expect(m.cols.length).toBe(2); expect(m.rows.length).toBe(2);
  expect(cellOf(m, 1, 1).lines.map(l => l.text)).toEqual(['B1', 'B1h']);
  expect(cellOf(m, 0, 0).lines[0].imgShape).toBe('circle');
  expect(errs).toEqual([]);
});

test('C ★열 ＋ → 새 열 = 직전 열 통째(폭·열 값·줄 · 행마다 칸 꾸밈·줄)', async ({ page }) => {
  const { errs, id } = await setup(page, true);
  await plus(page, id, 'col');
  const m = await model(page, id);
  expect(m.cols.length).toBe(3);
  expect(colMeta(m.cols[2]), '★폭·열 값 = 직전 열').toEqual(colMeta(m.cols[1]));
  for (let r = 0; r < m.rows.length; r++) expect(cellOf(m, r, 2), `★행 ${r} 새 칸 = 직전 칸`).toEqual(cellOf(m, r, 1));
  expect(errs).toEqual([]);
});

test('R ★행 ＋ → 새 행 = 직전 행 통째(높이 · 칸 꾸밈·줄)', async ({ page }) => {
  const { errs, id } = await setup(page, true);
  await plus(page, id, 'row');
  const m = await model(page, id);
  expect(m.rows.length).toBe(3);
  expect(m.rows[2], '★높이 = 직전 행').toEqual(m.rows[1]);
  for (let c = 0; c < m.cols.length; c++) expect(cellOf(m, 2, c), `★열 ${c} 새 칸 = 직전 칸`).toEqual(cellOf(m, 1, c));
  expect(errs).toEqual([]);
});

test('R0 ★1행 그리드 행 ＋ → 새 행 = 행 0(cols[].lines + 행 0 꾸밈)', async ({ page }) => {
  const { errs, id } = await setup(page, false);
  await plus(page, id, 'row');
  const m = await model(page, id);
  expect(m.rows.length).toBe(2);
  for (let c = 0; c < m.cols.length; c++) expect(cellOf(m, 1, c), `★열 ${c} 새 칸 = 행 0 칸`).toEqual(cellOf(m, 0, c));
  expect(errs).toEqual([]);
});

test('U ★베낀 뒤 ⌘Z 한 번 = 처음 · 베낀 칸은 원래 칸과 따로(한쪽 고쳐도 다른 쪽 무변)', async ({ page }) => {
  const { errs, id } = await setup(page, true);
  const m0 = await model(page, id);
  await plus(page, id, 'col');
  const sep = await page.evaluate((id) => {
    const g = document.getElementById(id); const m = window.getGridModel(g);
    m.cols[2].lines[0].text = 'CHANGED';
    return window.getGridModel(g).cols[1].lines[0].text;
  }, id);
  expect(sep, '★직전 열 줄은 그대로').toBe('B0');
  await page.evaluate(() => window.undo());
  await page.waitForFunction((id) => window.getGridModel(document.getElementById(id)).cols.length === 2, id, { timeout: 3000 });
  expect(await model(page, id), '★undo 한 번 = 처음').toEqual(m0);
  expect(errs).toEqual([]);
});
