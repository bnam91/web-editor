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
 * ★0줄 가드(EMPTY_CELL_LINES) 양성/음성대조 — 이 가드는 이 파일 이전엔 «어느 테스트도»
 *   재지 않았다(전수 grep 0건). 「초록 ≠ 가드가 지킨다」 원칙대로 가드를 지운 사본으로
 *   실제로 빨강(→통과)이 되는지 확인한다.
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
    + 'export const alignBtn = () => "";\nexport const bindSlider = () => {};\n');
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
  assert.doesNotMatch(block.innerHTML.match(/data-c="1"[^>]*>/)[0], /grd-cell-empty/,
    '★줄이 있는 칸(col1)까지 「빈 칸」으로 오判되면 안내문이 글자 위에 겹쳐 뜬다');
});

test('renderGridBlock — grdAddLine 으로 채운 뒤엔 .grd-cell-empty 가 사라진다', () => {
  const block = fixture();
  PG.grdAddLine(block, { r: 0, c: 0 }, null, { type: 'body', text: 'filled' });
  GB.renderGridBlock(block);
  assert.doesNotMatch(block.innerHTML.match(/data-c="0"[^>]*>/)[0], /grd-cell-empty/);
});

/* ═══ 0줄 가드(EMPTY_CELL_LINES) — 양성/음성대조 ═════════════════════════════
 * ★이 가드는 patchCell{lines:[]} 로 «기존 줄을 지워 칸을 통째로 비우는」 시도를 막는다
 *   (grid-block.js _gridRejectLinesLength, allowEmpty=false 경로). grdAddLine 은 이 가드에
 *   안 걸린다(0→1 이라 length===0 조건에 안 든다) — 그래서 여기서 별도로 잰다. */

test('0줄 가드 — 양성대조: 이미 줄이 있는 셀을 patchCell{lines:[]} 로 비우면 거절된다', () => {
  const block = fixture();   // col1 lines=[X]
  const res = GB.updateGridBlock(block.id, { patchCell: { r: 0, c: 1, lines: [] } });
  assert.equal(res.ok, false);
  assert.equal(res.code, 'EMPTY_CELL_LINES');
  assert.equal(GB.getGridModel(block).cells[0][1].lines.length, 1, '★거절 뒤 데이터가 «안 변했다»');
});

test('0줄 가드 — 음성대조(변이): 가드를 지운 사본은 통과한다(가드가 «진짜 막고 있었다»는 증거)', async () => {
  const RAW = fs.readFileSync(path.join(ROOT, 'js', 'blocks', 'grid-block.js'), 'utf8');
  const mutated = RAW.replace(
    /const _linesReject = _gridRejectLinesLength\(rest\.lines\);\n\s*if \(_linesReject\) return _linesReject;\n/,
    '');
  assert.notEqual(mutated, RAW, '★변이가 주입되지 않았다 — 이 대조는 아무것도 안 쟀다');

  const snap = snapshotGridWindow();   // ★변이 모듈 import 가 window.updateGridBlock 등을 덮어쓴다
  try {
    const M = await loadGridBlockSrc(mutated);
    const { block } = M.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [] }] });
    const res = M.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lines: [] } });
    assert.equal(res.ok, true, '★가드를 지웠는데도 거절된다 — 이 변이는 그 가드를 안 쟀다');
  } finally {
    restoreGridWindow(snap);   // ★뒤 테스트(있다면)가 원본 grid-block.js 를 계속 쓰게 원복
  }
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
