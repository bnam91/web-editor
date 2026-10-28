/* c-laurel-zero-181.dom.spec.js — C 152·181 laurel «0 을 먹는 기본값» · 그려진 값과 패널 값 (지디 02:1x)
 *
 * ★«0 이 무엇을 뜻하나»(고치기 전 · 보고서 C 절):
 *   gap 0 = 잎이 칸 가장자리에 붙는다 · gridColGap/gridRowGap 0 = 칸이 붙는다 ⇒ 뜻 있음 ⇒ 0 을 살린다(grid-block.js gridNumOr 한 문).
 *   height 0 = 뜻 없음(계약 [20,600]) ⇒ «0 = 기본(140)» 이 맞다(158 «h>0 ? 지정 : 기본» 과 같은 판정).
 * ★테스트 하나 = gridNumOr 소비자 하나(렌더러 넷 :70·:259·:310·:311 · 패널 다섯 :27·:157·:158·:164·:165) — 그 문을 무력화하면
 *   소비자 수(9)만큼 빨강이어야 한다(한 쌍). H·N 은 그 무력화에 초록(계약·음성대조).
 *   ⚠️줄 번호·시험 이름(R70·R259·R310·P27 …)은 ★뿌리 7f3c6de2 판 번호다 — 고친 판에선 주석 줄이 늘어 렌더러 :72·:261·:313·:314 · 패널 :28·:158·:159·:165·:166.
 *   뿌리에서 R259 는 이미 Number.isFinite 라 0 을 살렸다 ⇒ 뿌리 대조 빨강 8 · 무력화 대조 빨강 9(그 차이가 맞다).
 * ⛔고정 대기 0 — 렌더·패널은 동기라 evaluate 안에서 끝난다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = '<div class="section-block" data-section="1" id="sL"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
const CELL = (o) => ({ lines: [{ text: '1위', fontSize: 40 }], leafColor: '#1a1a1a', gap: 24, height: 140, ...o });

/* laurel 하나(2×2 — ★행 1 이면 패널이 «셀 세로 간격» 줄을 안 그린다(prop-laurel `rows > 1 ?`) ⇒ P164·P165 가 null 이던 검사 결함 · 4c4c42ec 런) — cells·dataset 을 준 값으로 두고 렌더 · 패널 열기 · 읽은 값 돌려줌 */
async function look(page, { cell = {}, ds = {}, legacy = null } = {}) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const r = await page.evaluate(([sec, cells, ds, legacy]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', sec); window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sL'));
    window.addLaurelBlock({ gridCols: 2, gridRows: 2, cells });
    const b = [...document.querySelectorAll('#sL .laurel-block')].pop(); b.id = 'lB';
    for (const [k, v] of Object.entries(ds)) b.dataset[k] = v;
    let legacyCell = null;
    if (legacy) {   // 옛 단일 필드 저장본(cells 없음) — 이주 :70·:71
      const t = document.createElement('div'); t.className = 'laurel-block'; Object.assign(t.dataset, legacy);
      legacyCell = window._readLaurelCells(t)[0];
    }
    window.renderLaurelBlock(b);
    window.showLaurelProperties(b);
    const v = (sel) => document.querySelector(sel)?.value ?? null;
    const left = b.querySelector('.laurel-cell[data-cell-idx="0"] .laurel-leaf-left');
    const inner = b.querySelector('.laurel-cell[data-cell-idx="0"] .laurel-inner');
    return {
      model: JSON.parse(b.dataset.cells)[0], ds: { col: b.dataset.gridColGap ?? null, row: b.dataset.gridRowGap ?? null },
      leafLeft: left?.style.left ?? null, minH: inner?.style.minHeight ?? null,
      colGap: b.style.columnGap, rowGap: b.style.rowGap,
      pCellGap: v('.lrl-cell-gap-num[data-cell="0"]'), pCellH: v('.lrl-cell-height-num[data-cell="0"]'),
      pAllH: v('#lrl-all-height-num'), pAllHS: v('#lrl-all-height'),   /* ★219 — «일괄» 잎 크기 두 칸(prop-laurel.js :152-153) · 셀 칸만 보면 이 결함을 못 본다(S6 261029 ⒜: 고치기 전·후 셋 다 초록) */
      pColS: v('#lrl-grid-col-gap'), pColN: v('#lrl-grid-col-gap-num'), pRowS: v('#lrl-grid-row-gap'), pRowN: v('#lrl-grid-row-gap-num'),
      legacyCell,
    };
  }, [SEC, [CELL(cell), CELL(cell), CELL(cell), CELL(cell)], ds, legacy]);
  return { ...r, errs };
}
const ZERO = { cell: { gap: 0 }, ds: { gridColGap: '0', gridRowGap: '0' } };

