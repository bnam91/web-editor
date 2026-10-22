/* grid-reorder.test.mjs — t3-04(S6 U1) 그리드 «행·열 순서 바꾸기 ＋ 칸 범위 복붙»의 순수 셈과 직접 쓰기 문.
 * 실행: node --test tests/unit/grid-reorder.test.mjs   ·  하네스 = 기존 _grid-ifg-harness.js loadGrid(새 하네스 0).
 *
 * ★재는 것(발주서 ORDER-grid-reorder-cellclip.md ⑤ · 확정 다섯 중 셈 쪽 ②③④⑤ — ①(머리띠)은 U2 dom 몫):
 *   양성①  행 2→3 이동 = rows 와 cells 가 «같이» 치환된다
 *   양성②  그 행의 «높이»가 따라간다(확정 ④) — rows[i].height 를 일부러 다 다르게 둔다
 *   양성③  옮긴 뒤 cells[to].lines ≡(깊이) 옮기기 전 cells[from].lines (확정 ③ · 자 = 태양 to-s6-grid-31)
 *   행 0 왕복 — 행 0 의 줄은 cols[c].lines 에만 산다 ⇒ 행 0 ↔ 행 2 를 갔다 오면 모델이 «그대로»(cols[c].lines 포함)
 *   열 이동 — cols(폭·열 꾸밈·행 0 줄)와 칸이 같이 · 열 0 ↔ 열 2 왕복 = 원본
 *   양성④  3×2 를 1×1 자리에 붙이면 written 1 · dropped 5 · 넉넉한 자리는 dropped 0 (확정 ②)
 *   라벨⑤  열 = A·B·C · 행 = 1·2·3 (확정 ⑤)
 *   ★이미지 바이트(지디 덧 ⑵) — 20만 자(GRID_IMG_MAX_CHARS)를 넘는 imgSrc 줄이 행 이동·범위 복붙 뒤에도
 *       길이·sha256 이 그대로다. ★직접 쓰기 문(moveGridRow/pasteGridRange)을 가짜 블럭의 dataset 왕복으로도 잰다
 *       (하네스 makeFakeDom 의 dataset 은 평범한 객체라 문자열 왕복이 그대로 선다).
 *   변이 셋 — M-cells «cells 치환을 빼면» ⇒ 양성① 빨강 · M-height «rows 높이를 안 옮기면» ⇒ 양성② 빨강 ·
 *       M-img «imgSrc 를 잘라 넣으면» ⇒ 이미지 칸 빨강. (변이 없이 모두 초록이면 그 단언은 항등식이다)
 * ⛔장면은 손으로 세운다(덧 ⑴ — 기본 그리드는 1×2): 3열 × 4행 · 칸마다 다른 줄 · 행마다 다른 높이 · 칸마다 다른 꾸밈.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const { loadGrid } = createRequire(import.meta.url)('./_grid-ifg-harness.js');

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/* ── 긴 이미지 줄 — 결정적 base64 꼴 문자열(≈25만 자 > GRID_IMG_MAX_CHARS 20만) ── */
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function bigImgSrc(n = 250000) {
  let x = 12345, out = '';
  const parts = [];
  for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; out += B64[x % 64]; if (out.length >= 4096) { parts.push(out); out = ''; } }
  parts.push(out);
  return 'data:image/png;base64,' + parts.join('');
}
const BIG = bigImgSrc();
const BIG_SHA = sha(BIG);

