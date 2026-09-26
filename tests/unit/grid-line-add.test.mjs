/* grid-line-add.test.mjs — grdAddLine(공용 "줄 추가") 의 상한·주소계산·lineSpec 통과.
 * 실행: node --test tests/unit/grid-line-add.test.mjs
 *
 * ★배경 — T-A(빈 셀 선택+단축키) + T-B(이미지 새 줄) 통합 작업(2026-09-16). 우클릭 이미지 추가
 *   (block-factory.js)와 패널 [+ 줄 추가](prop-grid.js)가 각자 splice 로직을 갖던 것을
 *   `grdAddLine`(js/props/prop-grid.js) 하나로 합쳤다 — 이 파일은 그 공용 함수를 순수 데이터로 잰다.
 *
 * ★prop-grid.js 는 UI 전용 의존(전역 propPanel·그리드피커·타이포/필 절·폰트피커·컬러칩·컬러피커)이
 *   많다. grdAddLine 자체는 그중 아무것도 안 쓰지만(getGridModel·MAX_CELL_LINES·
 *   window.updateGridBlock 만 쓴다), import 그래프가 통째로 걸린다 — 그래서 그 의존들만
 *   «최소 스텁」으로 채우고, grid-block.js·grid-cell-resize.js·prop-grid.js 는 «실물 그대로»
 *   같은 상대경로 모양의 임시 트리에 복사해 로드한다(경로를 손대지 않으니 import 재작성 0건).
 *
 * ★0줄 계약 양성/음성대조 — 이 계약은 이 파일 이전엔 «어느 테스트도» 재지 않았다(전수 grep 0건).
 *   「초록 ≠ 가드가 지킨다」 원칙대로 «변이 사본»으로 실제로 갈리는지 확인한다.
 *   ★★2026-09-26 그 계약이 «옮겨졌다» — 「칸 하나라도 비면 거절」 → 「블럭의 모든 칸이 비면 거절」
 *     (현빈 「②칸 하나만」). 아래 그 자리 주석에 까닭이 있고, 음성대조의 방향도 「지운 사본」에서
 *     「되붙인 사본」으로 바뀌었다. ⛔`EMPTY_CELL_LINES` 는 «살아 있다»(뜻만 바뀌었다).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

/* ── 미니 DOM (grid-patchcell-reject.test.js 와 같은 표면 + querySelectorAll 스텁) ── */
function makeFakeDom() {
  const registry = new Map();
  function createElement(tag) {
    let _id = '', _classes = new Set();
    const el = {
      tagName: tag, dataset: {}, style: {}, innerHTML: '',
      get id() { return _id; },
      set id(v) { if (_id) registry.delete(_id); _id = v; if (v) registry.set(v, el); },
      get className() { return [..._classes].join(' '); },
      set className(v) { _classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
      classList: {
        contains: (c) => _classes.has(c), add: (...cs) => cs.forEach(c => _classes.add(c)),
        remove: (...cs) => cs.forEach(c => _classes.delete(c)),
        replace: (a, b) => { if (!_classes.has(a)) return false; _classes.delete(a); _classes.add(b); return true; },
      },
      appendChild(child) { return child; }, scrollIntoView() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
    };
    return el;
  }
  return {
    createElement,
    getElementById: (id) => registry.get(id) || null,
    querySelectorAll: () => [],
    querySelector: () => null,
  };
}

/* grid-block.js 가 window 에 등록하는 것 전부 — 변이(mutation) 로드 뒤 원복 대상. */
const GRID_WINDOW_KEYS = [
  'makeGridBlock', 'addGridBlock', 'updateGridBlock', 'renderGridBlock', 'migrateGridIdentity',
  'makeDuoBlock', 'addDuoBlock', 'updateDuoBlock', 'renderDuoBlock',
];
function snapshotGridWindow() { const s = {}; for (const k of GRID_WINDOW_KEYS) s[k] = window[k]; return s; }
function restoreGridWindow(s) { for (const k of GRID_WINDOW_KEYS) window[k] = s[k]; }

/** grid-block.js 소스(그대로 또는 변이본)만 단독으로 로드 — grid-patchcell-reject.test.js 와 같은 기법. */
let _seq = 0;
async function loadGridBlockSrc(src) {
  const STUB = 'const insertAfterSelected = () => {};\n'
    + 'const genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\n'
    + 'const bindBlock = () => {};\n';
  const withStub = src.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    STUB);
  assert.notEqual(withStub, src, '★drag-utils/drag-drop import 2줄을 못 찾았다 — 리팩터링됐나?');

  const tag = `${process.pid}-${++_seq}`;
  const gcrAlias = path.join(os.tmpdir(), `gcr-gla-${tag}.mjs`);
  const withAlias = withStub.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcrAlias).href));
  assert.notEqual(withAlias, withStub, '★grid-cell-resize.js import 를 못 찾았다 — 행높이 상한 SSOT 가 끊겼나?');

  fs.copyFileSync(path.join(ROOT, 'js', 'grid-cell-resize.js'), gcrAlias);
  const alias = path.join(os.tmpdir(), `grid-gla-${tag}.mjs`);
  fs.writeFileSync(alias, withAlias);
  const mod = await import(pathToFileURL(alias).href);
  fs.unlinkSync(alias); fs.unlinkSync(gcrAlias);
  return mod;
}

