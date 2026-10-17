/* grid-ifg-resize — 1017t1i1: ＋(gridResizeTo)로 들어오는 새 로우/칼럼이 인포그래픽 포맷(아이콘·제목·설명
 * 3줄 + 칸 꾸밈 padding + 열 align + 행 height, 4축)을 물려받는지. js/blocks/grid-infographic.js ifgNewShape.
 * 실행: node --test tests/unit/grid-ifg-resize.test.js   ·  하네스 = 기존 _grid-ifg-harness.js(loadGrid({withIfg:true})).
 *
 * ★현빈 지적(원문): 「빈칼럼이 아니라 기존에 인포그래픽 블럭 포맷으로 로우나 칼럼 추가되어야 될 것 같은데」
 *   (proj_1791778999148_grd_ts0he_gixosx9).
 *
 *   R0  전제 — ifgBuildOpts 로 세운 2×2 'lines' 그리드가 실제로 그 꼴(padding/align/height/3줄)을 품는지
 *   R1  ★+열 — 새 열이 이웃 열과 strip(= text·imgSrc 제외) 동일 · 글은 자리표시 · 칸 꾸밈 상속
 *   R2  ★+행 — 새 행이 이웃 행과 strip 동일 · 행 높이 상속
 *   R3  basic 프리셋도 — align/아이콘 크기/행 높이 'auto'/padding 없음
 *   R4  ★손 댄 그리드 — 사용자가 고친 fontSize 를 따른다(프리셋 표 42 가 아니다 — 「이웃에서 뜬다」의 증거)
 *   N-R1 ★음성대조 — ifgNewShape 본문을 null 로 죽이면 R1~R4 가 빨개진다(≥4벌 — 뿌리가 하나임을 검산)
 *   N-R2 ★음성대조 — ifgNewShape 내부 표식 가드를 지우면, 표식 없는 블럭에 «직접 불러도» 꼴이 샌다
 *        (gridResizeTo 는 호출부에도 같은 가드가 있어 이중 방어 — 그래서 호출부만 비틀면 안 샌다, R5 가 그 증거)
 *   R5  ★이중 가드 확인 — 표식을 지운 같은 블럭에 +열 → 옛 기본값(body 자리표시) 그대로(호출부 가드가 혼자서도 막는다)
 *   N-R3 ★음성대조 — window.ifgNewShape 를 지우면(?. 폴백) 옛 기본값으로 정확히 떨어진다(진짜 폴백인지)
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGrid } = require('./_grid-ifg-harness.js');

const strip = (o) => JSON.stringify(o, (k, v) => (k === 'text' || k === 'imgSrc' ? undefined : v));

async function linesGrid2x2(G, I) {
  const { block } = G.makeGridBlock(I.ifgBuildOpts(
    [{ title: 'T1', desc: 'D1' }, { title: 'T2', desc: 'D2' }], 2, 2, 'lines'));
  window.pushHistory = () => {};
  return block;
}

test('R0 ★전제 — 2×2 lines 가 4축(줄3개·padding48·align left·height400)을 품는다', async () => {
  const { G, I } = await loadGrid({ withIfg: true });
  const block = await linesGrid2x2(G, I);
  const m = G.getGridModel(block);
  assert.equal(m.cells[1][1].padding, 48, '★전제 깨짐: padding');
  assert.deepEqual(m.cells[1][1].lines.map(l => l.type), ['h3', 'image', 'body'], '★전제 깨짐: 줄 순서');
  assert.equal(m.rows[1].height, 400, '★전제 깨짐: 행 높이');
  assert.equal(m.cols[1].align, 'left', '★전제 깨짐: 열 align');
});

test('R1 ★+열 — 새 열이 이웃과 strip 동일 · 글은 자리표시 · 칸 꾸밈 상속', async () => {
  const { G, I } = await loadGrid({ withIfg: true });
  const block = await linesGrid2x2(G, I);
  assert.equal(G.gridResizeTo(block, 3, 2), true);
  const m = G.getGridModel(block);
  assert.equal(strip(m.cols[2]), strip(m.cols[1]), '★새 열이 이웃 열과 꼴이 다르다(글자 빼고)');
  const parts = m.cols[2].lines;
  const title = parts.find(l => l.type === 'h3');
  const desc = parts.find(l => l.type === 'body');
  assert.equal(title.text, '제목', '★새 열 제목이 자리표시가 아니다');
  assert.equal(desc.text, '설명', '★새 열 설명이 자리표시가 아니다');
  assert.equal(m.cells[0][2].padding, 48, '★row0 새 칸이 칸 꾸밈(padding)을 못 받았다');
});

test('R2 ★+행 — 새 행이 이웃 행과 strip 동일 · 행 높이 상속', async () => {
  const { G, I } = await loadGrid({ withIfg: true });
  const block = await linesGrid2x2(G, I);
  assert.equal(G.gridResizeTo(block, 2, 3), true);
  const m = G.getGridModel(block);
  assert.equal(m.rows[2].height, 400, '★새 행이 옛 기본값 auto 로 떨어졌다');
  assert.equal(strip(m.cells[2][0]), strip(m.cells[1][0]), '★새 행 칸이 이웃 행 칸과 꼴이 다르다(글자 빼고)');
});

test('R3 ★basic 프리셋 — align center · 아이콘 144 · 행 height auto · padding 없음', async () => {
  const { G, I } = await loadGrid({ withIfg: true });
  const { block } = G.makeGridBlock(I.ifgBuildOpts(
    [{ title: 'A', desc: 'B' }], 3, 3, 'basic'));
  window.pushHistory = () => {};
  assert.equal(G.gridResizeTo(block, 4, 3), true);
  const m = G.getGridModel(block);
  assert.equal(m.cols[3].align, 'center', '★basic 새 열 align');
  const icon = m.cols[3].lines.find(l => l.type === 'image');
  assert.equal(icon.height, 144, '★basic 새 열 아이콘 크기');
  assert.equal(m.rows[2].height, 'auto', '★basic 행 높이');
  assert.equal(m.cells[0][3].padding, undefined, '★basic 새 칸에 padding 이 생겼다(있으면 안 된다)');
});

test('R4 ★손 댄 그리드 — 사용자가 고친 fontSize(60)를 새 열이 따른다(표 42 가 아니다)', async () => {
  const { G, I } = await loadGrid({ withIfg: true });
  const { block } = G.makeGridBlock(I.ifgBuildOpts([{ title: 'T1', desc: 'D1' }], 1, 1, 'lines'));
  window.pushHistory = () => {};
  const cols = JSON.parse(block.dataset.cols);
  cols[0].lines.find(l => l.type === 'h3').fontSize = 60;
  block.dataset.cols = JSON.stringify(cols);
  assert.equal(G.gridResizeTo(block, 2, 1), true);
  const m = G.getGridModel(block);
  const title = m.cols[1].lines.find(l => l.type === 'h3');
  assert.equal(title.fontSize, 60, `★새 열이 손 댄 값(60)이 아니라 프리셋 표 값으로 떨어졌다 — fontSize=${title.fontSize}`);
});

test('R5 ★이중 가드 — 표식을 지운 같은 블럭에 +열 → 옛 기본값(body 자리표시) 그대로', async () => {
  const { G, I } = await loadGrid({ withIfg: true });
  const block = await linesGrid2x2(G, I);
  delete block.dataset.ifgPreset;
  assert.equal(G.gridResizeTo(block, 3, 2), true);
  const m = G.getGridModel(block);
  assert.deepEqual(m.cols[2], { width: 1, lines: [{ type: 'body', text: '내용을 입력하세요.' }] },
    '★표식을 지웠는데 ifg 꼴이 샜다 — 호출부 게이트가 안 먹는다');
});

test('N-R1 ★음성대조 — ifgNewShape 본문을 null 로 죽이면 R1~R4 가 전부 빨개진다(≥4벌)', async () => {
  const M = (code, which) => {
    if (which !== 'ifg') return code;
    const out = code.replace(
      'export function ifgNewShape(block, nCols, nRows) {',
      'export function ifgNewShape(block, nCols, nRows) { return null;');
    assert.notEqual(out, code, '★닻이 빗나갔다 — ifgNewShape 머리');
    return out;
  };
  const { G, I } = await loadGrid({ withIfg: true, mutate: M });
  let redCount = 0;
  // R1
  { const b = await linesGrid2x2(G, I); G.gridResizeTo(b, 3, 2);
    const m = G.getGridModel(b);
    if (m.cols[2].lines.length !== 3) redCount++; }
  // R2
  { const b = await linesGrid2x2(G, I); G.gridResizeTo(b, 2, 3);
    const m = G.getGridModel(b);
    if (m.rows[2].height !== 400) redCount++; }
  // R3
  { const { block: b } = G.makeGridBlock(I.ifgBuildOpts([{ title: 'A', desc: 'B' }], 3, 3, 'basic'));
    window.pushHistory = () => {};
    G.gridResizeTo(b, 4, 3);
    const m = G.getGridModel(b);
    if (m.cols[3].align !== 'center') redCount++; }
  // R4
  { const { block: b } = G.makeGridBlock(I.ifgBuildOpts([{ title: 'T1', desc: 'D1' }], 1, 1, 'lines'));
    window.pushHistory = () => {};
    const cols = JSON.parse(b.dataset.cols); cols[0].lines.find(l => l.type === 'h3').fontSize = 60;
    b.dataset.cols = JSON.stringify(cols);
    G.gridResizeTo(b, 2, 1);
    const m = G.getGridModel(b);
    const title = m.cols[1].lines.find(l => l.type === 'h3');
    if (!title || title.fontSize !== 60) redCount++; }
  assert.ok(redCount >= 4, `★ifgNewShape 를 죽였는데 ${redCount}벌만 빨개졌다 — 뿌리가 하나가 아니다`);
});

test('N-R2 ★음성대조 — ifgNewShape 내부 표식 가드를 지우면, 직접 불렀을 때 표식 없는 블럭에도 꼴이 샌다', async () => {
  const M = (code, which) => {
    if (which !== 'ifg') return code;
    const out = code.replace(
      "if (!block || !block.dataset || !_own(block.dataset.ifgPreset)) return null;",
      'if (!block || !block.dataset) return null;');
    assert.notEqual(out, code, '★닻이 빗나갔다 — ifgNewShape 내부 가드');
    return out;
  };
  const { G, I } = await loadGrid({ withIfg: true, mutate: M });
  const block = await linesGrid2x2(G, I);
  delete block.dataset.ifgPreset;   // 표식 없음 — 내부 가드가 유일한 방어
  window.getGridModel = G.getGridModel;
  const shape = I.ifgNewShape(block, 3, 2);
  assert.notEqual(shape, null, '★내부 가드를 지웠는데도 표식 없는 블럭에서 null — 가드가 다른 경로로도 걸려 있다(이중 방어 재확인)');
});

test('N-R3 ★음성대조 — window.ifgNewShape 를 지우면(?. 폴백) 옛 기본값으로 정확히 떨어진다', async () => {
  const { G, I } = await loadGrid({ withIfg: true });
  const block = await linesGrid2x2(G, I);
  delete window.ifgNewShape;
  assert.equal(G.gridResizeTo(block, 3, 2), true);
  const m = G.getGridModel(block);
  assert.deepEqual(m.cols[2], { width: 1, lines: [{ type: 'body', text: '내용을 입력하세요.' }] },
    '★window.ifgNewShape 가 없을 때 폴백이 옛 기본값과 다르다');
});