/* ── 장면: 3열 × 4행 ── */
const SCENE = {
  cols: [
    { width: 1, align: 'left', lines: [{ type: 'h2', text: 'A1' }] },
    { width: 2, bg: '#ff0000', lines: [{ type: 'body', text: 'B1' }] },
    { width: 3, lines: [{ type: 'caption', text: 'C1' }] },
  ],
  rows: [{ height: 'auto' }, { height: 120 }, { height: 200 }, { height: 340 }],
  cells: [
    [{ bg: '#111111' }, { padding: 8 }, { radius: 4 }],   // 행 0 = 꾸밈만(줄은 cols[c].lines)
    [{ align: 'center', lines: [{ type: 'body', text: 'A2' }] },
     { valign: 'center', lines: [{ type: 'body', text: 'B2' }] },
     { bg: '#00ff00', lines: [{ type: 'image', imgSrc: BIG, height: 160 }] }],
    [{ padding: 12, lines: [{ type: 'body', text: 'A3' }, { type: 'caption', text: 'A3b' }] },
     { bg: '#0000ff', lines: [{ type: 'h3', text: 'B3' }] },
     { radius: 10, lines: [{ type: 'body', text: 'C3' }] }],
    [{ lines: [{ type: 'body', text: 'A4' }] },
     { align: 'right', lines: [{ type: 'body', text: 'B4' }] },
     { lines: [{ type: 'body', text: 'C4' }] }],
  ],
};
const IMG_AT = { r: 1, c: 2 };

/** 장면을 dataset 에 «직접» 얹은 가짜 블럭(⛔updateGridBlock 입구는 20만 자 이미지를 거절한다 — 그래서 이 길). */
function makeBlock(G) {
  const block = document.createElement('div');
  block.className = 'grid-block';
  block.id = 'grd_reorder_' + Math.random().toString(36).slice(2, 8);
  block.dataset.cols = JSON.stringify(SCENE.cols);
  block.dataset.rows = JSON.stringify(SCENE.rows);
  block.dataset.cells = G.gridCellsToDataset(SCENE.cells);
  return block;
}
function counters() {
  const n = { hist: 0, save: 0 };
  window.pushHistory = () => { n.hist++; };
  window.scheduleAutoSave = () => { n.save++; };
  return n;
}

/* ── 단언 묶음(양성 칸과 변이 칸이 «같은 자»를 쓴다) ── */
function checkRowMoveCells(G) {           // 양성①
  const base = G.getGridModel(makeBlock(G));
  const next = G.gridPermute(base, 'row', 2, 3);
  assert.ok(next, '★gridPermute 가 null');
  assert.deepEqual(next.cells[3], base.cells[2], '★행 2 의 칸이 3 으로 안 갔다');
  assert.deepEqual(next.cells[2], base.cells[3], '★행 3 의 칸이 2 로 안 올라왔다');
  assert.deepEqual(next.cells.slice(0, 2), base.cells.slice(0, 2), '★옮기지 않은 행 0·1 이 바뀌었다');
  assert.deepEqual(next.rows, [base.rows[0], base.rows[1], base.rows[3], base.rows[2]], '★rows 가 같은 순열로 안 바뀌었다');
}
function checkRowMoveHeight(G) {          // 양성②
  const base = G.getGridModel(makeBlock(G));
  assert.notEqual(base.rows[2].height, base.rows[3].height, '★전제 — 두 행 높이가 같으면 이 자는 항등식이다');
  const next = G.gridPermute(base, 'row', 2, 3);
  assert.equal(next.rows[3].height, base.rows[2].height, '★옮긴 행의 높이가 안 따라갔다(확정 ④)');
  assert.equal(next.rows[2].height, base.rows[3].height, '★밀린 행의 높이가 안 따라갔다');
}
function checkImgMoved(G) {                // 이미지 바이트 — 순수 행 이동
  const base = G.getGridModel(makeBlock(G));
  const next = G.gridPermute(base, 'row', IMG_AT.r, 3);
  const s = next.cells[3][IMG_AT.c].lines[0].imgSrc;
  assert.equal(s.length, BIG.length, '★옮긴 이미지 줄의 길이가 바뀌었다');
  assert.equal(sha(s), BIG_SHA, '★옮긴 이미지 줄의 sha256 이 바뀌었다');
}