let TMP;   // prop-grid.js 를 «실물 상대경로 모양»으로 얹는 임시 트리
let GB;    // grid-block.js (실물, TMP 트리 경유)
let PG;    // prop-grid.js (실물, TMP 트리 경유 — UI 전용 의존만 스텁)

before(async () => {
  TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-line-add-'));
  fs.mkdirSync(path.join(TMP, 'props'));
  fs.mkdirSync(path.join(TMP, 'blocks'));

  // ★실물 그대로 복사 — 트리 모양이 레포와 같아서 import 상대경로를 한 글자도 안 고친다.
  fs.copyFileSync(path.join(ROOT, 'js', 'props', 'prop-grid.js'), path.join(TMP, 'props', 'prop-grid.js'));
  fs.copyFileSync(path.join(ROOT, 'js', 'blocks', 'grid-block.js'), path.join(TMP, 'blocks', 'grid-block.js'));
  fs.copyFileSync(path.join(ROOT, 'js', 'grid-cell-resize.js'), path.join(TMP, 'grid-cell-resize.js'));

  // ★UI 전용 의존 — grdAddLine 이 안 쓰는 것들만 최소 스텁.
  fs.writeFileSync(path.join(TMP, 'globals.js'),
    'export const propPanel = { innerHTML: "", querySelectorAll: () => [] };\n');
  fs.writeFileSync(path.join(TMP, 'drag-utils.js'),
    'export const insertAfterSelected = () => {};\n'
    + 'export const genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\n');
  fs.writeFileSync(path.join(TMP, 'drag-drop.js'), 'export const bindBlock = () => {};\n');
  fs.writeFileSync(path.join(TMP, 'overlay-handles.js'),
    'export const showGridGutters = () => {};\nexport const hideGridGutters = () => {};\n');
  fs.writeFileSync(path.join(TMP, 'props', '_helpers.js'),
    // ★bindSlider — T-D(그리드 갭 슬라이더, 2026-09-16 병합)가 prop-grid.js에 추가한 import.
    //   grdAddLine 자체는 안 쓰지만 import 그래프에 걸려서 스텁이 있어야 로드된다.
    'export const parseRatio = () => [];\nexport const buildGridPicker = () => {};\n'
    + 'export const alignBtn = () => "";\nexport const bindSlider = () => {};\n'
    // ★blockHeaderHTML — T-049(2026-09-22)가 `.prop-block-label` 헤더를 _helpers.js 한 자리로 모았다.
    //   grdAddLine 은 헤더를 안 보지만 import 그래프에 걸린다.
    + 'export const blockHeaderHTML = () => "";\n');
  fs.writeFileSync(path.join(TMP, 'props', '_typo-section.js'),
    'export const buildTypographySectionHtml = () => "";\nexport const buildFillSectionHtml = () => "";\n');
  fs.writeFileSync(path.join(TMP, 'props', '_font-picker.js'), 'export const wireFontPicker = () => {};\n');
  fs.writeFileSync(path.join(TMP, 'props', 'color-var-chips.js'),
    'export const wireColorVarChips = () => {};\nexport const parseColorVarName = () => "";\n');
  /* ★2026-09-21 유닛 colorhex — prop-grid.js 의 색칸 배선이 color-picker.js 의 공용
     wireHexText 로 옮겨졌다. 여기 스텁은 «규칙을 베끼지 않는다» — 아무 것도 안 하는 더블이다
     (그리드 줄 추가는 색칸을 안 지난다). 규칙 자체는 tests/dom/color-hex-*.dom.spec.js 가 잰다. */
  fs.writeFileSync(path.join(TMP, 'props', 'color-picker.js'),
    'export const parseAlphaFromColor = () => 100;\nexport const swatchHex = (h) => h;\n'
    + 'export const wireHexText = () => null;\n'
    + 'export const parseHex6 = () => null;\n'
    + 'export const formatHex6 = (v) => String(v ?? "");\n');

  globalThis.document = makeFakeDom();
  globalThis.window = {};
  GB = await import(pathToFileURL(path.join(TMP, 'blocks', 'grid-block.js')).href);
  PG = await import(pathToFileURL(path.join(TMP, 'props', 'prop-grid.js')).href);
});

after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {} });

/** 2열 그리드 — col0 은 빈 셀, col1 은 줄 하나. */
function fixture() {
  const { block } = GB.makeGridBlock({
    cols: [{ width: 1, lines: [] }, { width: 1, lines: [{ type: 'body', text: 'X' }] }],
  });
  assert.ok(block && block.id, '★블록이 안 만들어졌다 — 아래 단언은 전부 «다른 이유»로 초록이 된다');
  return block;
}

/** 칸 (r,c) 의 여는 태그를 «통째로» 떠낸다.
 *  ⛔`innerHTML.match(/data-c="1"[^>]*>/)` 로 class 를 보려 하지 마라 — 렌더러는
 *    `<div class="grd-cell…" data-r data-c style>` 순서로 찍으므로 data-c 부터 훑으면
 *    class 가 «구조적으로» 안 들어온다. 그렇게 쓴 `doesNotMatch` 는 무엇을 넣어도 초록이다
 *    (2026-09-26 에 이 파일에서 그런 단언 둘을 실제로 발견해 여기로 바꿨다). */
function cellTag(block, r, c) {
  const m = block.innerHTML.match(new RegExp('<div class="grd-cell[^"]*" data-r="' + r + '" data-c="' + c + '"'));
  assert.ok(m, `★칸 (${r},${c}) 의 태그를 못 찾았다 — 아래 단언이 «다른 이유»로 초록이 된다`);
  return m[0];
}

