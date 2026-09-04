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

/* ★grid-cell-resize.js 는 «무의존 순수모듈»이라 Node 에서 그대로 import 된다 — 스텁이 필요없다.
 * 다만 사본이 tmpdir 로 가면 상대경로 '../grid-cell-resize.js' 가 레포 밖을 가리켜 깨진다.
 * → 절대 file:// URL 로 고정한다(실제 소스를 그대로 쓰는 원칙 유지: ROW_H_MAX 가 진짜 그 파일에서 온다). */
const GCR_SPEC = "from '../grid-cell-resize.js'";
const gcrAliasPath = path.join(os.tmpdir(), `grid-cell-resize-alias-p1-${process.pid}.mjs`);
const beforeGcr = src;
src = src.replace(GCR_SPEC, 'from ' + JSON.stringify(pathToFileURL(gcrAliasPath).href));
assert.notEqual(src, beforeGcr, "소스에서 grid-cell-resize.js import 를 못 찾음 — 행높이 상한 SSOT 가 끊겼나?");

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

let getDuoGrid, duoRows, duoCols, makeDuoBlock, updateDuoBlock, renderDuoBlock, duoLineHtml, MIN_COLS, MAX_COLS, MIN_ROWS, MAX_ROWS;

before(async () => {
  const aliasPath = path.join(os.tmpdir(), `duo-grid-p1-alias-${process.pid}.mjs`);
  // ★grid-cell-resize 도 «바이트 그대로» .mjs 사본으로 둔다 — package.json 이 type:commonjs 라
  //   레포의 .js 를 그대로 import 하면 CJS 로 읽혀 named export(ROW_H_MAX)가 안 나온다.
  fs.copyFileSync(path.join(__dirname, '../../js/grid-cell-resize.js'), gcrAliasPath);
  fs.writeFileSync(aliasPath, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {}; // updateDuoBlock/makeDuoBlock 은 window.* 를 전부 옵셔널 체이닝(?.)으로 부른다
  const mod = await import(pathToFileURL(aliasPath).href);
  fs.unlinkSync(aliasPath);
  fs.unlinkSync(gcrAliasPath);
  ({ getDuoGrid, duoRows, duoCols, makeDuoBlock, updateDuoBlock, renderDuoBlock, duoLineHtml, MIN_COLS, MAX_COLS, MIN_ROWS, MAX_ROWS } = mod);
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

test('renderDuoBlock — 각 라인에 data-r/data-c/data-line 좌표가 심긴다(P1.5 캔버스 인라인 편집 전제, 현빈 지시)', () => {
  const block = {
    dataset: {
      cols: JSON.stringify([
        { width: 1, lines: [{ type: 'h2', text: 'A' }, { type: 'body', text: 'B' }] },
        { width: 1, lines: [{ type: 'body', text: 'C' }] },
      ]),
      rows: JSON.stringify([{ height: 'auto' }, { height: 'auto' }]),
      cells: JSON.stringify([[{ lines: [{ type: 'body', text: 'D' }] }, { lines: [] }]]),
    },
    style: {},
  };
  renderDuoBlock(block);
  // 행0 셀0 의 2번째 줄(li=1) = "B"
  assert.match(block.innerHTML, /data-r="0" data-c="0" data-line="1"[^>]*>B</);
  // 행0 셀1 의 1번째 줄(li=0) = "C"
  assert.match(block.innerHTML, /data-r="0" data-c="1" data-line="0"[^>]*>C</);
  // 행1 셀0 의 1번째 줄(li=0) = "D"
  assert.match(block.innerHTML, /data-r="1" data-c="0" data-line="0"[^>]*>D</);
});

test('duoLineHtml(named export, innercard 경로) — addr 를 안 주면 data-r/c/line 이 «전혀» 안 찍힌다(innercard 렌더 무변화)', () => {
  // innercard-block.js 는 duoLineHtml(l, align) 2개 인자로만 부른다 — depth/addr 는 기본값(0/null).
  const html = duoLineHtml({ type: 'h2', text: '제목' }, 'center');
  assert.doesNotMatch(html, /data-r=|data-c=|data-line=/);
  assert.equal(html, '<div class="duo-line duo-h2" style="font-size:40px;font-weight:700;line-height:1.2;letter-spacing:-0.01em;text-align:center;white-space:pre-wrap;word-break:keep-all;">제목</div>');
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

/* ═══ ⑦ patchCell{lineIndex} — 한 줄 단위 patch (P1.5 캔버스 인라인 편집 전제, 현빈 2026-09-04 지시) ═══ */
test('patchCell{r:0,lineIndex} — 셀 전체가 아니라 그 줄 하나만 바뀐다(다른 줄 보존)', () => {
  const block = freshBlock({ cols: [
    { width: 1, lines: [{ type: 'h2', text: 'A' }, { type: 'body', text: 'B' }] },
    { width: 1, lines: [{ type: 'body', text: 'C' }] },
  ] });
  const r = updateDuoBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 1, text: 'B2' } });
  assert.equal(r.ok, true);
  const cols = JSON.parse(block.dataset.cols);
  assert.deepEqual(cols[0].lines[0], { type: 'h2', text: 'A' }, '0번째 줄은 안 건드림');
  assert.equal(cols[0].lines[1].text, 'B2', '1번째 줄만 바뀜');
  assert.equal(cols[0].lines[1].type, 'body', 'text 이외 필드는 유지(merge, 통째 교체 아님)');
});

test('patchCell{r≥1,lineIndex} — 추가행 셀의 한 줄도 같은 방식으로 patch된다', () => {
  const block = freshBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
  updateDuoBlock(block.id, { rows: [{ height: 'auto' }, { height: 'auto' }] });
  updateDuoBlock(block.id, { patchCell: { r: 1, c: 0, lines: [{ type: 'body', text: 'X' }, { type: 'caption', text: 'Y' }] } });
  const r = updateDuoBlock(block.id, { patchCell: { r: 1, c: 0, lineIndex: 0, text: 'X2' } });
  assert.equal(r.ok, true);
  const grid = getDuoGrid(block);
  assert.equal(grid.cells[1][0].lines[0].text, 'X2');
  assert.equal(grid.cells[1][0].lines[1].text, 'Y', '1번째 줄은 안 건드림');
});

test('patchCell{lineIndex} — 범위 밖(줄 개수 초과·음수)은 거부된다', () => {
  const block = freshBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [] }] });
  assert.equal(updateDuoBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 5, text: 'x' } }).ok, false);
  assert.equal(updateDuoBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: -1, text: 'x' } }).ok, false);
  assert.equal(updateDuoBlock(block.id, { patchCell: { r: 0, c: 1, lineIndex: 0, text: 'x' } }).ok, false, '빈 셀(줄 0개)엔 patchCell.lineIndex 가 무조건 범위 밖');
});