test('전제 — 장면이 3열×4행 · 이미지 줄이 20만 자를 넘는다 · 행 높이가 다 다르다', async () => {
  const { G } = await loadGrid();
  const m = G.getGridModel(makeBlock(G));
  assert.equal(m.cols.length, 3); assert.equal(m.rows.length, 4);
  assert.ok(BIG.length > G.GRID_IMG_MAX_CHARS, `★이미지 줄이 상한(${G.GRID_IMG_MAX_CHARS})을 안 넘는다 — 덧 ⑵ 의 자가 아니다`);
  assert.equal(new Set(m.rows.map(r => String(r.height))).size, 4, '★행 높이가 겹친다');
  assert.equal(m.cells[IMG_AT.r][IMG_AT.c].lines[0].imgSrc.length, BIG.length, '★장면 이미지가 dataset 에서 잘렸다');
  assert.deepEqual(m.cells[0][0].lines, SCENE.cols[0].lines, '★행 0 줄은 cols 에서 와야 한다');
});

test('양성① 행 2→3 이동 — rows 와 cells 가 같이 치환된다', async () => {
  const { G } = await loadGrid();
  checkRowMoveCells(G);
});

test('양성② 행을 옮기면 그 행의 높이도 따라간다(확정 ④)', async () => {
  const { G } = await loadGrid();
  checkRowMoveHeight(G);
});

test('양성③ 옮긴 뒤 cells[to].lines ≡ 옮기기 전 cells[from].lines (칸 꾸밈도 통째)', async () => {
  const { G } = await loadGrid();
  const base = G.getGridModel(makeBlock(G));
  const next = G.gridPermute(base, 'row', 2, 3);
  for (let c = 0; c < 3; c++) {
    assert.deepEqual(next.cells[3][c].lines, base.cells[2][c].lines, `★열 ${c} 줄이 안 따라갔다`);
  }
  assert.equal(next.cells[3][0].padding, 12); assert.equal(next.cells[3][1].bg, '#0000ff'); assert.equal(next.cells[3][2].radius, 10);
  assert.notEqual(next.cells[3][0].lines, base.cells[2][0].lines, '★사본이 아니라 같은 배열을 가리킨다(얕은 사본)');
});

test('직접 쓰기 moveGridRow — dataset 왕복 · 히스토리 한 번 · 자동저장 · 순수 결과와 같다', async () => {
  const { G } = await loadGrid();
  const n = counters();
  const block = makeBlock(G);
  const base = G.getGridModel(block);
  assert.equal(G.moveGridRow(block, 2, 3), true);
  assert.deepEqual([n.hist, n.save], [1, 1], '★pushHistory·scheduleAutoSave 는 한 번씩');
  assert.deepEqual(G.getGridModel(block), G.gridPermute(base, 'row', 2, 3), '★dataset 에 쓴 것이 순수 셈과 다르다');
  assert.ok(block.innerHTML.includes('B3'), '★renderGridBlock 이 안 돌았다');
  /* 아무 일 없음 — 같은 자리 · 범위 밖 · 히스토리 0 */
  const before = JSON.stringify(block.dataset);
  assert.equal(G.moveGridRow(block, 1, 1), false);
  assert.equal(G.moveGridRow(block, 0, 4), false);
  assert.equal(G.moveGridCol(block, -1, 0), false);
  assert.equal(G.moveGridCol(block, 0, 1.5), false);
  assert.equal(JSON.stringify(block.dataset), before, '★할 일 없는 호출이 dataset 을 건드렸다');
  assert.equal(n.hist, 1, '★할 일 없는 호출이 히스토리를 쌓았다');
});