/* ═══ 주소 계산 ═══════════════════════════════════════════════════════════ */

test('grdAddLine — afterLi=null 은 «빈 셀」의 첫 줄로 들어간다(셀 채우기)', () => {
  const block = fixture();
  const res = PG.grdAddLine(block, { r: 0, c: 0 }, null, { type: 'body', text: 'hello' });
  assert.equal(res.ok, true, res.code);
  assert.equal(res.li, 0, '★빈 배열에 append 는 인덱스 0');
  const lines = GB.getGridModel(block).cells[0][0].lines;
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0], { type: 'body', text: 'hello' });
});

test('grdAddLine — afterLi=null 은 «줄이 있는 셀」의 끝에 append 한다', () => {
  const block = fixture();
  const res = PG.grdAddLine(block, { r: 0, c: 1 }, null, { type: 'gap', height: 10 });
  assert.equal(res.ok, true, res.code);
  assert.equal(res.li, 1, '★기존 1줄 뒤 = 인덱스 1');
  const lines = GB.getGridModel(block).cells[0][1].lines;
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0], { type: 'body', text: 'X' }, '★기존 줄이 밀려나거나 사라지면 안 된다');
  assert.deepEqual(lines[1], { type: 'gap', height: 10 });
});

test('grdAddLine — afterLi=정수 는 «그 줄 다음»에 삽입한다(기존 [+ 줄 추가]와 바이트 동일 동작)', () => {
  const block = fixture();
  PG.grdAddLine(block, { r: 0, c: 1 }, null, { type: 'body', text: 'Y' });   // → [X, Y]
  const res = PG.grdAddLine(block, { r: 0, c: 1 }, 0, { type: 'body', text: 'MID' });   // X 다음에 삽입
  assert.equal(res.ok, true, res.code);
  assert.equal(res.li, 1);
  const lines = GB.getGridModel(block).cells[0][1].lines;
  assert.deepEqual(lines.map(l => l.text), ['X', 'MID', 'Y'], '★X 다음 자리에 들어가야 한다(끝이 아니다)');
});

test('grdAddLine — lineSpec 기본값은 {type:"body",text:""} 다(인자 생략 시)', () => {
  const block = fixture();
  const res = PG.grdAddLine(block, { r: 0, c: 0 }, null);
  assert.equal(res.ok, true, res.code);
  const line = GB.getGridModel(block).cells[0][0].lines[0];
  assert.deepEqual(line, { type: 'body', text: '' });
});

test('grdAddLine — 성공하면 grdSetActiveLine 이 새 줄 주소를 가리킨다', () => {
  const block = fixture();
  const res = PG.grdAddLine(block, { r: 0, c: 1 }, null, { type: 'gap', height: 8 });
  assert.deepEqual(PG.grdGetActiveLine(block), { r: 0, c: 1, li: res.li });
});

/* ═══ 상한(MAX_CELL_LINES) ══════════════════════════════════════════════════ */

test('grdAddLine — 양성대조: 상한 미만이면 통과한다', () => {
  const block = fixture();
  const lines = Array.from({ length: GB.MAX_CELL_LINES - 1 }, (_, i) => ({ type: 'body', text: `L${i}` }));
  const res0 = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lines } });
  assert.equal(res0.ok, true, res0.message);
  const res = PG.grdAddLine(block, { r: 0, c: 0 }, null, { type: 'body', text: 'LAST' });
  assert.equal(res.ok, true, res.code);
  assert.equal(GB.getGridModel(block).cells[0][0].lines.length, GB.MAX_CELL_LINES);
});

test('grdAddLine — 음성대조: 상한(MAX_CELL_LINES)에 닿으면 LIMIT 을 내고 데이터를 «안 건드린다»', () => {
  const block = fixture();
  const lines = Array.from({ length: GB.MAX_CELL_LINES }, (_, i) => ({ type: 'body', text: `L${i}` }));
  const res0 = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lines } });
  assert.equal(res0.ok, true, res0.message);
  const before = block.dataset.cols;
  const res = PG.grdAddLine(block, { r: 0, c: 0 }, null, { type: 'body', text: 'OVER' });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'LIMIT');
  assert.equal(block.dataset.cols, before, '★거절 뒤 dataset 이 «안 변했다»(효과 판정)');
  assert.equal(GB.getGridModel(block).cells[0][0].lines.length, GB.MAX_CELL_LINES);
});

/* ═══ 빈 셀 렌더 — .grd-cell-empty ═══════════════════════════════════════════ */

test('renderGridBlock — 줄이 0개인 셀만 .grd-cell-empty 를 받는다', () => {
  const block = fixture();   // col0 lines=[] · col1 lines=[X]
  GB.renderGridBlock(block);
  assert.match(block.innerHTML, /class="grd-cell grd-cell-empty" data-r="0" data-c="0"/,
    '★빈 칸(col0)에 표식이 없다 — CSS 안내문(+ 내용 추가)도 클릭 판정도 이 표식에 기대지 않지만' +
    ' 최소한 렌더가 실제로 찍어야 한다');
  /* ⛔옛 판은 `block.innerHTML.match(/data-c="1"[^>]*>/)[0]` 을 봤다 — class 가 data-c «앞»에
     오므로 그 조각엔 class 가 «절대» 안 들어온다. 무엇을 넣어도 초록인 단언이었다(2026-09-26). */
  assert.doesNotMatch(cellTag(block, 0, 1), /grd-cell-empty/,
    '★줄이 있는 칸(col1)까지 「빈 칸」으로 오判되면 안내문이 글자 위에 겹쳐 뜬다');
});

