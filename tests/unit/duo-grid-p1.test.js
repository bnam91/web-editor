/* 단위 하네스 — js/blocks/duo-block.js 의 P1(행 축) 「옛 파일 승격」+ rows/cells/patchCell API
 * 실행: node --test "tests/unit/*.test.js"   ·  라이브 userData 무접촉(소스 1개를 «읽기»만).
 *
 * ★리허설의 «손으로 쓴 모델»이 아니라 «실제 소스 파일»을 import 한다(save-reload-seal.test.mjs와
 *   같은 원칙) — 바이트 그대로 임시 .mjs 로 복사해 import. 단, duo-block.js는 브라우저 전용
 *   모듈 2개(drag-utils.js/drag-drop.js — document.addEventListener 등 top-level 부작용이 있어
 *   plain Node에서 import 자체가 실패한다)를 import하므로, 그 두 줄만 no-op 스텁으로 바꾼 사본을
 *   쓴다(그 외 바이트 동일 — EVAL-grid-p0.md가 헤드리스 크로미움 검증에 쓴 것과 같은 기법).
 *   나머지(getDuoGrid/duoRows/duoCols/makeDuoBlock/updateDuoBlock/renderDuoBlock)는 실제 로직 그대로.
 * ★package.json이 "type":"commonjs"라 이 파일(.test.js)에서 정적 import/top-level await를 못 쓴다
 *   → node:test의 before() 훅 안에서 동적 import()로 로드하고, 이후 테스트들이 공유 변수로 참조한다.
 *
 * ★왜 이 파일이 있나 — P0 EVAL이 "duo 전용 단위테스트 0건"을 지적했다. 이번 P1의 핵심 요구는
 *   "cells 없는 옛 파일이 읽을 때 1행으로 승격되는가"를 «단위테스트로» 증명하는 것 — 이 파일이 그것이다.
 *
 * ★미니 DOM: dataset은 read-write 문자열 저장을 흉내(모든 쓰기 경로가 이미 String()/JSON.stringify()를
 *   거치므로 plain object로 충분), classList/className/getElementById 레지스트리만 최소 구현한다.
 */
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const srcPath = path.join(__dirname, '../../js/blocks/duo-block.js');
let src = fs.readFileSync(srcPath, 'utf8');
const STUB = "const insertAfterSelected = () => {};\nconst genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\nconst bindBlock = () => {};\n";
const beforeSwap = src;
src = src.replace(
  "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
  STUB
);
assert.notEqual(src, beforeSwap, '소스에서 drag-utils/drag-drop import 2줄을 못 찾음 — 리팩터링됐나?');

