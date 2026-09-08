/* U-GRIDTYPO — 그리드 «줄 단위» 타이포·필. (2026-09-08)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리)로 부르지 마라 — Node 24 에서 한 개도 안 돌고 죽는다.
 *
 * ★병명 (이 파일이 지키는 것의 출발점)
 *   현빈: 「그리드블럭 … 색이 너무 연해서 … 우측에서 타이포 조절할수 있게해줘야되는데」
 *   실측하니 「연한」게 아니라 «없었다» — _gridLineHtml 이 line.color 가 없으면 color: 를
 *   아예 안 찍고, .grd-line ~ .section-block 사이에 color 규칙이 0건이라 값이
 *   body{color:var(--ui-text)} = #e0e0e0 «어두운 에디터 크롬용 색»까지 올라가 상속됐다.
 *   흰 캔버스(#fff) 위에서 대비 1.32:1 — 빈 줄 안내문(#ccc, 1.61:1)보다 «더 연하다».
 *   ⇒ 처방은 값을 «바꾸는» 게 아니라 값을 «두는» 것이다.
 *
 * ★하네스 = grid-p1.test.js 의 import-스텁 기법. 손으로 쓴 모델이 아니라 «실제 소스»를 돌린다.
 * ⛔주석 걷어내기는 공용 부품(./_strip-comments.js)만 쓴다 — 자기 벌은 S-6 가 잡는다.
 * ⛔고정 창 slice(i, i±N) 금지. 소스는 readSrc() 로 읽는다(CRLF 방어).
 */
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');
const { makeStripper } = require('./_strip-comments.js');

const ROOT = path.join(__dirname, '../..');

/** 소스에서 «주석을 뺀 코드 줄»만. ⛔파일 하나마다 새 stripper(블록 주석 상태를 들고 간다). */
function codeLines(rel) {
  const strip = makeStripper();
  return readSrc(ROOT, rel).split('\n').map(l => strip(l));
}
const codeOf = (rel) => codeLines(rel).join('\n');

/* ── grid-block.js 를 «실물 그대로» 돌린다 (grid-p1.test.js 와 같은 기법) ── */
const srcPath = path.join(ROOT, 'js/blocks/grid-block.js');
let src = readSrc(srcPath);
const STUB = "const insertAfterSelected = () => {};\nconst genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\nconst bindBlock = () => {};\n";
{
  const before_ = src;
  src = src.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    STUB);
  assert.notEqual(src, before_, '소스에서 drag-utils/drag-drop import 2줄을 못 찾음 — 리팩터링됐나?');
}
const gcrAliasPath = path.join(os.tmpdir(), `grid-cell-resize-alias-typo-${process.pid}.mjs`);
{
  const before_ = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcrAliasPath).href));
  assert.notEqual(src, before_, "grid-cell-resize.js import 를 못 찾음");
}

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
        contains: (c) => _classes.has(c),
        add: (...cs) => cs.forEach(c => _classes.add(c)),
        remove: (...cs) => cs.forEach(c => _classes.delete(c)),
        replace: (a, b) => { if (!_classes.has(a)) return false; _classes.delete(a); _classes.add(b); return true; },
      },
      appendChild(child) { return child; },
      scrollIntoView() {},
    };
    return el;
  }
  return { createElement, getElementById: (id) => registry.get(id) || null };
}

let gridLineHtml, GRID_ROLES, makeGridBlock, updateGridBlock, getGridModel, gridPreviewLine, gridLineHasText;