test('renderGridBlock — grdAddLine 으로 채운 뒤엔 .grd-cell-empty 가 사라진다', () => {
  const block = fixture();
  PG.grdAddLine(block, { r: 0, c: 0 }, null, { type: 'body', text: 'filled' });
  GB.renderGridBlock(block);
  assert.doesNotMatch(cellTag(block, 0, 0), /grd-cell-empty/,   // ⛔옛 판은 아무것도 안 쟀다(위 cellTag 주석)
    '★줄을 채웠는데 「빈 칸」 표식이 남아 있다 — 안내문이 글자 위에 겹쳐 뜬다');
});

/* ═══ 「칸을 «완전히» 비운다」 — 0줄 계약의 양성/음성대조 (2026-09-26 뒤집힘) ═════
 * ★★계약이 갈렸다. ~~[폐기 · 2026-09-26] 「0줄 가드(EMPTY_CELL_LINES)는 patchCell{lines:[]}
 *   로 «기존 줄을 지워 칸을 통째로 비우는» 시도를 막는다(allowEmpty=false 경로)」~~
 *   ⛔옛 계약은 «그날까지 참이었다» — 위 두 테스트(빈 셀 렌더)가 그때도 초록이던 것이
 *   그 증거다: 「줄 0개 칸」이라는 «상태»는 막힌 적이 없고, 막힌 것은 «그 상태로 가는 전이»
 *   하나뿐이었다. 현빈이 2026-09-26 에 그 비대칭에 걸렸다 —
 *     「여전히 빈칸으로 두고 싶은데 마지막 남은 줄은 삭제할 수 없다고 하네?」
 *   ⇒ 그래서 전이를 열었다(js/blocks/grid-block.js `_gridRejectLinesLength` 머리말에 까닭 전부).
 *
 * ★음성대조의 «방향»이 뒤집힌다 — 옛 판은 「가드를 «지운» 사본이 통과한다」였다. 이제 가드가
 *   없으므로 지울 것이 없다. 대신 «되붙인» 사본이 거절하는지를 잰다. 그것이 「내가 고친 자리가
 *   바로 거기였다」의 증명이다(고친 줄을 떼면 빨개지는 것과 같은 뜻, 방향만 반대).
 * ⛔그리고 «배열 계약»은 남았다 — `lines:null` 은 여전히 거절이다(code 만 LINES_NOT_ARRAY 로
 *   갈렸다). 셋째 테스트가 그 자리를 지킨다. 안 재면 「비우기 허용」이 「모양 계약까지 풀림」으로
 *   조용히 번진다(2026-09-23 T-178 C3 가 막은 옆문이 그 길이다). */

/** 내용이 «둘» 있는 블록 — 한 칸을 비워도 블럭이 통째로 비지 않는다(현빈 「②칸 하나만」).
 *  ⛔공용 `fixture()`(col0 빈 칸 · col1 한 줄)로는 못 잰다 — 거기서 col1 을 비우면 «모든 칸이
 *    비게» 되어 새 가드가 정당하게 막는다. 그러면 「비우기가 안 된다」와 「마지막 칸이라 막혔다」가
 *    한 글자도 안 갈린다(2026-09-26 에 실제로 그 빨강을 봤다). */
function fixtureTwoFilled() {
  const { block } = GB.makeGridBlock({
    cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }],
  });
  assert.ok(block && block.id, '★블록이 안 만들어졌다 — 아래 단언은 «다른 이유»로 초록이 된다');
  return block;
}

test('★0줄 — 양성대조: 이미 줄이 있는 셀을 patchCell{lines:[]} 로 «비울 수 있다»(옆 칸에 내용이 남을 때)', () => {
  const block = fixtureTwoFilled();
  const res = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 1, lines: [] } });
  assert.equal(res.ok, true, '★현빈 요구가 그대로 막혀 있다 — 마지막 «줄»이 안 지워진다');
  assert.equal(GB.getGridModel(block).cells[0][1].lines.length, 0, '★ok:true 인데 데이터는 안 비었다');
  assert.equal(GB.getGridModel(block).cells[0][0].lines.length, 1, '★옆 칸까지 비었다');
  /* ★「비었다」를 «모델»로만 보지 않는다 — 화면에도 빈 칸 표식이 찍혀야 손에 닿는다. */
  GB.renderGridBlock(block);
  assert.match(cellTag(block, 0, 1), /grd-cell-empty/,
    '★비웠는데 `.grd-cell-empty` 가 안 찍혔다 — 안내문도 클릭 판정도 이 표식에 기댄다');
});