/* ═══ ⑧ 좌표 왕복 — 「렌더가 심은 좌표 → patchCell 커밋 → 재렌더」 (P1.5 캔버스 인라인 편집)
 *   ★캔버스 인라인 편집(js/block-drag.js `_duoEditable`/`_duoEndEdit`)이 하는 일과 «같은 순서»로 민다:
 *     화면에서 좌표를 «읽고» → 그 좌표로 커밋 → 재렌더 결과의 «같은 좌표»를 다시 읽는다.
 *     좌표를 리터럴로 박으면 「렌더가 좌표를 잘못 심어도 통과하는」 테스트가 된다.
 *   ★상한(4×4)도 리터럴로 쓰지 않는다 — MAX_COLS/MAX_ROWS 를 import 해서 쓴다(이 레포에서
 *     리터럴 기대값이 상수 변경 뒤 빨강인 채 커밋 2개를 통과한 사고가 실재한다).            ═══ */

// 렌더된 HTML 에서 「이 글자를 담은 줄」의 좌표를 읽는다 — 인라인 편집이 DOM 에서 하는 일과 같다.
function addrOf(html, text) {
  const esc = String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = html.match(new RegExp(`<[^>]*data-r="(\\d+)" data-c="(\\d+)" data-line="(\\d+)"[^>]*>${esc}<`));
  return m ? { r: +m[1], c: +m[2], li: +m[3] } : null;
}

test('왕복① — 렌더가 심은 좌표로 patchCell 을 커밋하면 재렌더 HTML 의 «같은 좌표»에 새 글자가 온다', () => {
  const block = freshBlock({ cols: [
    { width: 1, lines: [{ type: 'h2', text: 'A0' }, { type: 'body', text: 'A1' }] },
    { width: 1, lines: [{ type: 'body', text: 'B0' }] },
  ] });
  const addr = addrOf(block.innerHTML, 'A1');
  assert.ok(addr, '렌더된 줄에서 좌표를 읽을 수 있어야 한다(못 읽으면 인라인 편집이 성립 안 한다)');

  const res = updateDuoBlock(block.id, { patchCell: { r: addr.r, c: addr.c, lineIndex: addr.li, text: 'A1★' } });
  assert.equal(res.ok, true);
  assert.deepEqual(res.applied.patchCell, { r: addr.r, c: addr.c, lineIndex: addr.li, text: 'A1★' });
  assert.deepEqual(addrOf(block.innerHTML, 'A1★'), addr, '같은 좌표에 새 글자');
  assert.deepEqual(addrOf(block.innerHTML, 'A0'), { r: addr.r, c: addr.c, li: 0 }, '형제 줄은 자리도 글자도 그대로');
  assert.ok(block.innerHTML.includes('>B0<'), '다른 셀은 무변화');
});