before(async () => {
  const aliasPath = path.join(os.tmpdir(), `grid-typo-alias-${process.pid}.mjs`);
  fs.copyFileSync(path.join(ROOT, 'js/grid-cell-resize.js'), gcrAliasPath);
  fs.writeFileSync(aliasPath, src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const mod = await import(pathToFileURL(aliasPath).href);
  fs.unlinkSync(aliasPath); fs.unlinkSync(gcrAliasPath);
  ({ gridLineHtml, GRID_ROLES, makeGridBlock, updateGridBlock, getGridModel, gridPreviewLine, gridLineHasText } = mod);
});

/* ══ U0 — 입력이 살아 있다. 본 단언 «앞»에 세운다. ═══════════════════════ */

test('U0 ★하네스가 실제로 렌더러를 돌린다 (빈 문자열끼리 비교하며 초록이 되지 않는다)', () => {
  const out = gridLineHtml({ type: 'body', text: 'A' }, 'left', 0, null);
  assert.ok(out.includes('class="grd-line grd-body"'), `산출이 그리드 줄이 아니다: ${out}`);
  assert.ok(Object.keys(GRID_ROLES).length === 6, '역할이 6종이 아니다 — 표가 낡았다');
});

/* ══ U1-a — 줄별 타이포 «5종»이 실제로 먹는다 ════════════════════════════
 * 실측(§0-⑷)으로 세었을 때 _typo-section 이 내는 컨트롤 중 그리드에서 «먹는» 것은 4개뿐이고
 * line-height / letter-spacing / font-family / italic / strike 는 렌더러에 «자리가 없었다».
 * 되돌리면 빨강: 마지막 return 의 `line-height:${lh};letter-spacing:${ls};` 를 role 값으로 되돌리면. */

test('U1-a ★줄별 lh / ls / fontFamily / italic / strike 가 전부 산출에 찍힌다', () => {
  const out = gridLineHtml({
    type: 'body', text: '가나다',
    lineHeight: 2.2, letterSpacing: 1.5, fontFamily: "'Inter', sans-serif", italic: '1', strike: '1',
  }, 'left', 0, null);
  for (const want of ['line-height:2.2;', 'letter-spacing:1.5px;', "font-family:'Inter', sans-serif;",
                      'font-style:italic;', 'text-decoration:line-through;']) {
    assert.ok(out.includes(want), `산출에 «${want}» 가 없다 — 렌더러가 그 필드를 안 본다:\n${out}`);
  }
});

test('U1-b ★값을 «안 준» 줄은 역할 폴백이 살아 있다 (안 건드린 줄이 흔들리면 안 된다)', () => {
  // 짝(음성대조): U1-a 가 「바뀐다」를, 이게 「안 바뀐다」를 잰다. 둘이 같이 있어야 뜻이 있다.
  const out = gridLineHtml({ type: 'body', text: 'A' }, 'left', 0, null);
  assert.ok(out.includes('line-height:1.6;'), `역할 lh 가 안 나온다:\n${out}`);
  assert.ok(out.includes('letter-spacing:0;'), `역할 ls 가 안 나온다:\n${out}`);
  assert.equal(/font-family:|font-style:|text-decoration:/.test(out), false,
    `안 준 필드가 산출에 새어 나왔다 — 기존 저장 프로젝트가 로드만으로 흔들린다:\n${out}`);
  // ★자간 단위 비대칭은 «의도»다 — 역할은 em(크기 따라감), 사용자가 정하면 px(고정).
  const label = gridLineHtml({ type: 'label', text: 'L' }, 'left', 0, null);
  assert.ok(label.includes('letter-spacing:0.04em;'), `label 역할 자간이 em 이 아니다:\n${label}`);
});

/* ══ U1-c — 형광펜을 «왜» 감췄나 (§1-B 주석의 기계 짝) ═══════════════════
 * 되돌리면 빨강: prop-grid.js 에서 `showHighlight: false,` 한 줄을 지우면. */

test('U1-c ★_typo-section 에 showHighlight 가 있고, prop-grid 가 false 를 «명시»한다', () => {
  const typo = codeOf('js/props/_typo-section.js');
  assert.match(typo, /showHighlight\s*=\s*true/,
    '_typo-section.js 에 showHighlight 옵션이 없다 — 그리드가 H 를 끌 방법이 사라졌다');
  assert.match(typo, /\$\{showHighlight\s*\?/,
    'showHighlight 를 받기만 하고 «쓰지» 않는다 — H 버튼이 그대로 나온다');

  const grid = codeOf('js/props/prop-grid.js');
  assert.match(grid, /showHighlight:\s*false/,
    'prop-grid.js 가 showHighlight:false 를 «명시»하지 않는다. ' +
    '그리드 줄에서 «글자 배경»은 line.bg 이고, line.bg 가 있으면 렌더러가 «뱃지» 분기로 갈아탄다 — ' +
    'inline-block + padding + border-radius:999px, 즉 형광펜이 «알약»이 된다. ' +
    '되돌리려면 line.bg 를 넓히는 별건 발주다.');
});

test('U1-c-전제 ★양성대조 — 이 소스 훑기가 «실제로» 파일을 읽고 있다', () => {
  // 「0건」이 «대상 부재»인지 «내가 못 잼»인지 가른다.
  const grid = codeOf('js/props/prop-grid.js');
  assert.ok(grid.length > 3000, `prop-grid.js 를 ${grid.length}자로 읽었다 — 너무 짧다(못 읽고 있다)`);
  assert.match(grid, /export function showGridProperties/, '패널 진입점을 못 찾는다 — 잣대가 낡았다');
  // 주석 거르개가 «살아 있다»: 주석 안에만 있는 말은 안 잡힌다.
  assert.equal(/⛔showHighlight:false — 「빠뜨린 것」이 아니다/.test(grid), false,
    '주석이 안 걷혔다 — 이 파일의 모든 소스 단언이 주석까지 코드로 읽고 있다');
});

/* ══ U1-d — 뱃지 분기는 «안 건드린다» (§7-ⓐ 조건2 보강) ═══════════════════
 * 뱃지는 보통 «어두운 알약»이라 지금의 밝은 상속색이 «맞는 결과»다. 여기에 역할색(#555)을
 * 박으면 지금보다 나빠진다. ⇒ 뱃지 산출은 «바이트 동일» 유지.
 * 되돌리면 빨강: 뱃지 분기의 `${color ? `color:${color};` : ''}` → `color:${color || role.color};`. */

const BADGE_GOLDEN = '<div style="text-align:left;"><span class="grd-badge" style="display:inline-block;background:#111;font-size:16px;font-weight:600;line-height:1.2;letter-spacing:0.04em;padding:6px 16px;border-radius:999px;white-space:pre-wrap;word-break:keep-all;">X</span></div>';

test('U1-d ★뱃지 줄 산출이 «바이트 동일»이다 (역할색이 알약 위로 새지 않는다)', () => {
  const got = gridLineHtml({ type: 'label', bg: '#111', text: 'X' }, 'left', 0, null);
  assert.equal(got, BADGE_GOLDEN,
    '뱃지 산출이 달라졌다. 뱃지는 «어두운 알약»이 전제라 지금의 상속색이 맞는 결과다 — ' +
    '역할 기본색은 «평범한 줄»(마지막 return)에만 적용한다.\n' +
    `  전: ${BADGE_GOLDEN}\n  후: ${got}`);
});

test('U1-d-짝 ★뱃지도 «명시색»은 여전히 먹는다 (골든이 잣대를 죽여서 통과하는 게 아니다)', () => {
  const got = gridLineHtml({ type: 'label', bg: '#111', text: 'X', color: '#ff0000' }, 'left', 0, null);
  assert.ok(got.includes('color:#ff0000;'), `뱃지에서 명시색이 사라졌다:\n${got}`);
  assert.notEqual(got, BADGE_GOLDEN, '골든과 같다 — 이 하네스가 color 를 아예 안 보고 있다');
});

/* ══ U2-a — patchCell{lineIndex} 는 «그 줄만» 만진다 ═════════════════════
 * 되돌리면 빨강: _gridMergeLine 의
 *   `next[i] = Object.assign({}, next[i], fields);`
 * 를 `return lines.map(l => Object.assign({}, l, fields));` 로 바꾸면. */

function make3LineGrid() {
  const { block } = makeGridBlock({
    cols: [{ width: 1, lines: [
      { type: 'h2', text: '첫' }, { type: 'body', text: '둘' }, { type: 'caption', text: '셋' },
    ] }],
  });
  return block;
}

test('U2-a ★lineIndex:1 을 패치하면 [0]·[2] 는 deep-equal 그대로다', () => {
  const block = make3LineGrid();
  const before = JSON.parse(JSON.stringify(getGridModel(block).cells[0][0].lines));
  const res = updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 1, fontSize: 33, color: '#111111' } });
  assert.equal(res.ok, true, `patch 실패: ${JSON.stringify(res)}`);
  const after = getGridModel(block).cells[0][0].lines;
  assert.deepEqual(after[0], before[0], '이웃 줄 [0] 이 변했다 — patch 가 셀 전체를 덮었다');
  assert.deepEqual(after[2], before[2], '이웃 줄 [2] 가 변했다');
  assert.equal(after[1].fontSize, 33);
  assert.equal(after[1].color, '#111111');
  assert.equal(after[1].text, '둘', '대상 줄의 «다른» 필드가 날아갔다');
});