test('행 0 왕복 — 행 0 ↔ 행 2 를 갔다 오면 모델이 그대로(cols[c].lines 포함)', async () => {
  const { G } = await loadGrid();
  counters();
  const block = makeBlock(G);
  const base = G.getGridModel(block);
  const go = G.gridPermute(base, 'row', 0, 2);
  /* 행 0 이 된 옛 행 1 의 줄은 cols[c].lines 로, 행 2 로 간 옛 행 0 의 줄은 cells[2][c].lines 로 */
  for (let c = 0; c < 3; c++) {
    assert.deepEqual(go.cols[c].lines, base.cells[1][c].lines, `★열 ${c}: 새 행 0 줄이 cols 로 안 넘어갔다`);
    assert.deepEqual(go.cells[2][c].lines, base.cols[c].lines, `★열 ${c}: 옛 행 0 줄이 행 2 로 안 내려왔다`);
  }
  assert.equal(go.cells[2][0].bg, '#111111', '★행 0 칸 꾸밈이 안 따라갔다');
  assert.deepEqual(G.gridPermute(go, 'row', 2, 0), base, '★순수 왕복이 원본과 다르다');
  /* 직접 쓰기 왕복 — ⛔_gridCellsToDataset 이 행 0 lines 를 지우므로 cols 로 안 넘기면 여기서 사라진다 */
  assert.equal(G.moveGridRow(block, 0, 2), true);
  const saved = JSON.parse(block.dataset.cells);
  assert.ok(saved[0].every(cell => !('lines' in cell)), '★dataset.cells[0] 에 lines 키가 생겼다(단일 진실원 깨짐)');
  assert.deepEqual(JSON.parse(block.dataset.cols).map(c => c.lines), base.cells[1].map(c => c.lines), '★dataset.cols 의 행 0 줄이 틀렸다');
  assert.equal(G.moveGridRow(block, 2, 0), true);
  assert.deepEqual(G.getGridModel(block), base, '★dataset 왕복이 원본과 다르다');
});

test('열 이동 — cols(폭·열 꾸밈·행 0 줄)와 칸이 같이 · 열 0 ↔ 열 2 왕복 = 원본', async () => {
  const { G } = await loadGrid();
  const n = counters();
  const block = makeBlock(G);
  /* ★rows 를 «정규화 안 된» 꼴(문자열 높이)로 둔다 — 정규화된 꼴이면 열 이동이 rows 를 다시 써도 바이트가 같아
     아래 「dataset.rows 를 다시 썼다」 단언이 항등식이 된다(이벨류 X10 이 살아남았다). */
  block.dataset.rows = JSON.stringify([{ height: 'auto' }, { height: '120' }, { height: 200 }, { height: 340 }]);
  assert.notEqual(JSON.stringify(G.getGridModel(block).rows), block.dataset.rows, '전제: 다시 쓰면 바이트가 바뀌는 rows 꼴');
  const base = G.getGridModel(block);
  const go = G.gridPermute(base, 'col', 0, 2);
  assert.deepEqual(go.cols, [base.cols[1], base.cols[2], base.cols[0]], '★cols 가 같은 순열로 안 바뀌었다');
  assert.equal(go.cols[2].width, 1); assert.equal(go.cols[2].align, 'left');
  for (let r = 0; r < 4; r++) {
    assert.deepEqual(go.cells[r], [base.cells[r][1], base.cells[r][2], base.cells[r][0]], `★행 ${r} 칸이 열 순열을 안 따랐다`);
  }
  assert.deepEqual(go.rows, base.rows, '★열 이동이 rows 를 건드렸다');
  assert.deepEqual(G.gridPermute(go, 'col', 2, 0), base, '★순수 왕복이 원본과 다르다');
  const rowsBefore = block.dataset.rows;
  assert.equal(G.moveGridCol(block, 0, 2), true);
  assert.equal(block.dataset.rows, rowsBefore, '★열 이동이 dataset.rows 를 다시 썼다');
  assert.deepEqual(G.getGridModel(block), go);
  assert.equal(G.moveGridCol(block, 2, 0), true);
  assert.deepEqual(G.getGridModel(block), base, '★dataset 왕복이 원본과 다르다');
  assert.equal(n.hist, 2);
});