/* ═══ ★범위 — 「모든 칸이 빈 블럭」도 «된다» (현빈 0927 T-230) ═════════════════
 * ~~[폐기 · 2026-09-27] 「모든 칸이 빈 블럭은 막는다 (현빈 0926 「②칸 하나만」)」 — 그 셋을
 *   여기서 걷었다. 막던 자(`_gridRejectAllCellsEmpty`)가 «함수째» 없어졌기 때문이다.~~
 * ★왜 뒤집혔나 — 0926 에 내가 「풀면 깨진다」고 올렸고 현빈이 그 전제 위에서 범위를 「칸 하나만」
 *   으로 좁히셨다. 그 전제가 틀렸다(11축 재니 깨지는 것 0건). 0927 에 다시 여쭈니
 *   「t230 > 마지막 한칸도 비울 수 있게 해줘」.
 *   ⇒ ★★**전제가 반증되면 «되돌림»이 아니라 «다시 여쭘»이다.** 그 한 번이 이 뒤집기를 만들었다.
 * ⚠️★단 «안 깨진다»는 말이 아니다 — 모든 칸이 비면 내보낸 결과물에서 높이가 0 이다
 *   (2026-09-27 실측: 캔버스 안 19px → 내보내기 클론 0px · 대조군 35px).
 *   그건 tests/dom/grid-cell-emptied.dom.spec.js 의 I 가 «계약»으로 못박는다. 여기서는 안 잰다. */

test('★범위 — 내용이 남은 «마지막 칸»도 비워진다 (블럭이 통째로 빈다)', () => {
  const block = fixture();   // col0 lines=[] · col1 lines=[X] ⇒ col1 이 «마지막 내용 칸»
  const res = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 1, lines: [] } });
  assert.equal(res.ok, true, '★마지막 내용 칸이 아직 막힌다 — 현빈 0927 지시가 안 들어갔다');
  assert.equal(GB.getGridModel(block).cells[0][1].lines.length, 0, '★ok:true 인데 데이터는 안 비었다');
  assert.equal(GB.getGridModel(block).cells[0][0].lines.length, 0, '★전제 — 옆 칸도 비어 있어야 이 검사가 「통째로」를 잰다');
  /* ★화면 표식까지 — 「비었다」를 모델로만 보지 않는다. */
  GB.renderGridBlock(block);
  assert.match(cellTag(block, 0, 1), /grd-cell-empty/, '★비웠는데 `.grd-cell-empty` 가 안 찍혔다');
});

test('★범위 — «옆 칸에 내용이 있든 없든» 같게 통과한다 (판정이 옆 칸을 더는 안 본다)', () => {
  const block = fixture();
  const fill = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'body', text: 'X' }] } });
  assert.equal(fill.ok, true, '★전제 — 옆 칸 채우기가 실패했다(이 검사가 아무것도 안 잰다)');
  const res = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 1, lines: [] } });
  assert.equal(res.ok, true, '★옆 칸이 찬 경우마저 막힌다 — 딴 자가 막고 있다');
  /* ★★두 경우가 «같은 답»이어야 한다 — 위 검사(옆 칸 빈 경우)도 ok:true 다.
     ⛔답이 갈리면 판정자가 어딘가 되살아난 것이다. */
  assert.equal(GB.getGridModel(block).cells[0][1].lines.length, 0);
});

test('★음성대조 — 막던 code 이름이 소스에서 «사라졌는가» (되살아나면 빨개진다)', () => {
  const RAW = fs.readFileSync(path.join(ROOT, 'js', 'blocks', 'grid-block.js'), 'utf8');
  /* ★코드 줄에서만 찾는다 — 주석에는 «역사»로 남아 있고, 그건 남겨 두라고 규약이 말한다.
     ⛔「`*` 로 시작하면 주석」식 글자 거르기는 이 레포에서 «진다» — 여기 블록 주석은 `*` 없이
       들여쓴 본문으로 이어진다(2026-09-27 에 실제로 7줄을 코드로 오인해 이 검사가 빨갰다).
     ⇒ 여는/닫는 표를 «세어» 상태로 가른다. 문자열 안의 `/*` 까지 가리지는 못하지만,
       이 파일이 재는 두 이름에는 그런 경우가 없다(있으면 이 주석부터 고쳐라). */
  const codeLines = [];
  let inBlock = false;
  for (const raw of RAW.split('\n')) {
    let line = raw;
    if (inBlock) {
      const close = line.indexOf('*/');
      if (close < 0) continue;
      line = line.slice(close + 2);
      inBlock = false;
    }
    for (;;) {
      const open = line.indexOf('/*');
      if (open < 0) break;
      const close = line.indexOf('*/', open + 2);
      if (close < 0) { line = line.slice(0, open); inBlock = true; break; }
      line = line.slice(0, open) + line.slice(close + 2);
    }
    const t = line.replace(/\/\/.*$/, '').trim();
    if (t) codeLines.push(t);
  }
  const live = codeLines.filter(l => l.includes('EMPTY_CELL_LINES') || l.includes('_gridRejectAllCellsEmpty'));
  assert.deepEqual(live, [],
    '★막던 자가 코드에 되살아났다 — 현빈 0927 결정(T-230)과 어긋난다: ' + JSON.stringify(live));
  /* ★계측기 자가점검 — 이 자가 «글자를 실제로 볼 수 있는가». 안 그러면 위 0건은 침묵이다. */
  assert.ok(codeLines.some(l => l.includes('LINES_NOT_ARRAY')),
    '★계측기가 코드 줄을 못 읽는다 — 위 「0건」은 측정이 아니라 침묵이었다');
});

test('★배열 계약은 남았다 — patchCell{lines:null} 은 LINES_NOT_ARRAY 로 거절되고 데이터가 안 변한다', () => {
  const block = fixture();   // col1 lines=[X]
  const res = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 1, lines: null } });
  assert.equal(res.ok, false, '★`lines:null` 이 통과했다 — 저장본에 {"lines":null} 이 남아 「비웠다」와 안 갈린다');
  assert.equal(res.code, 'LINES_NOT_ARRAY');
  assert.equal(GB.getGridModel(block).cells[0][1].lines.length, 1, '★거절했다면서 데이터는 이미 건드렸다');
});