test('R259 렌더러 칸 gap 0 → 잎 left 0px', async ({ page }) => {
  const r = await look(page, ZERO);
  expect(r.model.gap, '전제: 모델 gap 0').toBe(0);
  expect(r.leafLeft, 'R259 잎이 붙는다').toBe('0px');
  expect(r.errs).toEqual([]);
});
test('R70 옛 단일 필드 gap "0" → 이주한 칸 gap 0', async ({ page }) => {
  const r = await look(page, { legacy: { gap: '0', height: '140' } });
  expect(r.legacyCell?.gap, 'R70 이주 gap').toBe(0);
  expect(r.errs).toEqual([]);
});
test('R310 렌더러 gridColGap 0 → column-gap 0px', async ({ page }) => {
  const r = await look(page, ZERO);
  expect(r.ds.col, '전제: dataset 0').toBe('0');
  expect(r.colGap, 'R310').toBe('0px');
});
test('R311 렌더러 gridRowGap 0 → row-gap 0px', async ({ page }) => {
  const r = await look(page, ZERO);
  expect(r.ds.row, '전제: dataset 0').toBe('0');
  expect(r.rowGap, 'R311').toBe('0px');
});
test('P27 패널 칸 gap 칸 = 0', async ({ page }) => {
  const r = await look(page, ZERO);
  expect(r.pCellGap, 'P27').toBe('0');
});
test('P157 패널 칸 사이(열) 슬라이더 = 0', async ({ page }) => {
  expect((await look(page, ZERO)).pColS, 'P157').toBe('0');
});
test('P158 패널 칸 사이(열) 숫자 = 0', async ({ page }) => {
  expect((await look(page, ZERO)).pColN, 'P158').toBe('0');
});
test('P164 패널 칸 사이(행) 슬라이더 = 0', async ({ page }) => {
  expect((await look(page, ZERO)).pRowS, 'P164').toBe('0');
});
test('P165 패널 칸 사이(행) 숫자 = 0', async ({ page }) => {
  expect((await look(page, ZERO)).pRowN, 'P165').toBe('0');
});
test('H ★height 0 = 뜻 없음(계약 [20,600]) → 렌더러·패널·이주 다 기본 140', async ({ page }) => {
  const r = await look(page, { cell: { height: 0 }, legacy: { gap: '24', height: '0' } });
  expect(r.model.height, '전제: 모델 height 0').toBe(0);
  expect({ minH: r.minH, panel: r.pCellH, all: r.pAllH, allSlider: r.pAllHS, legacy: r.legacyCell?.height }, 'H 0 = 기본(셀 칸 · ★일괄 칸 둘 · 이주)').toEqual({ minH: '140px', panel: '140', all: '140', allSlider: '140', legacy: 140 });
  expect(r.errs).toEqual([]);
});
test('N (음성대조) 0 아닌 값은 그대로 · 키 없으면 기본(24·32·24)', async ({ page }) => {
  const a = await look(page, { cell: { gap: 12, height: 100 }, ds: { gridColGap: '10', gridRowGap: '6' } });
  expect([a.leafLeft, a.colGap, a.rowGap, a.pCellGap, a.pColN, a.pRowN, a.minH, a.pCellH], 'N 지정값').toEqual(['12px', '10px', '6px', '12', '10', '6', '100px', '100']);
  const b = await look(page, { ds: {} });
  expect([b.ds.col, b.ds.row, b.colGap, b.rowGap, b.pColN, b.pRowN], 'N 키 없음 = 기본').toEqual([null, null, '32px', '24px', '32', '24']);
  expect([a.errs, b.errs]).toEqual([[], []]);
});