test('U2-a-전제 ★양성대조 — «같은 비교기»가 lineIndex:0 의 변화를 실제로 잡는다', () => {
  // 이게 없으면 위의 deep-equal 은 「잣대가 죽어서」 통과한 것일 수 있다.
  const block = make3LineGrid();
  const before = JSON.parse(JSON.stringify(getGridModel(block).cells[0][0].lines));
  updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 0, fontSize: 33, color: '#111111' } });
  const after = getGridModel(block).cells[0][0].lines;
  assert.notDeepEqual(after[0], before[0], '같은 비교기가 «변경»을 못 잡는다 — U2-a 는 아무것도 안 지킨다');
});

/* ══ U4 — 미리보기와 커밋이 «같은 되쓰기»를 쓴다 ═════════════════════════
 * 패널은 연속 input(색 피커 드래그) 때 updateGridBlock 을 못 부른다 — 그건 스스로
 * pushHistory 를 쌓고 패널을 통째로 다시 그려 포커스를 끊는다. 그래서 gridPreviewLine 이 있다.
 * ⇒ 「두 벌이 따로 늙는」 것을 여기서 막는다.
 * 되돌리면 빨강: gridPreviewLine 이 _gridCellPatchDataset / _gridMergeLine 을 안 쓰고 자기 벌을 만들면. */

