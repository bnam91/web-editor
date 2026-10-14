/* grid-ifg-preset — 1013t2F 인포그래픽 레이아웃 프리셋(기본 · 구분선) — js/blocks/grid-infographic.js.
 * 실행: node --test tests/unit/grid-ifg-preset.test.js
 *
 *   E6a 프리셋 데이터 — lines.border = {1, '#b3b1ae', 'solid', 'top,vsep'} · basic.border = {0, null} · 키 = grid-block 명부
 *   E6b applyIfgPreset('lines') — updateGridBlock «한 번» · partial 에 테두리 네 키 + gap 0 + ifgPreset · 칸에 선(데이터에서)
 *   E6c applyIfgPreset('basic') — width 0 · cellBorderEdges 키 지움 · 선 0 · 글은 그대로
 *   E6d ifgBuildOpts → makeGridBlock — 구분선 프리셋이 «만드는 문 한 번»에 선·표식까지 · 줄 순서 [제목·아이콘·설명] · 아이콘 marginTop:'auto'
 *   E6e addInfographicBlock — window.addGridBlock 을 «한 번», 표식 basic, 테두리 키 없음
 *   E6f ★음성대조 — 프리셋의 border 를 빼면 E6b 의 칸 선이 빨개진다(프로토 «CSS 고정» 꼴 = 데이터 0 재현)
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGrid, cellStyle, sides } = require('./_grid-ifg-harness.js');

const L1 = '1px solid #b3b1ae';

test('E6a 프리셋 데이터 — 구분선 = #b3b1ae 1px solid top,vsep · 기본 = 선 없음 · 키 = grid-block 명부', async () => {
  const { G, I } = await loadGrid({ withIfg: true });
  assert.deepEqual(I.GRID_IFG_PRESETS.lines.border,
    { cellBorderWidth: 1, cellBorderColor: '#b3b1ae', cellBorderStyle: 'solid', cellBorderEdges: 'top,vsep' });
  assert.deepEqual(I.GRID_IFG_PRESETS.basic.border, { cellBorderWidth: 0, cellBorderEdges: null });
  assert.deepEqual(Object.keys(I.GRID_IFG_PRESETS), G.GRID_IFG_PRESET_KEYS);
  assert.equal(window.applyIfgPreset, I.applyIfgPreset);
  assert.equal(window.addInfographicBlock, I.addInfographicBlock);
});

async function ifgGrid(G, I, key = 'basic', nCols = 2, nRows = 2) {
  const { block } = G.makeGridBlock(I.ifgBuildOpts([{ title: 'T1', desc: 'D1' }, { title: 'T2', desc: 'D2' }], nCols, nRows, key));
  return block;
}

test('E6b ★applyIfgPreset(lines) — updateGridBlock 한 번 · 네 키 + gap 0 + 표식 · 칸 선은 데이터에서', async () => {
  const { G, I } = await loadGrid({ withIfg: true });
  const block = await ifgGrid(G, I, 'basic');
  /* 전제 — 기본 프리셋 그리드엔 선이 없다 */
  for (const [r, c] of [[0, 0], [1, 1]]) assert.ok(!cellStyle(block, r, c).includes('border-'), '★전제: 기본 프리셋에 선이 있다');
  const calls = [];
  const real = window.updateGridBlock;
  window.updateGridBlock = (id, partial, o) => { calls.push(partial); return real(id, partial, o); };
  const res = I.applyIfgPreset(block, 'lines');
  window.updateGridBlock = real;
  assert.equal(res.ok, true, `★적용 실패 — ${res.message}`);
  assert.equal(calls.length, 1, `★updateGridBlock 을 ${calls.length}번 불렀다 — ⌘Z 가 한 번에 안 돌아간다`);
  const p = calls[0];
  assert.deepEqual(
    { w: p.cellBorderWidth, c: p.cellBorderColor, s: p.cellBorderStyle, e: p.cellBorderEdges, gap: p.gap, rg: p.rowGap, cg: p.colGap, k: p.ifgPreset },
    { w: 1, c: '#b3b1ae', s: 'solid', e: 'top,vsep', gap: 0, rg: 0, cg: 0, k: 'lines' });
  assert.equal(block.dataset.ifgPreset, 'lines');
  assert.equal(block.dataset.cellBorderEdges, 'top,vsep');
  const s = (r, c) => sides(cellStyle(block, r, c));
  assert.deepEqual(s(0, 0), { top: L1, left: '0', right: '0', bottom: '0' });
  assert.deepEqual(s(0, 1), { top: L1, left: L1, right: '0', bottom: '0' });
  assert.deepEqual(s(1, 1), { top: L1, left: L1, right: '0', bottom: '0' });
  /* 글은 그대로 · 순서는 [제목 · 아이콘 · 설명] · 아이콘은 아래로(marginTop auto) */
  const lines = G.getGridModel(block).cells[1][1].lines;
  assert.deepEqual(lines.map(l => l.type), ['h3', 'image', 'body']);
  assert.equal(lines[0].text, 'T2');
  assert.equal(lines[2].text, 'D2');
  assert.equal(lines[1].marginTop, 'auto');
  assert.ok(cellStyle(block, 1, 1) && block.innerHTML.includes('margin-top:auto;'), '★아이콘 marginTop auto 가 화면에 안 실렸다');
});