test('양성④ 3×2 를 1×1 자리에 붙이면 들어가는 만큼만(written 1 · dropped 5) · 넉넉하면 dropped 0', async () => {
  const { G } = await loadGrid();
  const base = G.getGridModel(makeBlock(G));
  const clip = G.gridCopyRange(base, 2, 1, 0, 0);   // 끝점 순서 무관
  assert.deepEqual([clip.h, clip.w], [3, 2]);
  assert.deepEqual(clip.cells[0][0].lines, base.cols[0].lines, '★행 0 칸 복사에 줄(cols 쪽)이 안 실렸다');
  const tight = G.gridPasteRange(base, clip, { r: 3, c: 2 });
  assert.deepEqual([tight.written, tight.dropped], [1, 5], '★모자란 자리에서 셈이 틀렸다(확정 ②)');
  assert.deepEqual(tight.model.cells[3][2], clip.cells[0][0], '★들어간 한 칸이 원본과 다르다');
  assert.deepEqual(tight.model.cells.slice(0, 3), base.cells.slice(0, 3), '★범위 밖이 바뀌었다');
  assert.equal(tight.model.rows.length, 4); assert.equal(tight.model.cols.length, 3);   // ⛔그리드를 늘리지 않는다
  const roomy = G.gridPasteRange(base, clip, { r: 1, c: 1 });
  assert.deepEqual([roomy.written, roomy.dropped], [6, 0]);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    assert.deepEqual(roomy.model.cells[1 + i][1 + j], clip.cells[i][j], `★(${1 + i},${1 + j}) 칸이 통째로 안 들어갔다`);
  }
  /* 행 0 으로 붙이기 — 줄은 cols[c].lines 로 가야 한다 */
  const one = G.gridCopyRange(base, 2, 0, 2, 0);
  const to0 = G.gridPasteRange(base, one, { r: 0, c: 1 });
  assert.deepEqual(to0.model.cols[1].lines, base.cells[2][0].lines, '★행 0 에 붙인 줄이 cols 로 안 갔다');
  assert.equal(to0.model.cols[1].width, 2, '★열 폭이 붙여넣기에 휩쓸렸다');
  assert.equal(to0.model.cells[0][1].padding, 12);
  assert.equal(G.gridPasteRange(base, clip, { r: -1, c: 0 }), null);
  assert.equal(G.gridPasteRange(base, { h: 2, w: 1, cells: [[{}]] }, { r: 0, c: 0 }), null);
  /* 직접 쓰기 — 한 수 · 반환 꼴 */
  const n = counters();
  const block = makeBlock(G);
  assert.deepEqual(G.pasteGridRange(block, clip, { r: 3, c: 2 }), { written: 1, dropped: 5 });
  assert.deepEqual(G.getGridModel(block), tight.model);
  assert.deepEqual(G.pasteGridRange(block, clip, { r: 9, c: 9 }), { written: 0, dropped: 6 });
  assert.equal(n.hist, 1, '★범위 붙여넣기가 한 수가 아니거나, 0칸에도 히스토리를 쌓았다');
});

/* ★1행 판 — 행 축 신설 이전 저장본 꼴(dataset.rows·cells 없음)이 열 이동·붙여넣기 뒤에도 «그대로» 남나.
   gridResizeTo 의 nRows<=1 갈래와 같은 모양이어야 한다(이벨류 X11: 그 갈래를 끄는 변이가 살아남았다). */
