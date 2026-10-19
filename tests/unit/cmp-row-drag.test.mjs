/* 단위 하네스 — ★1017t1c4 「비교(컴패리전) 블록: 캔버스에서 칸 경계를 끌어 행 높이 조절」
 *   현빈 2026-10-20 「c4 - 캔버스에서 끌어서」(패널 일괄 조절은 ★이미 있으므로 안 만든다).
 *
 * ★무엇을 잠그나 — 셋이다. ⛔하나로 뭉치지 마라(깨지는 까닭이 다르다).
 *   ㉠ «산식» — 상한·하한·반올림·NaN. 실제 소스 파일(js/grid-cell-resize.js)을 ★바이트 그대로
 *      .mjs 사본으로 import 한다(grid-cell-resize.test.mjs 선례 그대로 · 손으로 쓴 모델 금지).
 *   ㉡ «SSOT» — 그 두 수를 ★소비자 셋이 전부 상수로 가져오는가(grid-callsite-ssot.test.mjs 선례).
 *      ⚠️이건 «동작»이 아니라 «소스 문자열»을 단언한다. 정상 리팩터링에도 빨강이 날 수 있다 —
 *        그때 이 파일을 지우지 말고 「그 수가 여전히 한 곳에서 오는가」를 확인한 뒤 패턴을 고쳐라.
 *   ㉢ «옛 저장본 무회귀» — 거터를 «띄우는» 길이 블럭에 ★아무것도 쓰지 않는가.
 *      (높이 키가 없던 저장본을 열어 블럭을 골랐을 때 `data-row-heights` 가 생기면 바이트가 바뀐다.)
 *
 * ⛔이 파일의 초록을 «증거»로 쓰지 마라 — 변이 목록이 보고에 같이 있어야 한다(변이는 ㉠㉡㉢ 각각에 있다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readSrc } from './_srcread.js';          // ★CRLF 체크아웃 방어
import { sliceBlock } from './_slice-block.js';   // ★구간 떠내기는 공용 부품 하나로(끝은 균형괄호로)
import { stripComments } from './_strip-comments.js';   // ★주석 속 옛 리터럴을 결함으로 세지 않기

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

/* ── ㉠ 산식 — 실물 소스를 그대로 import ─────────────────────────────────── */
const srcPath = path.join(ROOT, 'js/grid-cell-resize.js');
const aliasPath = path.join(os.tmpdir(), `cmp-row-drag-alias-${process.pid}.mjs`);
fs.copyFileSync(srcPath, aliasPath);
const {
  CMP_ROW_H_MIN, CMP_ROW_H_MAX, resizeCmpRowHeight, setCmpRowHeight,
  ROW_H_MAX, ROW_H_MIN,
} = await import(pathToFileURL(aliasPath).href);
fs.unlinkSync(aliasPath);

test('㉠0 ★전제 — 이 파일이 재는 바닥·천장이 «실제로» 16·400 이다(아래 이름에 수를 적었다)', () => {
  /* ★조건을 이름에 넣었으면 재기 «전에» 그 조건이 섰음을 단언한다.
     아래 검사들이 「400 에서 멈춘다」를 재는데, 상수가 조용히 바뀌면 그 이름이 거짓이 된다. */
  assert.equal(typeof resizeCmpRowHeight, 'function', 'resizeCmpRowHeight 를 못 가져왔다 — 하네스가 부서졌다');
  assert.equal(typeof setCmpRowHeight, 'function', 'setCmpRowHeight 를 못 가져왔다 — 하네스가 부서졌다');
  assert.equal(CMP_ROW_H_MIN, 16, '비교 행 높이 바닥이 16 이 아니다 — 패널 `.cmp-row-h`·MCP 문과 갈라졌나?');
  assert.equal(CMP_ROW_H_MAX, 400, '비교 행 높이 천장이 400 이 아니다 — 패널 `.cmp-row-h`·MCP 문과 갈라졌나?');
});