/* ═══ 0920b-grid-image — «넣었는데 조용히 버려진다» ═════════════════════════
 * ★현빈 2026-09-20: 「그리드블럭 > 우클릭 후 이미지 삽입안되는 이슈」.
 *   실측한 원인은 「메뉴가 안 뜬다」가 아니라 «커밋이 TOO_LARGE 로 거절되는데 grdAddLine 이
 *   그 반환을 안 받고 무조건 {ok:true} 를 돌려준다»였다 — 토스트 0건·콘솔 0건·화면 무변화.
 *   게다가 실패할 커밋 «앞»에서 grdSetActiveLine 을 이미 옮겨 놔, 활성줄이 «없는 li»를 가리켰다.
 * 아래 네 개가 그 자리를 «각각» 잰다(하나가 초록이어도 나머지가 빨강이 되게 쪼갰다). */

/** 길이 n 의 가짜 dataURL — 앞머리는 진짜 모양을 지키고 몸통만 늘린다. */
function fakeDataUrl(n) {
  const head = 'data:image/png;base64,';
  return head + 'A'.repeat(Math.max(0, n - head.length));
}

test('grdAddLine — 양성대조: 작은 이미지(1KB)는 들어가고 줄 수가 +1 된다', () => {
  const block = fixture();
  const res = PG.grdAddLine(block, { r: 0, c: 1 }, null, { type: 'image', imgSrc: fakeDataUrl(1024), height: 0 });
  assert.equal(res.ok, true, res.code);
  const lines = GB.getGridModel(block).cells[0][1].lines;
  assert.equal(lines.length, 2, '★양성대조가 깨지면 아래 음성대조는 «다른 이유»로 빨강이다');
  assert.equal(lines[1].type, 'image');
});

test('grdAddLine — 음성대조: updateGridBlock 이 TOO_LARGE 를 내면 «그대로» 돌려준다(거짓 성공 금지)', () => {
  const block = fixture();
  const res = PG.grdAddLine(block, { r: 0, c: 1 }, null,
    { type: 'image', imgSrc: fakeDataUrl(GB.GRID_IMG_MAX_CHARS + 1), height: 0 });
  assert.equal(res.ok, false, '★ok:true 면 호출부는 토스트를 못 띄운다 — 화면 무변화 + 침묵');
  assert.equal(res.code, 'TOO_LARGE');
  assert.equal(GB.getGridModel(block).cells[0][1].lines.length, 1, '★거절 뒤 줄 수 불변');
});

test('grdAddLine — 커밋이 실패하면 «활성줄»도 원복된다(없는 li 를 가리키지 않는다)', () => {
  const block = fixture();
  PG.grdSetActiveLine(block, { r: 0, c: 1, li: 0 });
  const res = PG.grdAddLine(block, { r: 0, c: 1 }, 0,
    { type: 'image', imgSrc: fakeDataUrl(GB.GRID_IMG_MAX_CHARS + 1), height: 0 });
  assert.equal(res.ok, false);
  assert.deepEqual(PG.grdGetActiveLine(block), { r: 0, c: 1, li: 0 },
    '★실패했는데 활성줄만 앞으로 갔다 — 패널이 «존재하지 않는 줄»을 그린다');
});

test('grdAddLine — UI 입구(opts.trusted)는 상한을 넘겨 커밋한다 / MCP 2인자 통로는 여전히 막힌다', () => {
  const block = fixture();
  const big = fakeDataUrl(GB.GRID_IMG_MAX_CHARS + 1);

  const res = PG.grdAddLine(block, { r: 0, c: 1 }, null, { type: 'image', imgSrc: big, height: 0 }, { trusted: true });
  assert.equal(res.ok, true, res.code);
  const lines = GB.getGridModel(block).cells[0][1].lines;
  assert.equal(lines.length, 2, '★UI 입구는 실사진(>200000자)을 넣을 수 있어야 한다 — 이게 현빈이 못 하던 바로 그것');
  assert.equal(lines[1].imgSrc.length, big.length);

  /* ★뒷문 봉쇄 — main.js:7024 가 부르는 «2인자» 호출은 그대로 거절돼야 한다. */
  const mcp = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'image', imgSrc: big }] } });
  assert.equal(mcp.ok, false, '★2인자(MCP) 통로가 새면 IPC 문자열 상한이 무의미해진다');
  assert.equal(mcp.code, 'TOO_LARGE');

  /* ★trusted 를 «partial 안»에 넣어도 안 먹혀야 한다(MCP 는 partial 을 JSON 으로 보낸다). */
  const smuggle = GB.updateGridBlock(block.id,
    { trusted: true, patchCell: { r: 0, c: 0, lines: [{ type: 'image', imgSrc: big }] } });
  assert.equal(smuggle.ok, false, '★partial.trusted 로 캡을 넘으면 제3의 뒷문이다');
});

/* ═══ 칸 기하 히트테스트 — 우클릭이 «칸 밖»에 떨어졌을 때 ═══════════════════
 * 거터(.grd-gutter, z-index:97 pointer-events:auto, #ss-handles-overlay = 블록 «바깥»)와
 * 블록 padding·gap 에서 우클릭하면 elementFromPoint 가 칸을 못 주고 메뉴 항목이 조용히 사라졌다. */