/* ── 미니 DOM(이 파일이 실제로 쓰는 API 표면만) ── */
function makeFakeDom() {
  const registry = new Map();
  function createElement(tag) {
    let _id = '', _classes = new Set();
    const el = {
      tagName: tag,
      dataset: {},
      style: {},
      innerHTML: '',
      get id() { return _id; },
      set id(v) {
        if (_id) registry.delete(_id);
        _id = v;
        if (v) registry.set(v, el);
      },
      get className() { return [..._classes].join(' '); },
      set className(v) { _classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
      classList: {
        contains: (c) => _classes.has(c),
        add: (...cs) => cs.forEach(c => _classes.add(c)),
        remove: (...cs) => cs.forEach(c => _classes.delete(c)),
      },
      appendChild(child) { return child; },
      scrollIntoView() {},
    };
    return el;
  }
  return { createElement, getElementById: (id) => registry.get(id) || null };
}

let getDuoGrid, duoRows, duoCols, makeDuoBlock, updateDuoBlock, renderDuoBlock, MIN_COLS, MAX_COLS, MIN_ROWS, MAX_ROWS;

before(async () => {
  const aliasPath = path.join(os.tmpdir(), `duo-grid-p1-alias-${process.pid}.mjs`);
  fs.writeFileSync(aliasPath, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {}; // updateDuoBlock/makeDuoBlock 은 window.* 를 전부 옵셔널 체이닝(?.)으로 부른다
  const mod = await import(pathToFileURL(aliasPath).href);
  fs.unlinkSync(aliasPath);
  ({ getDuoGrid, duoRows, duoCols, makeDuoBlock, updateDuoBlock, renderDuoBlock, MIN_COLS, MAX_COLS, MIN_ROWS, MAX_ROWS } = mod);
});

/* ═══ 상수 회귀 ═══ */
test('한도 상수 — 열 2~4, 행 1~4 (PLAN §3-A)', () => {
  assert.equal(MIN_COLS, 2); assert.equal(MAX_COLS, 4);
  assert.equal(MIN_ROWS, 1); assert.equal(MAX_ROWS, 4);
});

/* ═══ ① 「cells 없는 옛 파일」 승격 — 이 파일의 핵심 요구 ═══ */
test('승격① — dataset.rows/cells 가 아예 없으면 1행 그리드로 승격되고, 셀 내용은 cols[].lines 그대로다', () => {
  const oldCols = [
    { width: 1, align: 'left', lines: [{ type: 'h2', text: '왼쪽' }] },
    { width: 2, lines: [{ type: 'body', text: '오른쪽' }] },
  ];
  const block = { dataset: { cols: JSON.stringify(oldCols) } }; // ★rows/cells 필드 자체가 없다(진짜 옛 파일)
  const { cols, rows, cells } = getDuoGrid(block);

  assert.deepEqual(cols, oldCols, '옛 cols 는 그대로 읽힌다(변형 없음)');
  assert.deepEqual(rows, [{ height: 'auto' }], '행이 없으면 1행·auto 로 승격');
  assert.equal(cells.length, 1, '승격된 그리드는 1행뿐');
  assert.deepEqual(cells[0][0].lines, oldCols[0].lines, '행0 셀0 콘텐츠 = cols[0].lines(단일 진실원)');
  assert.deepEqual(cells[0][1].lines, oldCols[1].lines, '행0 셀1 콘텐츠 = cols[1].lines');
  assert.equal(cells[0][0].align, 'left', '열 속성(align)도 행0 셀에 그대로 승격');
});

test('승격② — dataset.cols 자체가 없거나(2미만) 깨져도 기본 2열로 승격하고 크래시하지 않는다', () => {
  for (const badCols of [undefined, '[]', '[{"width":1}]', 'not json', null]) {
    const block = { dataset: {} };
    if (badCols !== undefined && badCols !== null) block.dataset.cols = badCols;
    const { cols, rows, cells } = getDuoGrid(block);
    assert.equal(cols.length, 2, `badCols=${badCols} → 기본 2열`);
    assert.equal(rows.length, 1);
    assert.equal(cells.length, 1);
    assert.equal(cells[0].length, 2);
  }
});

test('승격③ — dataset.rows 만 있고 dataset.cells 가 없으면(2행 이상) 추가행은 «빈 셀»로 채워진다(크래시 없음)', () => {
  const block = {
    dataset: {
      cols: JSON.stringify([{ width: 1, lines: [{ type: 'h2', text: 'A' }] }, { width: 1, lines: [{ type: 'h2', text: 'B' }] }]),
      rows: JSON.stringify([{ height: 'auto' }, { height: 120 }]),
      // cells 없음
    },
  };
  const { rows, cells } = getDuoGrid(block);
  assert.equal(rows.length, 2);
  assert.equal(cells.length, 2);
  assert.deepEqual(cells[1][0].lines, [], '2행짜리인데 cells 가 없으면 행1 셀은 빈 lines');
  assert.deepEqual(cells[1][1].lines, []);
});

test('승격④ — dataset.cells 가 있으면(row0 이후) 실제로 반영된다', () => {
  const block = {
    dataset: {
      cols: JSON.stringify([{ width: 1, lines: [{ type: 'h2', text: 'A' }] }, { width: 1, lines: [{ type: 'h2', text: 'B' }] }]),
      rows: JSON.stringify([{ height: 'auto' }, { height: 'auto' }]),
      // ★dataset.cells 는 「행0을 뺀」나머지만 담는다 — 여긴 행1 하나(2열)
      cells: JSON.stringify([[{ lines: [{ type: 'body', text: 'C' }] }, { lines: [{ type: 'body', text: 'D' }] }]]),
    },
  };
  const { cells } = getDuoGrid(block);
  assert.equal(cells.length, 2);
  assert.deepEqual(cells[1][0].lines, [{ type: 'body', text: 'C' }]);
  assert.deepEqual(cells[1][1].lines, [{ type: 'body', text: 'D' }]);
});

/* ═══ ② 클램프/폴백 — 열 2~4, 행 1~4 (플랜 P1 회귀위험: 「1열 폴백이 데이터를 지운다」) ═══ */
test('duoCols — 6개짜리 cols 는 4개로 잘린다(초과 클램프)', () => {
  const cols = Array.from({ length: 6 }, (_, i) => ({ width: 1, lines: [{ type: 'body', text: String(i) }] }));
  const block = { dataset: { cols: JSON.stringify(cols) } };
  assert.equal(duoCols(block).length, 4);
});

test('duoRows — 6개짜리 rows 는 4개로 잘린다(초과 클램프)', () => {
  const rows = Array.from({ length: 6 }, (_, i) => ({ height: i * 10 }));
  const block = { dataset: { rows: JSON.stringify(rows) } };
  assert.equal(duoRows(block).length, 4);
});

test('duoRows — height 가 이상해도(음수/문자/undefined) auto 로 떨어진다(크래시 없음)', () => {
  const block = { dataset: { rows: JSON.stringify([{ height: -5 }, { height: 'abc' }, {}, { height: 0 }]) } };
  const rows = duoRows(block);
  assert.equal(rows[0].height, 'auto');
  assert.equal(rows[1].height, 'auto');
  assert.equal(rows[2].height, 'auto');
  assert.equal(rows[3].height, 0, '0px 는 유효한 높이(auto 로 뭉개지면 안 된다)');
});

/* ═══ ③ renderDuoBlock — flex → CSS grid ═══ */
test('renderDuoBlock — grid-template-columns 는 fr, grid-template-rows 는 minmax(px, auto)|auto', () => {
  const block = {
    dataset: {
      cols: JSON.stringify([{ width: 1, lines: [] }, { width: 3, lines: [] }]),
      rows: JSON.stringify([{ height: 'auto' }, { height: 120 }]),
      gap: '24',
    },
    style: {},
  };
  renderDuoBlock(block);
  assert.match(block.innerHTML, /display:grid/);
  assert.match(block.innerHTML, /grid-template-columns:1fr 3fr/);
  assert.match(block.innerHTML, /grid-template-rows:auto minmax\(120px, auto\)/);
  // 2열×2행 = 4개 셀
  assert.equal((block.innerHTML.match(/class="duo-cell"/g) || []).length, 4);
});

test('renderDuoBlock — 옛 1행 파일도 grid 로 렌더되지만 셀 수는 열 수와 같다(회귀: flex 시절과 시각적 동치)', () => {
  const block = { dataset: { cols: JSON.stringify([{ width: 1, lines: [] }, { width: 1, lines: [] }, { width: 2, lines: [] }]) }, style: {} };
  renderDuoBlock(block);
  assert.match(block.innerHTML, /grid-template-columns:1fr 1fr 2fr/);
  assert.equal((block.innerHTML.match(/class="duo-cell"/g) || []).length, 3);
});

/* ═══ ④ makeDuoBlock — 생성 경로 ═══ */
test('makeDuoBlock — rows 를 안 주면 옛 duo 와 완전히 같은 모양(dataset.rows/cells 자체가 없다)', () => {
  const { block } = makeDuoBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
  assert.equal(block.dataset.rows, undefined);
  assert.equal(block.dataset.cells, undefined);
});

test('makeDuoBlock — rows+cells(행0 포함 전체)를 주면 행0 은 cols 로 흡수되고 나머지 행만 dataset.cells 에 남는다', () => {
  const fullCells = [
    [{ lines: [{ type: 'h2', text: 'R0C0' }] }, { lines: [{ type: 'h2', text: 'R0C1' }] }],
    [{ lines: [{ type: 'body', text: 'R1C0' }] }, { lines: [{ type: 'body', text: 'R1C1' }] }],
  ];
  const { block } = makeDuoBlock({
    cols: [{ width: 1 }, { width: 1 }],
    rows: [{ height: 'auto' }, { height: 200 }],
    cells: fullCells,
  });
  const cols = JSON.parse(block.dataset.cols);
  assert.deepEqual(cols[0].lines, [{ type: 'h2', text: 'R0C0' }], '행0 콘텐츠가 cols[0].lines 로 흡수됨');
  assert.deepEqual(cols[1].lines, [{ type: 'h2', text: 'R0C1' }]);
  const extra = JSON.parse(block.dataset.cells);
  assert.equal(extra.length, 1, 'dataset.cells 는 「행0 뺀」 1개 행만');
  assert.deepEqual(extra[0][0].lines, [{ type: 'body', text: 'R1C0' }]);

  // getDuoGrid 로 다시 읽으면(승격 경로) 원래 fullCells 와 동치가 나와야 한다
  const grid = getDuoGrid(block);
  assert.deepEqual(grid.cells.map(row => row.map(c => c.lines)), fullCells.map(row => row.map(c => c.lines)));
});

/* ═══ ⑤ updateDuoBlock — rows/cells/patchCell + 기존 cols/patchCol 호환 ═══ */
function freshBlock(opts) {
  const { block } = makeDuoBlock(opts);
  return block; // getElementById 레지스트리에 이미 등록됨(makeDuoBlock → document.createElement → id 세터)
}

test('updateDuoBlock — 기존 cols/patchCol API 는 그대로 동작한다(하위호환)', () => {
  const block = freshBlock({ cols: [{ width: 1, lines: [{ type: 'h2', text: 'A' }] }, { width: 1, lines: [{ type: 'h2', text: 'B' }] }] });
  const r1 = updateDuoBlock(block.id, { cols: [{ width: 2, lines: [] }, { width: 1, lines: [] }, { width: 1, lines: [] }] });
  assert.equal(r1.ok, true);
  assert.equal(JSON.parse(block.dataset.cols).length, 3);

  const r2 = updateDuoBlock(block.id, { patchCol: { index: 0, width: 5 } });
  assert.equal(r2.ok, true);
  assert.equal(JSON.parse(block.dataset.cols)[0].width, 5);
});

test('updateDuoBlock — patchCell{r:0,...} 은 patchCol 과 «같은 결과»(행0=cols, 단일 진실원)', () => {
  const block = freshBlock({ cols: [{ width: 1, lines: [{ type: 'h2', text: 'A' }] }, { width: 1, lines: [{ type: 'h2', text: 'B' }] }] });
  const r = updateDuoBlock(block.id, { patchCell: { r: 0, c: 1, lines: [{ type: 'h2', text: 'B2' }] } });
  assert.equal(r.ok, true);
  const cols = JSON.parse(block.dataset.cols);
  assert.deepEqual(cols[1].lines, [{ type: 'h2', text: 'B2' }]);
  assert.equal(block.dataset.cells, undefined, 'r=0 패치는 cells 를 건드리지 않는다(행0은 늘 cols)');
});

test('updateDuoBlock — rows 로 2행 이상 늘리고 patchCell{r:1,...}로 새 행 콘텐츠를 채운다', () => {
  const block = freshBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
  const r1 = updateDuoBlock(block.id, { rows: [{ height: 'auto' }, { height: 100 }, { height: 'auto' }] });
  assert.equal(r1.ok, true);
  assert.equal(JSON.parse(block.dataset.rows).length, 3);

  const r2 = updateDuoBlock(block.id, { patchCell: { r: 2, c: 0, lines: [{ type: 'body', text: 'X' }] } });
  assert.equal(r2.ok, true);
  const grid = getDuoGrid(block);
  assert.equal(grid.rows.length, 3);
  assert.deepEqual(grid.cells[2][0].lines, [{ type: 'body', text: 'X' }]);
  assert.deepEqual(grid.cells[1][0].lines, [], '패치 안 한 행1 셀0 은 빈 채로');
});

test('updateDuoBlock — 같은 호출에서 rows 확장 + patchCell 를 동시에 줘도(1콜) 정상 반영된다', () => {
  const block = freshBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
  const r = updateDuoBlock(block.id, {
    rows: [{ height: 'auto' }, { height: 'auto' }],
    patchCell: { r: 1, c: 1, lines: [{ type: 'body', text: 'Y' }] },
  });
  assert.equal(r.ok, true);
  const grid = getDuoGrid(block);
  assert.equal(grid.rows.length, 2);
  assert.deepEqual(grid.cells[1][1].lines, [{ type: 'body', text: 'Y' }]);
});

test('updateDuoBlock — 행을 3→1로 줄이면 dataset.cells(추가행)가 트리밍된다(undo 는 pushHistory 스냅샷이 책임)', () => {
  const block = freshBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
  updateDuoBlock(block.id, { rows: [{ height: 'auto' }, { height: 'auto' }, { height: 'auto' }] });
  updateDuoBlock(block.id, { patchCell: { r: 1, c: 0, lines: [{ type: 'body', text: 'stale' }] } });
  const r = updateDuoBlock(block.id, { rows: [{ height: 'auto' }] });
  assert.equal(r.ok, true);
  const grid = getDuoGrid(block);
  assert.equal(grid.rows.length, 1);
  const extra = block.dataset.cells ? JSON.parse(block.dataset.cells) : [];
  assert.equal(extra.length, 0, '1행으로 줄면 추가행 저장분은 0개');
});

test('updateDuoBlock — cells(행0 포함 전체)로 한 번에 그리드 콘텐츠를 통째로 세팅할 수 있다', () => {
  const block = freshBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
  updateDuoBlock(block.id, { rows: [{ height: 'auto' }, { height: 'auto' }] });
  const r = updateDuoBlock(block.id, {
    cells: [
      [{ lines: [{ type: 'h2', text: 'A' }] }, { lines: [{ type: 'h2', text: 'B' }] }],
      [{ lines: [{ type: 'body', text: 'C' }] }, { lines: [{ type: 'body', text: 'D' }] }],
    ],
  });
  assert.equal(r.ok, true);
  const grid = getDuoGrid(block);
  assert.deepEqual(grid.cells[0][0].lines, [{ type: 'h2', text: 'A' }]);
  assert.deepEqual(grid.cells[1][1].lines, [{ type: 'body', text: 'D' }]);
});

/* ═══ ⑥ 검증 — 한도·상호배제 ═══ */
test('updateDuoBlock — cols 1개/5개는 거부된다(하한 2 유지 — PLAN §3-A "1열 허용 여부" 에 대한 보수적 답)', () => {
  const block = freshBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
  assert.equal(updateDuoBlock(block.id, { cols: [{ width: 1 }] }).ok, false);
  assert.equal(updateDuoBlock(block.id, { cols: Array.from({ length: 5 }, () => ({ width: 1 })) }).ok, false);
});

test('updateDuoBlock — rows 0개/5개는 거부된다(1~4)', () => {
  const block = freshBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
  assert.equal(updateDuoBlock(block.id, { rows: [] }).ok, false);
  assert.equal(updateDuoBlock(block.id, { rows: Array.from({ length: 5 }, () => ({ height: 'auto' })) }).ok, false);
});

test('updateDuoBlock — 구조 필드(cols/patchCol/cells/patchCell)는 한 번에 하나만 허용된다', () => {
  const block = freshBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
  const r = updateDuoBlock(block.id, { cols: [{ width: 1 }, { width: 1 }], patchCol: { index: 0, width: 2 } });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'INVALID');
});

test('updateDuoBlock — patchCell 의 r/c 범위 밖은 거부된다', () => {
  const block = freshBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
  assert.equal(updateDuoBlock(block.id, { patchCell: { r: 0, c: 9 } }).ok, false);
  assert.equal(updateDuoBlock(block.id, { patchCell: { r: 9, c: 0 } }).ok, false);
});

test('updateDuoBlock — 존재하지 않는 blockId 는 NOT_FOUND', () => {
  const r = updateDuoBlock('duo_doesnotexist', { gap: 10 });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'NOT_FOUND');
});