test('E6c applyIfgPreset(basic) — 선 끔 · 선 자리 키 지움 · 글 그대로', async () => {
  const { G, I } = await loadGrid({ withIfg: true });
  const block = await ifgGrid(G, I, 'lines');
  assert.equal(block.dataset.cellBorderEdges, 'top,vsep', '★전제: 구분선 프리셋으로 안 만들어졌다');
  const res = I.applyIfgPreset(block, 'basic');
  assert.equal(res.ok, true, res.message);
  assert.equal(block.dataset.cellBorderEdges, undefined);
  assert.equal(block.dataset.cellBorderWidth, '0');
  assert.equal(block.dataset.ifgPreset, 'basic');
  for (const [r, c] of [[0, 0], [0, 1], [1, 0], [1, 1]]) assert.ok(!cellStyle(block, r, c).includes('border-'), `★기본인데 칸(${r},${c})에 선`);
  const lines = G.getGridModel(block).cells[0][1].lines;
  assert.deepEqual(lines.map(l => l.type), ['image', 'h3', 'body']);
  assert.equal(lines[1].text, 'T2');
  assert.equal(lines[0].marginTop, undefined, '★기본 프리셋인데 아이콘 marginTop 이 남았다');
  /* 모르는 키는 거절 · 아무것도 안 바꾼다 */
  const snap = JSON.stringify({ ...block.dataset });
  assert.equal(I.applyIfgPreset(block, 'constructor').ok, false);
  assert.equal(JSON.stringify({ ...block.dataset }), snap);
});

test('E6d ifgBuildOpts(lines) → makeGridBlock — 만드는 문 한 번에 선·표식 · 기본은 테두리 키 없음', async () => {
  const { G, I } = await loadGrid({ withIfg: true });
  const lines = await ifgGrid(G, I, 'lines');
  assert.equal(lines.dataset.cellBorderWidth, '1');
  assert.equal(lines.dataset.cellBorderColor, '#b3b1ae');
  assert.equal(lines.dataset.ifgPreset, 'lines');
  assert.deepEqual(sides(cellStyle(lines, 1, 0)), { top: L1, left: '0', right: '0', bottom: '0' });
  const basic = await ifgGrid(G, I, 'basic');
  assert.equal(basic.dataset.cellBorderWidth, undefined, '★기본 프리셋 새 그리드에 테두리 키가 생겼다');
  assert.equal(basic.dataset.cellBorderEdges, undefined);
  assert.equal(basic.dataset.ifgPreset, 'basic');
});

test('E6e addInfographicBlock — window.addGridBlock 을 한 번 · 3×3 basic', async () => {
  const { I } = await loadGrid({ withIfg: true });
  const calls = [];
  let hinted = 0;
  window.showNoSelectionHint = () => { hinted++; };
  window.getSelectedSection = () => null;   // 섹션 안 고름 → 경고 한 벌 · 아무것도 안 만든다
  window.addGridBlock = (opts) => { calls.push(opts); return { row: {}, block: { id: 'x' } }; };
  assert.equal(I.addInfographicBlock(), null);
  assert.equal(hinted, 1);
  assert.equal(calls.length, 0);
  window.getSelectedSection = () => ({});
  const b = I.addInfographicBlock();
  assert.equal(calls.length, 1);
  assert.equal(b.id, 'x');
  assert.equal(calls[0].ifgPreset, 'basic');
  assert.equal(calls[0].rows.length, 3);
  assert.equal(calls[0].cols.length, 3);
  assert.equal(calls[0].cellBorderWidth, undefined);
  window.addGridBlock = () => null;   // 만드는 문이 null(거절)이면 null
  assert.equal(I.addInfographicBlock(), null);
});

test('E6f ★음성대조 — 프리셋 border 를 비우면(프로토의 «데이터 0» 꼴) E6b 의 칸 선이 빨개진다', async () => {
  /* ⛔변수 이름이 src 가 아니다 — grid-render-gaps G2 는 grid 검사의 `src.replace(` 닻을 «grid-block.js» 에서 찾는다(이 닻은 grid-infographic.js 것). */
  const M = (code, which) => {
    if (which !== 'ifg') return code;
    const out = code.replace("border: { cellBorderWidth: 1, cellBorderColor: GRID_IFG_LINE_COLOR, cellBorderStyle: 'solid', cellBorderEdges: 'top,vsep' },", 'border: {},');
    assert.notEqual(out, code, '★닻이 빗나갔다 — lines.border');
    return out;
  };
  const { G, I } = await loadGrid({ withIfg: true, mutate: M });
  const block = await ifgGrid(G, I, 'basic');
  I.applyIfgPreset(block, 'lines');
  assert.ok(!cellStyle(block, 0, 1).includes(`border-left:${L1}`), '★border 를 뺐는데도 선이 찍힌다 — E6b 는 데이터 경로를 «안 재고 있다»');
});