test('pickCellByRects — 칸 «안»은 그 칸을 준다(양성대조)', () => {
  const cells = [
    { r: 0, c: 0, rect: { left: 0,   top: 0, right: 100, bottom: 50 } },
    { r: 0, c: 1, rect: { left: 120, top: 0, right: 220, bottom: 50 } },
  ];
  assert.deepEqual(GB.pickCellByRects(cells, 50, 25), { r: 0, c: 0 });
  assert.deepEqual(GB.pickCellByRects(cells, 200, 25), { r: 0, c: 1 });
});

test('pickCellByRects — 칸 «사이 간격»(거터 자리)은 가까운 칸으로 떨어진다', () => {
  const cells = [
    { r: 0, c: 0, rect: { left: 0,   top: 0, right: 100, bottom: 50 } },
    { r: 0, c: 1, rect: { left: 120, top: 0, right: 220, bottom: 50 } },
  ];
  assert.deepEqual(GB.pickCellByRects(cells, 105, 25), { r: 0, c: 0 }, '★거터 왼쪽 — 왼 칸');
  assert.deepEqual(GB.pickCellByRects(cells, 116, 25), { r: 0, c: 1 }, '★거터 오른쪽 — 오른 칸');
});

test('pickCellByRects — 후보가 없으면 null(조용한 오판보다 «못 찾았다»가 낫다)', () => {
  assert.equal(GB.pickCellByRects([], 10, 10), null);
  assert.equal(GB.pickCellByRects(null, 10, 10), null);
});

/* ══ T-220 — 중첩 «안» 줄로 가는 «쓰기» 길 (2026-09-27) ═══════════════════════
 * ★T-221 이 «만드는» 길을 냈고(우클릭 「나란히 두 칸으로 나누기」), 여기가 «고치는» 길이다.
 *   현빈 순서 결정: 「만들기 먼저」(0926) — 만들 수 없는 것을 고치는 손잡이는 쓸 자리가 없다.
 * ★주소는 렌더러가 찍는 꼴 그대로다 — `"<열>.<줄>"` 을 `/` 로 이은 `np`(`_gridNestAddr`).
 *   읽는 쪽(prop-grid.js `_grdResolveNestAddr`)이 2026-09-25 부터 쓰던 그 꼴을 그대로 쓴다.
 * ⛔이 절은 «모델 입구»만 잰다. 패널이 그 길을 쓰는지는 «다음 커밋»의 몫이다 —
 *   한 커밋에 넣으면 「길이 났나」와 「손잡이가 붙었나」가 한 초록에 섞인다.
 * ★일곱을 «갈라» 잰다: 되는 것 둘(W1·W2) · 안 되는 것 셋(W3~W5) · 옛 길 무변(W6) · 음성대조(W7).
 * ⛔접두어가 `W`(write)인 까닭 — 이 레포엔 이미 «읽기·주소» 쪽 `N` 시리즈가 있다
 *   (tests/dom/grid-nested-addr.dom.spec.js 의 N8 등). 같은 글자를 쓰면 「N1 이 빨갛다」가
 *   어느 파일 얘기인지 갈리지 않는다.
 *   ⛔되는 것만 두면 「언제나 통과한다」와 구별이 안 되고, 그건 거름망이 죽은 것이다. */

/** 바깥 줄 하나 ＋ 중첩 줄(두 열, 각 한 줄) ＋ 옆 칸. */
function fixtureNested() {
  const { block } = GB.makeGridBlock({
    cols: [
      { width: 1, lines: [
        { type: 'body', text: '바깥' },
        { type: 'duo', gap: 24, cols: [
          { width: 1, lines: [{ type: 'body', text: 'A' }] },
          { width: 1, lines: [{ type: 'body', text: 'B' }] },
        ] },
      ] },
      { width: 1, lines: [{ type: 'body', text: '옆' }] },
    ],
  });
  assert.ok(block && block.id, '★블록이 안 만들어졌다 — 아래 단언은 전부 «다른 이유»로 초록이 된다');
  return block;
}
/** 중첩 «안» 줄 하나를 모델에서 읽는다. */
const nestedAt = (block, ci, ni) =>
  GB.getGridModel(block).cells[0][0].lines[1].cols[ci].lines[ni];

test('W1 ★중첩 «안» 줄을 고친다 — np 로 그 줄만 바뀐다', () => {
  const block = fixtureNested();
  const res = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 1, np: '0.0', fontSize: 33 } });
  assert.equal(res.ok, true, `★중첩 안 줄을 못 고친다 — 쓰기 길이 안 났다: ${res.code} ${res.message || ''}`);
  assert.equal(nestedAt(block, 0, 0).fontSize, 33, '★ok:true 인데 값이 안 들어갔다');
  assert.equal(nestedAt(block, 0, 0).text, 'A', '★같은 줄의 다른 값이 날아갔다(병합이 아니라 교체다)');
  /* ★★옆 열이 «안» 바뀌는가 — 경로를 잘못 걸으면 여기가 같이 바뀐다. */
  assert.equal(nestedAt(block, 1, 0).fontSize, undefined, '★옆 «열»까지 바뀌었다 — 경로가 열을 안 가른다');
  assert.equal(GB.getGridModel(block).cells[0][0].lines[0].fontSize, undefined, '★바깥 줄까지 바뀌었다');
});