test('㉠1 [음성대조 ⑴] 상한을 넘겨 끌면 ★상한(400)에서 멈춘다', () => {
  assert.equal(resizeCmpRowHeight(CMP_ROW_H_MAX - 10, 500), CMP_ROW_H_MAX);
  assert.equal(resizeCmpRowHeight(CMP_ROW_H_MAX, 1), CMP_ROW_H_MAX);
  assert.equal(resizeCmpRowHeight(100, 100000), CMP_ROW_H_MAX);
  // ★가드 경로도 같은 클램프를 지난다 — 델타가 망가졌다고 상한이 풀릴 이유가 없다(그리드 적대검수 G3).
  assert.equal(resizeCmpRowHeight(5000, NaN), CMP_ROW_H_MAX);
});

test('㉠2 [음성대조 ⑵] 하한 밑으로 끌면 ★하한(16)에서 멈춘다', () => {
  assert.equal(resizeCmpRowHeight(CMP_ROW_H_MIN + 10, -500), CMP_ROW_H_MIN);
  assert.equal(resizeCmpRowHeight(CMP_ROW_H_MIN, -1), CMP_ROW_H_MIN);
  assert.equal(resizeCmpRowHeight(64, -100000), CMP_ROW_H_MIN);
});

test('㉠3 [음성대조 ⑶] 드래그 ★없이는(델타 0) 높이가 ★안 바뀐다', () => {
  for (const h of [16, 64, 137, 400]) {
    assert.equal(resizeCmpRowHeight(h, 0), h, `델타 0 인데 ${h} 가 바뀌었다`);
  }
  // 소수 높이는 정수로만 반올림된다(렌더가 px 정수를 박는다) — «바뀜»이 아니라 «정규화»다.
  assert.equal(resizeCmpRowHeight(100.4, 0), 100);
  assert.equal(Number.isInteger(resizeCmpRowHeight(133.7, 12.2)), true);
});

test('㉠4 끌린 만큼 늘고 줄어든다(중간 구간에서는 클램프가 안 끼어든다)', () => {
  assert.equal(resizeCmpRowHeight(100, 30), 130);
  assert.equal(resizeCmpRowHeight(100, -30), 70);
});

test('㉠5 ★비교의 천장은 그리드와 ★다르다 — 「통일」이 들어오면 빨개진다', () => {
  /* 일부러 다르다(grid-cell-resize.js 머리말): 비교 행 높이는 전 칼럼 공통이고 패널·MCP 문이
     이미 16~400 으로 받아 왔다. 통일하면 이미 저장된 프로젝트에서 패널 입력과 드래그가 갈린다. */
  assert.notEqual(CMP_ROW_H_MAX, ROW_H_MAX, '비교 천장이 그리드 천장과 같아졌다 — 통일한 사람이 있다');
  assert.notEqual(CMP_ROW_H_MIN, ROW_H_MIN, '비교 바닥이 그리드 바닥과 같아졌다 — 통일한 사람이 있다');
});

test('㉠6 [음성대조 ⑷] ★다른 행을 끌면 ★그 행만 바뀐다(이웃 불변 · 입력 배열 불변)', () => {
  const before = [100, null, 200, 300];
  const after = setCmpRowHeight(before, 2, 150);
  assert.deepEqual(after, [100, null, 150, 300], '끌지 않은 행이 같이 바뀌었다');
  assert.deepEqual(before, [100, null, 200, 300], '★받은 배열을 건드렸다 — 호출부가 이력으로 들고 있는 값이다');
  // 비어 있던 자리를 처음 끌면 그 앞자리는 null(기본 높이) 그대로 생긴다
  assert.deepEqual(setCmpRowHeight([], 3, 80), [null, null, null, 80]);
});

test('㉠7 setCmpRowHeight 도 ★같은 클램프를 지난다(패널과 드래그가 갈릴 수 없다)', () => {
  assert.deepEqual(setCmpRowHeight([], 0, 9999), [CMP_ROW_H_MAX]);
  assert.deepEqual(setCmpRowHeight([], 0, -5), [CMP_ROW_H_MIN]);
  assert.deepEqual(setCmpRowHeight([], 0, 0), [CMP_ROW_H_MIN]);   // 패널에 글자를 치면 0 → 바닥(옛 동작)
});