function make1Row() {
  const block = document.createElement('div');
  block.className = 'grid-block';
  block.id = 'grd_reorder1_' + Math.random().toString(36).slice(2, 8);
  block.dataset.cols = JSON.stringify([
    { width: 1, lines: [{ type: 'body', text: 'A1' }] },
    { width: 2, lines: [{ type: 'body', text: 'B1' }] },
    { width: 3, lines: [{ type: 'body', text: 'C1' }] },
  ]);
  return block;
}
function check1Row(G) {
  const block = make1Row();
  assert.equal(block.dataset.rows, undefined, '전제: 1행 판엔 dataset.rows 가 없다');
  assert.equal(block.dataset.cells, undefined, '전제: 1행 판엔 dataset.cells 가 없다');
  assert.equal(G.moveGridCol(block, 0, 2), true);
  assert.deepEqual(G.getGridModel(block).cols.map(c => c.lines[0].text), ['B1', 'C1', 'A1'], '★1행 열 이동이 안 됐다');
  assert.equal(block.dataset.rows, undefined, '★1행 열 이동 뒤 dataset.rows 가 생겼다(옛 저장본 꼴이 깨진다)');
  assert.equal(block.dataset.cells, undefined, '★1행 열 이동 뒤 dataset.cells 가 생겼다(옛 저장본 꼴이 깨진다)');
  const clip = G.gridCopyRange(G.getGridModel(block), 0, 0, 0, 1);
  assert.deepEqual(G.pasteGridRange(block, clip, { r: 0, c: 1 }), { written: 2, dropped: 0 });
  assert.deepEqual(G.getGridModel(block).cols.map(c => c.lines[0].text), ['B1', 'B1', 'C1'], '★1행 붙여넣기가 안 됐다');
  assert.equal(block.dataset.rows, undefined, '★1행 붙여넣기 뒤 dataset.rows 가 생겼다');
  assert.equal(block.dataset.cells, undefined, '★1행 붙여넣기 뒤 dataset.cells 가 생겼다');
}
test('1행 판 — 열 이동·붙여넣기 뒤에도 dataset.rows·cells 가 없는 옛 꼴 그대로', async () => {
  const { G } = await loadGrid();
  counters();
  check1Row(G);
});

test('라벨⑤ 열 = 알파벳 · 행 = 숫자 · 칸 이름 = 열＋행', async () => {
  const { G } = await loadGrid();
  assert.deepEqual([0, 1, 2].map(G.gridColLabel), ['A', 'B', 'C']);
  assert.deepEqual([0, 1, 2].map(G.gridRowLabel), ['1', '2', '3']);
  assert.equal(G.gridColLabel(1) + G.gridRowLabel(0), 'B1');
  assert.deepEqual([7, 25, 26, 27, 51, 52].map(G.gridColLabel), ['H', 'Z', 'AA', 'AB', 'AZ', 'BA']);
  assert.deepEqual([-1, 1.5, NaN].map(G.gridColLabel), ['', '', '']);
  assert.equal(G.gridRowLabel(-1), '');
});

test('★이미지 바이트 — 행 이동·범위 복붙 뒤에도 20만 자 넘는 imgSrc 의 길이·sha256 이 그대로(순수 ＋ dataset 왕복)', async () => {
  const { G } = await loadGrid();
  checkImgMoved(G);
  counters();
  /* 직접 쓰기 행 이동 */
  const b1 = makeBlock(G);
  assert.equal(G.moveGridRow(b1, IMG_AT.r, 3), true);
  const s1 = G.getGridModel(b1).cells[3][IMG_AT.c].lines[0].imgSrc;
  assert.deepEqual([s1.length, sha(s1)], [BIG.length, BIG_SHA], '★moveGridRow 뒤 dataset 의 이미지가 바뀌었다');
  /* 범위 복사 → 다른 칸에 붙이기(순수 ＋ 직접 쓰기) */
  const base = G.getGridModel(makeBlock(G));
  const clip = G.gridCopyRange(base, IMG_AT.r, IMG_AT.c, IMG_AT.r, IMG_AT.c);
  const pasted = G.gridPasteRange(base, clip, { r: 3, c: 0 }).model.cells[3][0].lines[0].imgSrc;
  assert.deepEqual([pasted.length, sha(pasted)], [BIG.length, BIG_SHA], '★붙인 칸 이미지가 바뀌었다(순수)');
  const b2 = makeBlock(G);
  assert.deepEqual(G.pasteGridRange(b2, clip, { r: 3, c: 0 }), { written: 1, dropped: 0 });
  const m2 = G.getGridModel(b2);
  for (const [r, c] of [[3, 0], [IMG_AT.r, IMG_AT.c]]) {
    const s = m2.cells[r][c].lines[0].imgSrc;
    assert.deepEqual([s.length, sha(s)], [BIG.length, BIG_SHA], `★pasteGridRange 뒤 (${r},${c}) 이미지가 바뀌었다`);
  }
  /* 행 0 으로 옮겨도(cols[c].lines 경유) 그대로 */
  const b3 = makeBlock(G);
  assert.equal(G.moveGridRow(b3, IMG_AT.r, 0), true);
  const s3 = JSON.parse(b3.dataset.cols)[IMG_AT.c].lines[0].imgSrc;
  assert.deepEqual([s3.length, sha(s3)], [BIG.length, BIG_SHA], '★행 0 으로 옮긴 이미지가 cols 에서 바뀌었다');
});