test('W2 ★둘째 열도 «따로» 고쳐진다 — 열을 실제로 가른다', () => {
  const block = fixtureNested();
  const res = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 1, np: '1.0', text: '고쳤다' } });
  assert.equal(res.ok, true, `★둘째 열을 못 고친다: ${res.code} ${res.message || ''}`);
  assert.equal(nestedAt(block, 1, 0).text, '고쳤다');
  assert.equal(nestedAt(block, 0, 0).text, 'A', '★첫 열이 같이 바뀌었다 — 열 번호를 안 보고 있다');
});

test('W3 ★없는 주소는 «거절»한다 — 지어내지 않는다', () => {
  /* ⛔없는 자리에 줄을 만들면 「쓴 것 같은데 화면엔 없다」가 된다(이 레포의 고질). */
  const block = fixtureNested();
  const before = JSON.stringify(GB.getGridModel(block).cells);
  const res = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 1, np: '5.9', text: 'x' } });
  assert.equal(res.ok, false, '★없는 주소인데 ok:true 다');
  assert.equal(res.code, 'INVALID');
  assert.match(res.message, /np/, '★메시지가 «어느 입력»이 문제인지 말하지 않는다');
  assert.equal(JSON.stringify(GB.getGridModel(block).cells), before, '★거절했다면서 데이터는 이미 건드렸다');
});

test('W4 ★`np` 는 `lineIndex` 없이는 거절 — 조용히 무시하지 않는다', () => {
  /* ★`np` 는 «그 줄 안»을 가리키는 주소다. 어느 줄인지 없으면 뜻이 없다.
     ⛔무시하면 「보냈는데 아무 일도 안 났다」가 되고, 그건 ok:true 로 돌아오는 거짓 성공이다. */
  const block = fixtureNested();
  const res = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, np: '0.0', text: 'x' } });
  assert.equal(res.ok, false, '★lineIndex 없는 np 가 통과했다');
  assert.equal(res.code, 'INVALID');
  assert.match(res.message, /lineIndex/, '★무엇을 더 줘야 하는지 말하지 않는다');
});

test('W5 ★꼴이 틀린 주소도 거절 — 그리고 «상한»을 손으로 안 적는다', () => {
  const block = fixtureNested();
  for (const bad of ['abc', '0', '0.', '.0', '0.0/', '0.0/1.0/2.0']) {
    const res = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 1, np: bad, text: 'x' } });
    assert.equal(res.ok, false, `★꼴이 틀린 np(${JSON.stringify(bad)})가 통과했다`);
    assert.equal(res.code, 'INVALID', `★거절 code 가 다르다(${bad})`);
  }
  /* ★마지막 것은 «깊이» 초과다 — 렌더러가 그 자리를 안 그리므로 쓰는 것이 조용한 실패가 된다.
     ⛔상한 값을 검사에 베껴 적지 않는다: 위 목록의 세 마디가 상한(2)을 넘는다는 사실만 쓴다. */
});

test('W6 ★옛 길은 한 글자도 안 바뀐다 — np 없는 patchCell', () => {
  const block = fixtureNested();
  const res = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 0, text: '바깥고침' } });
  assert.equal(res.ok, true, '★바깥 줄 고치기가 깨졌다 — 새 길이 옛 길을 밟았다');
  assert.equal(GB.getGridModel(block).cells[0][0].lines[0].text, '바깥고침');
  assert.equal(nestedAt(block, 0, 0).text, 'A', '★중첩 안까지 건드렸다');
});

test('W7 ★음성대조 — 적용부에서 중첩 분기를 «떼면» N1 이 빨개진다', async () => {
  /* ⛔「고쳤더니 초록」은 판정이 아니다. 내가 «세운» 분기라 방향은 «떼기»다. */
  const RAW = fs.readFileSync(path.join(ROOT, 'js', 'blocks', 'grid-block.js'), 'utf8');
  const ANCHOR = '        cellPatch = { lines: nextLines };';
  assert.ok(RAW.includes(ANCHOR), '★앵커를 못 찾았다 — 이 대조는 아무것도 안 쟀다(적용부가 바뀌었나)');
  const mutated = RAW.replace(ANCHOR, '        cellPatch = { lines: _gridMergeLine(curLines, li, rest) };');
  assert.notEqual(mutated, RAW, '★변이가 주입되지 않았다');

  const snap = snapshotGridWindow();
  try {
    const M = await loadGridBlockSrc(mutated);
    const { block } = M.makeGridBlock({ cols: [
      { width: 1, lines: [
        { type: 'body', text: '바깥' },
        { type: 'duo', cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] },
                              { width: 1, lines: [{ type: 'body', text: 'B' }] }] },
      ] },
      { width: 1, lines: [{ type: 'body', text: '옆' }] },
    ] });
    const res = M.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 1, np: '0.0', fontSize: 33 } });
    const inner = M.getGridModel(block).cells[0][0].lines[1].cols[0].lines[0];
    /* ★분기를 떼면 «바깥 줄»(중첩 줄 자신)에 얹히거나 거절된다 — 어느 쪽이든 «안쪽»엔 안 닿아야 한다.
       ⛔여기서 ok 값을 못박지 않는다: 민감도 탐침이 먼저 거절할 수도 있어 두 갈래가 다 정상이다.
         재는 것은 «안쪽 줄이 안 바뀌었나» 하나다. */
    assert.notEqual(inner.fontSize, 33,
      `★분기를 뗐는데도 중첩 안 줄이 바뀌었다 — N1 이 재는 것은 «그 분기»가 아니다 (res=${JSON.stringify(res).slice(0, 120)})`);
  } finally {
    restoreGridWindow(snap);
  }
});