test('㉠8 null/빈값 = 「기본 높이로 되돌림」 · 꼬리의 null 은 걷는다', () => {
  assert.deepEqual(setCmpRowHeight([100, 200], 1, null), [100]);
  assert.deepEqual(setCmpRowHeight([100, 200], 1, ''), [100]);
  assert.deepEqual(setCmpRowHeight([100, 200], 0, null), [null, 200]);
  assert.deepEqual(setCmpRowHeight([100], 0, null), [], '전부 비면 빈 배열이어야 한다(패널 규약)');
  assert.deepEqual(setCmpRowHeight([100, 200], 1, 'abc'), [100], '수가 아니면 기본으로 되돌린다');
});

/* ── ㉡ SSOT — 소비자 셋이 전부 상수를 가져온다 ───────────────────────────── */
const SRC = {
  overlay: readSrc(ROOT, 'js/overlay-handles.js'),
  cmpBlock: readSrc(ROOT, 'js/blocks/comparison-block.js'),
  cmpPanel: readSrc(ROOT, 'js/props/prop-comparison.js'),
  editor: readSrc(ROOT, 'js/editor.js'),
};

test('㉡1 ★드래그 호출이 min/max 를 «넘기지 않는다» — 넘기면 모듈 기본값이 죽는다', () => {
  const code = stripComments(SRC.overlay);
  const calls = [...code.matchAll(/resizeCmpRowHeight\s*\(([^)]*)\)/g)].map(m => m[1]);
  assert.ok(calls.length > 0, 'resizeCmpRowHeight 호출을 못 찾았다 — 리팩터링됐나? 패턴을 갱신하라');
  for (const args of calls) {
    const n = args.split(',').length;
    assert.equal(n, 2,
      `resizeCmpRowHeight(${args}) — 인자가 ${n}개다. 바닥·천장을 넘기면 CMP_ROW_H_MIN/MAX 가 죽는다 ` +
      '(그리드가 「패널 4000 / 드래그 2000」으로 갈렸던 그 결함).');
  }
});