test('window 다리 — 머리띠·키(U2)가 부를 이름이 걸려 있다', async () => {
  const { G } = await loadGrid();
  for (const k of ['moveGridRow', 'moveGridCol', 'pasteGridRange', 'gridCopyRange', 'gridPermute', 'gridPasteRange', 'gridColLabel', 'gridRowLabel']) {
    assert.equal(typeof window[k], 'function', `★window.${k} 가 없다`);
    assert.equal(window[k], G[k], `★window.${k} 가 export 와 다른 함수다`);
  }
});

/* ── 변이 — 새 소스를 비틀어 «그 자가 정말 무는가»를 잰다(하네스도 주입 실패를 assert 로 막는다) ── */
test('변이 M-cells «cells 치환을 빼면» ⇒ 양성① 빨강', async () => {
  const { G } = await loadGrid({ mutate: (src, which) => {
    if (which !== 'grid') return src;
    const out = src.replace('const full2 = _gridSpliceMove(full, from, to);', 'const full2 = full;');
    assert.notEqual(out, src, '★M-cells 닻을 못 찾았다');
    return out;
  } });
  assert.throws(() => checkRowMoveCells(G), { name: 'AssertionError' }, '★cells 치환을 뺐는데 양성① 이 초록 — 항등식이다');
});

test('변이 M-height «rows 높이를 안 옮기면» ⇒ 양성② 빨강', async () => {
  const { G } = await loadGrid({ mutate: (src, which) => {
    if (which !== 'grid') return src;
    const out = src.replace('const rows2 = _gridSpliceMove(model.rows, from, to);', 'const rows2 = model.rows.slice();');
    assert.notEqual(out, src, '★M-height 닻을 못 찾았다');
    return out;
  } });
  assert.throws(() => checkRowMoveHeight(G), { name: 'AssertionError' }, '★높이를 안 옮겼는데 양성② 가 초록 — 항등식이다');
});

test('변이 M-img «imgSrc 를 잘라 넣으면» ⇒ 이미지 칸 빨강', async () => {
  const { G } = await loadGrid({ mutate: (src, which) => {
    if (which !== 'grid') return src;
    const out = src.replace('const _gridDeep = (v) => JSON.parse(JSON.stringify(v));',
      "const _gridDeep = (v) => JSON.parse(JSON.stringify(v, (k, x) => (k === 'imgSrc' && typeof x === 'string' ? x.slice(0, 200000) : x)));");
    assert.notEqual(out, src, '★M-img 닻을 못 찾았다');
    return out;
  } });
  assert.throws(() => checkImgMoved(G), { name: 'AssertionError' }, '★imgSrc 를 잘랐는데 이미지 칸이 초록 — 항등식이다');
});

test('변이 M-1row «1행 갈래를 끄면» ⇒ 1행 판 빨강', async () => {
  const { G } = await loadGrid({ mutate: (src, which) => {
    if (which !== 'grid') return src;
    const out = src.replace('  if (model.rows.length <= 1) {\n    const keep = model.cells[0] || [];', '  if (false) {\n    const keep = model.cells[0] || [];');
    assert.notEqual(out, src, '★M-1row 닻을 못 찾았다');
    return out;
  } });
  counters();
  assert.throws(() => check1Row(G), { name: 'AssertionError' }, '★1행 갈래를 껐는데 1행 판이 초록 — 항등식이다');
});