test('U4 ★gridPreviewLine 과 updateGridBlock 이 «같은 dataset» 을 만든다 (행 0)', () => {
  const fields = { fontSize: 41, color: '#123456', italic: '1' };
  const a = make3LineGrid(); gridPreviewLine(a, 0, 0, 1, fields);
  const b = make3LineGrid(); updateGridBlock(b.id, { patchCell: { r: 0, c: 0, lineIndex: 1, ...fields } });
  assert.equal(a.dataset.cols, b.dataset.cols, '미리보기와 커밋의 dataset.cols 가 다르다 — 되쓰기가 두 벌이 됐다');
});

test('U4-b ★행 0 «아래» 행에서도 같다 (cells 갈래도 같은 함수를 탄다)', () => {
  const mk = () => {
    const { block } = makeGridBlock({
      cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }],
      rows: [{ height: 'auto' }, { height: 'auto' }],
      cells: [[{ lines: [{ type: 'body', text: 'A' }] }], [{ lines: [{ type: 'body', text: 'B' }, { type: 'body', text: 'C' }] }]],
    });
    return block;
  };
  const fields = { lineHeight: 2.4, letterSpacing: -3 };
  const a = mk(); const okA = gridPreviewLine(a, 1, 0, 1, fields);
  const b = mk(); const okB = updateGridBlock(b.id, { patchCell: { r: 1, c: 0, lineIndex: 1, ...fields } });
  assert.equal(okA, true, 'gridPreviewLine 이 2행을 못 찾았다');
  assert.equal(okB.ok, true, `updateGridBlock 실패: ${JSON.stringify(okB)}`);
  assert.equal(a.dataset.cells, b.dataset.cells, '2행 되쓰기가 갈렸다');
});

test('U4-전제 ★양성대조 — 이 비교가 «다른 필드»는 실제로 갈라 낸다', () => {
  const a = make3LineGrid(); gridPreviewLine(a, 0, 0, 1, { fontSize: 41 });
  const b = make3LineGrid(); gridPreviewLine(b, 0, 0, 1, { fontSize: 42 });
  assert.notEqual(a.dataset.cols, b.dataset.cols, '비교기가 죽었다 — U4 는 아무것도 안 지킨다');
});

test('U4-c ★범위 밖이면 false 를 내고 dataset 을 «안 건드린다» (화면·데이터가 안 갈라진다)', () => {
  const block = make3LineGrid();
  const before = block.dataset.cols;
  assert.equal(gridPreviewLine(block, 0, 0, 9, { fontSize: 41 }), false, '없는 줄에 썼다');
  assert.equal(gridPreviewLine(block, 5, 0, 0, { fontSize: 41 }), false, '없는 행에 썼다');
  assert.equal(gridPreviewLine(block, 0, 7, 0, { fontSize: 41 }), false, '없는 열에 썼다');
  assert.equal(block.dataset.cols, before, '실패했는데 dataset 이 변했다');
});