test('㉡2 ★소비자 셋이 «상수를 import» 한다 — 리터럴 16·400 을 다시 적지 않았다', () => {
  // ⑴ 문 검증(comparison-block.js) — 범위 비교가 상수 이름으로 돈다
  const b = stripComments(SRC.cmpBlock);
  assert.match(b, /import\s*\{[^}]*CMP_ROW_H_MIN[^}]*CMP_ROW_H_MAX[^}]*\}\s*from\s*'\.\.\/grid-cell-resize\.js'/,
    'comparison-block.js 가 바닥·천장을 grid-cell-resize.js 에서 안 가져온다');
  assert.match(b, /n\s*<\s*CMP_ROW_H_MIN\s*\|\|\s*n\s*>\s*CMP_ROW_H_MAX/,
    'rowHeights 범위 검증이 상수를 안 쓴다 — 손으로 적은 수는 따로 늙는다');
  assert.equal(/n\s*<\s*16\s*\|\|\s*n\s*>\s*400/.test(b), false,
    'comparison-block.js 에 리터럴 16/400 범위 검증이 남아 있다');

  // ⑵ 패널(prop-comparison.js) — 숫자칸 min/max 와 클램프 둘 다
  const p = stripComments(SRC.cmpPanel);
  assert.match(p, /import\s*\{[^}]*CMP_ROW_H_MIN[^}]*CMP_ROW_H_MAX[^}]*setCmpRowHeight[^}]*\}\s*from\s*'\.\.\/grid-cell-resize\.js'/,
    'prop-comparison.js 가 바닥·천장·쓰는 함수를 grid-cell-resize.js 에서 안 가져온다');
  assert.match(p, /class="prop-number cmp-row-h"[^`]*min="\$\{CMP_ROW_H_MIN\}"\s*max="\$\{CMP_ROW_H_MAX\}"/,
    '패널 행 높이 숫자칸의 min/max 가 상수가 아니다 — 패널만 다른 범위를 받게 된다');
  assert.equal(/Math\.max\(16,\s*Math\.min\(400/.test(p), false,
    'prop-comparison.js 에 손으로 적은 16/400 클램프가 남아 있다 — setCmpRowHeight 를 써라');

  // ⑶ 드래그(overlay-handles.js) — 상수를 직접 안 적고 함수만 쓴다
  const o = stripComments(SRC.overlay);
  assert.match(o, /import\s*\{[^}]*resizeCmpRowHeight[^}]*setCmpRowHeight[^}]*\}\s*from\s*'\.\/grid-cell-resize\.js'/,
    'overlay-handles.js 가 비교 행 높이 함수를 grid-cell-resize.js 에서 안 가져온다');
});

test('㉡3 ★«쓰는 자리»는 한 함수·한 자리다 — dataset.rowHeights 쓰기가 파일마다 하나뿐', () => {
  /* 「행 높이를 다른 자리에서 따로 셈하지 마라」(grid-block.js:2670)를 비교에서도 지킨다.
     ★분모를 적는다: 이 단언이 보는 것은 ★이 두 파일 안의 `dataset.rowHeights =` 꼴뿐이다
     (전수라고 «주장»하지 않는다 — comparison-block.js 의 문 커밋은 draft 경로로 따로 있다). */
  const o = stripComments(SRC.overlay);
  const writesO = [...o.matchAll(/dataset\.rowHeights\s*=/g)].length;
  assert.equal(writesO, 1, `overlay-handles.js 의 rowHeights 쓰기가 ${writesO}곳이다 — 드래그 한 자리여야 한다`);
  assert.match(o, /dataset\.rowHeights\s*=\s*JSON\.stringify\(setCmpRowHeight\(/,
    '드래그가 setCmpRowHeight 를 지나지 않고 배열을 직접 만든다 — 패널과 갈라진다');

  const p = stripComments(SRC.cmpPanel);
  assert.match(p, /setCmpRowHeight\(/, '패널이 setCmpRowHeight 를 안 쓴다 — 드래그와 두 벌이 된다');
});

test('㉡4 ★읽는 자도 한 벌 — 패널이 제 JSON.parse 사본을 들지 않는다', () => {
  const p = stripComments(SRC.cmpPanel);
  assert.equal(/JSON\.parse\(d\.rowHeights/.test(p), false,
    'prop-comparison.js 가 rowHeights 파싱 사본을 다시 들었다 — cmpRowHeights 한 벌을 써라');
  assert.match(p, /const _rowHeights = cmpRowHeights;/,
    '패널이 cmpRowHeights(렌더러가 쓰는 그 함수)를 안 쓴다');
  const b = stripComments(SRC.cmpBlock);
  assert.match(b, /export function cmpRowHeights\(d\)/, 'comparison-block.js 가 읽는 자를 안 내보낸다');
});

test('㉡5 ★강조 배율(featScale)도 한 자리 — 드래그가 제 parseFloat 를 안 든다', () => {
  /* 강조 칼럼의 렌더 높이는 round(기본높이 × featScale) 다. 드래그가 이 수를 따로 셈하면
     렌더와 갈려 「조금 끌었는데 많이 늘었다」가 된다. ⇒ cmpFeatScale 한 자리. */
  const b = stripComments(SRC.cmpBlock);
  const parses = [...b.matchAll(/parseFloat\(\s*(?:d\s*&&\s*)?d\.featScale\s*\)/g)].length;
  assert.equal(parses, 1, `comparison-block.js 가 featScale 을 ${parses}곳에서 파싱한다 — cmpFeatScale 하나여야 한다`);
  assert.match(b, /export function cmpFeatScale\(d\)/, 'cmpFeatScale 을 안 내보낸다');
  const o = stripComments(SRC.overlay);
  assert.equal(/parseFloat\([^)]*featScale/.test(o), false,
    'overlay-handles.js 가 featScale 을 직접 파싱한다 — cmpFeatScale 을 써라');
  assert.match(o, /window\.cmpFeatScale/, '드래그가 강조 배율을 한 자리에서 안 가져온다');
});

/* ── ㉢ 배선·히스토리·무회귀 ───────────────────────────────────────────── */
const DOWN = () => sliceBlock(SRC.overlay, 'function _onCmpRowMouseDown(e, block, ci, ri)');
const SHOW = () => sliceBlock(SRC.overlay, 'function showCmpGutters(block)');
const POS = () => sliceBlock(SRC.overlay, 'function _updateCmpGutterPositions()');

test('㉢1 ★이력은 «양쪽 끝» — mousedown 1회 + mouseup 1회(그리드 거터와 같은 규약)', () => {
  const fn = stripComments(DOWN());
  const pushes = [...fn.matchAll(/pushHistory\?\.\(/g)].length;
  assert.equal(pushes, 2,
    `행 경계 드래그의 pushHistory 가 ${pushes}회다 — 시작(mousedown)·끝(onUp) 둘이어야 한다 ` +
    '(하나면 ⌘Z 가 이웃 동작을 같이 먹거나 먹통이 된다 · js/CLAUDE.md 히스토리 규약).');
  assert.match(fn, /window\.scheduleAutoSave\?\.\(\)/, '드래그가 autoSave 를 안 건다 — 다시 열면 사라진다');
});

test('㉢2 ★드래그 중 패널을 통째로 다시 그리지 않는다 — 그 칸만 되쓴다', () => {
  const fn = stripComments(DOWN());
  assert.equal(/showComparisonProperties/.test(fn), false,
    '드래그가 패널을 재렌더한다 — 거터가 지워졌다 다시 생겨 첫 픽셀에서 끊긴다(그리드가 실측한 병)');
  assert.match(fn, /\.cmp-row-h\[data-idx="\$\{ri\}"\]/, '패널 숫자칸을 안 되쓴다 — 패널과 캔버스가 갈려 보인다');
});

test('㉢3 ★모델 커밋 문(updateComparisonBlock)을 안 부른다 — 래퍼가 move 마다 이력을 쌓는다', () => {
  const fn = stripComments(DOWN());
  assert.equal(/updateComparisonBlock/.test(fn), false,
    'mousemove 가 updateComparisonBlock 을 부른다 — model-update-history.js 가 감싸 호출마다 이력 한 칸이 쌓인다');
});

test('㉢4 ★[옛 저장본 무회귀] 거터를 «띄우는» 길은 블럭에 아무것도 쓰지 않는다', () => {
  /* 높이 키가 없던 저장본을 열어 비교 블럭을 고르면 이 두 함수가 돈다. 여기서 dataset 을
     건드리면 `data-row-heights` 가 생겨 ★저장 바이트가 바뀐다(= 옛 저장본 회귀). */
  for (const [name, src] of [['showCmpGutters', SHOW()], ['_updateCmpGutterPositions', POS()]]) {
    const code = stripComments(src);
    assert.equal(/block\.dataset\.\w+\s*=[^=]/.test(code), false,
      `${name} 이 블럭 dataset 에 쓴다 — 고르기만 해도 저장본이 바뀐다`);
    assert.equal(/renderComparison/.test(code), false,
      `${name} 이 재렌더를 부른다 — 고르기만 해도 캔버스가 다시 그려진다(무접촉이 아니다)`);
  }
});

test('㉢5 ★거터는 고정층(#ss-handles-overlay)에 산다 — 저장본·export 로 안 샌다', () => {
  const code = stripComments(SHOW());
  assert.match(code, /_getOverlay\(\)/, '거터를 고정층에서 안 받는다');
  assert.match(code, /overlay\.appendChild\(g\)/, '거터를 고정층에 안 붙인다 — 블럭 «안»에 넣으면 저장본에 샌다');
  assert.equal(/block\.appendChild/.test(code), false, '거터를 블럭 안에 붙인다 — 저장본·export 로 샌다');
});

test('㉢6 ★rAF 취소는 «거터 제거»와 한 몸 — 따로면 「거터는 있는데 루프는 죽음」이 된다', () => {
  const code = stripComments(SRC.overlay);
  const cancels = [...code.matchAll(/cancelAnimationFrame\(_cmpGutterRafId\)/g)].length;
  assert.equal(cancels, 1, `_cmpGutterRafId 취소가 ${cancels}군데다 — 한 곳(hideCmpGutters)이어야 한다`);
  const hide = stripComments(sliceBlock(SRC.overlay, 'function hideCmpGutters()'));
  assert.match(hide, /cancelAnimationFrame\(_cmpGutterRafId\)/, '취소가 hideCmpGutters 밖에 있다');
  assert.match(hide, /\.cmp-gutter'\)\.forEach\(g => g\.remove\(\)\)/, 'hideCmpGutters 가 거터를 안 지운다');
});

test('㉢7 ★뜨는 자리·해제하는 자리가 둘 다 있다(패널 꼬리 · deselectAll)', () => {
  assert.match(stripComments(SRC.cmpPanel), /window\.showCmpGutters\?\.\(block\)/,
    'showComparisonProperties 가 거터를 안 띄운다 — 캔버스에 손잡이가 안 생긴다');
  const fn = stripComments(sliceBlock(SRC.editor, 'function deselectAll('));
  assert.match(fn, /window\.hideCmpGutters\?\.\(\)/,
    'deselectAll 이 비교 거터를 안 지운다 — 모듈 변수가 «해제된 블럭»을 계속 가리켜 재클릭이 no-op 이 된다');
});

test('㉢8 ★칼럼마다 거터 — 비교는 칼럼별로 행 y 가 다르다(전폭 띠 하나로 두면 어긋난다)', () => {
  const code = stripComments(POS());
  assert.match(code, /cr\.left/, '거터 x 가 그 «칼럼» rect 에서 안 온다');
  assert.match(code, /g\.style\.width = cr\.width/, '거터 폭이 칼럼 폭이 아니다 — 전폭 띠는 강조 칼럼에서 경계를 벗어난다');
  assert.equal(/blockRect/.test(code), false, '블럭 전폭을 쓴다 — 그리드(grid-template-rows)와 달리 비교는 칼럼마다 y 가 다르다');
  // 띠 계산은 공용 부품 하나로(사본 금지)
  assert.match(code, /_rowGutterBand\(/, '띠 계산을 공용 부품(_rowGutterBand)으로 안 한다 — 사본이 생겼다');
});

test('㉢9 ★거터를 «빼는» 자리가 «세는» 자리보다 ★앞이다(조기 return 가드의 전제)', () => {
  /* 강조 배율을 못 구하는 칼럼은 거터를 안 세운다. 그 «빼기»를 세기 «뒤»로 옮기면
     「세운 수(have)」와 「세울 수(need)」가 영영 안 맞아 showCmpGutters 가 매 호출마다
     거터를 지웠다 다시 세운다 ⇒ 패널이 다시 그려지는 모든 조작에서 드래그가 끊긴다.
     ★이 검사는 내가 그 결함을 실제로 한 번 넣었다가(M17 변이가 ★안 잡혔다) 세운 자다. */
  const fn = stripComments(SHOW());
  const iFilter = fn.search(/_cmpRowBoundaries\(block\)\.filter\(/);
  const iCount = fn.search(/have === need\.length/);
  assert.notEqual(iFilter, -1, '강조 칼럼을 빼는 filter 가 없다 — 배율을 못 구하는 칼럼에도 거터가 선다');
  assert.notEqual(iCount, -1, '조기 return 의 수 비교를 못 찾았다 — 패턴을 갱신하라');
  assert.ok(iFilter < iCount, '빼기가 «세기» 뒤에 있다 — have 와 need 가 영영 안 맞는다');
  assert.equal(/\bcontinue;/.test(fn), false,
    '거터 생성 루프 안에서 건너뛴다 — 그러면 세운 수가 need 보다 적어 위 가드가 깨진다');
});