test('왕복② — MAX_ROWS×MAX_COLS 그리드의 «마지막 칸»도 좌표 왕복이 된다(상한은 상수에서 온다)', () => {
  const cols  = Array.from({ length: MAX_COLS }, (_, c) => ({ width: 1, lines: [{ type: 'body', text: `R0C${c}` }] }));
  const rows  = Array.from({ length: MAX_ROWS }, () => ({ height: 'auto' }));
  const cells = Array.from({ length: MAX_ROWS }, (_, r) =>
    Array.from({ length: MAX_COLS }, (_, c) => ({ lines: [{ type: 'body', text: `R${r}C${c}` }] })));
  const block = freshBlock({ cols, rows, cells });

  const addr = addrOf(block.innerHTML, `R${MAX_ROWS - 1}C${MAX_COLS - 1}`);
  assert.deepEqual(addr, { r: MAX_ROWS - 1, c: MAX_COLS - 1, li: 0 }, '끝 칸 좌표가 상한과 맞는다');
  const res = updateDuoBlock(block.id, { patchCell: { r: addr.r, c: addr.c, lineIndex: addr.li, text: 'LAST' } });
  assert.equal(res.ok, true);
  assert.deepEqual(addrOf(block.innerHTML, 'LAST'), addr, '추가행(r≥1) 끝 칸도 같은 경로로 왕복');
  assert.ok(block.innerHTML.includes('>R0C0<'), '행0 셀0 은 무변화');
});

test('왕복③ — 빈 문자열로 지우면 «빈 줄 유지»(플레이스홀더 복귀 아님 — 옛 .duo-line-input 과 같은 동작)', () => {
  const block = freshBlock({ cols: [
    { width: 1, lines: [{ type: 'body', text: 'X' }] },
    { width: 1, lines: [{ type: 'body', text: 'Y' }] },
  ] });
  const addr = addrOf(block.innerHTML, 'X');
  const res = updateDuoBlock(block.id, { patchCell: { r: addr.r, c: addr.c, lineIndex: addr.li, text: '' } });
  assert.equal(res.ok, true);
  assert.equal(JSON.parse(block.dataset.cols)[0].lines[0].text, '', '데이터엔 빈 문자열이 «그대로» 남는다(줄이 지워지지 않는다)');
  assert.equal(JSON.parse(block.dataset.cols)[0].lines[0].type, 'body', 'type 등 다른 필드는 유지(merge)');
  assert.match(block.innerHTML, /data-r="0" data-c="0" data-line="0"[^>]*><\/div>/, '줄 요소와 좌표는 살아있고 글자만 비었다');
  assert.doesNotMatch(block.innerHTML, />X</);
});

test('좌표 계약① — 뱃지 줄(line.bg)은 좌표가 «바깥 div», 글자는 안쪽 .duo-badge 다(인라인 편집 host 규칙의 근거)', () => {
  const block = freshBlock({ cols: [
    { width: 1, lines: [{ type: 'body', text: 'BDG', bg: '#ff0000' }] },
    { width: 1, lines: [] },
  ] });
  assert.match(block.innerHTML, /<div data-r="0" data-c="0" data-line="0"[^>]*><span class="duo-badge"[^>]*>BDG<\/span><\/div>/);
  const res = updateDuoBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 0, text: 'BDG2' } });
  assert.equal(res.ok, true);
  assert.match(block.innerHTML, /<span class="duo-badge"[^>]*>BDG2<\/span>/, '뱃지도 같은 patchCell 경로로 왕복한다');
});

test('좌표 계약② — gap/image 줄에도 좌표는 찍히지만 «글자 담는 요소»가 없다(편집 대상 제외의 근거)', () => {
  const block = freshBlock({ cols: [
    { width: 1, lines: [{ type: 'gap', height: 20 }, { type: 'image' }] },
    { width: 1, lines: [] },
  ] });
  assert.match(block.innerHTML, /<div data-r="0" data-c="0" data-line="0" class="duo-gap"/);
  assert.match(block.innerHTML, /<div data-r="0" data-c="0" data-line="1" class="duo-img duo-img-empty"/);
  // 인라인 편집은 «.duo-line 이거나 안쪽 .duo-badge» 만 host 로 삼는다 — 둘 다 없으면 편집이 안 열린다.
  assert.doesNotMatch(block.innerHTML, /class="duo-line/);
  assert.doesNotMatch(block.innerHTML, /duo-badge/);
});

test('중첩/innercard 회귀 — 중첩 duo 안쪽 줄에는 좌표가 «0건»이다(주소는 최상위 줄만)', () => {
  const block = freshBlock({ cols: [
    { width: 1, lines: [{ type: 'duo', cols: [
      { width: 1, lines: [{ type: 'body', text: 'IN0' }] },
      { width: 1, lines: [{ type: 'body', text: 'IN1' }] },
    ] }] },
    { width: 1, lines: [] },
  ] });
  assert.match(block.innerHTML, /<div data-r="0" data-c="0" data-line="0" class="duo-nested"/, '중첩 «컨테이너»엔 좌표가 있다');
  assert.equal((block.innerHTML.match(/data-line="/g) || []).length, 1, '주소는 최상위 줄 1개뿐 — 안쪽 2줄엔 0건');
  assert.ok(block.innerHTML.includes('>IN0<') && block.innerHTML.includes('>IN1<'), '안쪽 줄은 그대로 렌더된다');
});