/* ══ U7 — 「글자를 담는 줄인가」 판정 ════════════════════════════════════
 * 패널은 gap/image/중첩/graph 줄에 Typography 절을 띄우면 안 된다(그 줄엔 글자가 없다).
 * ★이 판정은 렌더러에서 «파생»된다 — 목록을 패널에 베끼면 두 벌이 되고, 그 목록엔
 *   중첩 그리드의 스키마 enum 이 들어 있어 개명 잔존 검사(S1)와도 부딪힌다(실제로 잡혔다).
 * 되돌리면 빨강: gridLineHasText 의 `^` 앵커를 빼면 — 중첩 줄이 «자기 안쪽» .grd-line 때문에
 *   true 가 된다(첫 판이 실제로 그렇게 틀렸다). */

test('U7 ★글자 줄만 true — 중첩은 «안쪽» 줄 때문에 오판되지 않는다', () => {
  assert.equal(gridLineHasText({ type: 'body', text: 'A' }), true, '보통 줄');
  assert.equal(gridLineHasText({ type: 'label', bg: '#111', text: 'X' }), true, '뱃지 줄 — 안쪽 span 이 글자를 담는다');
  assert.equal(gridLineHasText({ type: 'gap', height: 20 }), false, 'gap');
  assert.equal(gridLineHasText({ type: 'image', imgSrc: 'x.png' }), false, 'image');
  assert.equal(gridLineHasText({ type: 'graph', items: [{ label: 'a', value: 10 }] }), false, 'graph');
  assert.equal(gridLineHasText({ type: 'duo', cols: [{ width: 1, lines: [{ type: 'body', text: 'inner' }] }] }), false,
    '★중첩 줄이 true 다 — 자기 «안쪽» 줄의 .grd-line 을 보고 오판했다(부분 문자열로 재면 이렇게 된다)');
  assert.equal(gridLineHasText(null), false);
});

/* ══ U8 · U9 — 하네스가 «못 띄우는» 두 자리는 소스로 못박는다 ═══════════
 * ⚠️솔직히 적는다: tests/dom 하네스는 block-drag 의 bindBlock 과 editor.js 의 deselectAll 을
 *   못 띄운다(에디터 전역이 통째로 필요하다). 그래서 이 둘은 «소스»로 잰다 —
 *   「배선이 있다」까지고 「눌러 보니 되더라」가 아니다. 실기 확인은 지디 몫(계획서 §9).
 *   ⛔그래도 «안 재는» 것보다 낫다: 이 두 줄이 지워지면 아무 검사도 안 울리는 상태였다.
 */

test('U8 ★클릭 핸들러가 «누른 줄»의 주소를 패널에 넘긴다 (그리드에서만)', () => {
  const src = codeOf('js/block-drag.js');
  assert.match(src, /window\[showFn\]\?\.\(block,\s*_grdAddr\)/,
    'block-drag 의 클릭 핸들러가 2번째 인자를 안 넘긴다 — 줄을 눌러도 패널이 첫 줄만 본다');
  assert.match(src, /showFn === 'showGridProperties'/,
    '그리드 갈래를 안 가른다 — 다른 블록에도 주소를 넘기고 있다');
  assert.match(src, /_gridEditable\(e\.target\)/,
    '★주소를 _gridEditable 로 안 뽑는다 — 「어느 줄이 편집 대상인가」 판정이 두 벌이 됐다. ' +
    '⛔DOM 순서로 역산하지 마라(이 레포에서 순서 추측이 실제 버그를 냈다).');
  assert.match(src, /window\.showGridProperties\?\.\(block, \{ r, c, li \}\)/,
    '더블클릭 편집 진입 시 그 줄이 «선택»으로 안 간다');
});

test('U9 ★deselectAll 이 그리드 줄 마커를 걷는다', () => {
  const src = codeOf('js/editor.js');
  assert.match(src, /querySelectorAll\('\.grd-line-selected'\)/,
    'deselectAll 에서 .grd-line-selected 를 안 걷는다 — 블록을 떠나도 마커가 캔버스에 남는다');
  // 양성대조 — 같은 훑기가 «이웃 토큰»을 실제로 찾는다(잣대가 살아 있다).
  assert.match(src, /querySelectorAll\('\.bn2-line-selected'\)/,
    '이웃 토큰조차 못 찾는다 — 이 소스 훑기가 죽었다(위 단언은 자기통과였다)');
});
