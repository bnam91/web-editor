/* U-ITBHANDLES — 「아이콘+텍스트 블럭의 오버레이 모서리 핸들」의 «변이 책임».
 *
 * 숫자(핸들 개수·글자 배율)는 tests/dom/overlay-icon-text-handles.dom.spec.js 가 실제로 잰다.
 * 그런데 tests/dom 은 `npm test` 스위트에 «안» 들어간다 ⇒ 되돌려도 조용히 지나간다.
 * 그래서 이 결함의 «문 셋»을 여기 박는다 — 하나만 닫으면 신고가 다른 문으로 그대로 산다.
 *   문① showHandlesFor 의 갈래       (레이어패널·히스토리 복원 경로의 입구)
 *   문② block-drag 의 isIconText 클릭 (사람이 실제로 밟는 입구)
 *   문③ 폰트 스냅샷의 그물           (핸들은 붙는데 글자만 안 커지는 반쪽)
 *   문⑤ 흐름으로 «돌아온 뒤»의 폭     (키운 인라인 폭이 제 행을 넘어 글자가 잘리던 자리)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/* ★주석 걷어내기는 «공용 부품» 하나만 쓴다 — tests/unit/_strip-comments.js.
   ⛔여기서 자기 stripComments 를 만들지 마라: 이 레포의 사본 11벌 중 9벌이
     `replace(/\/\*[\s\S]*?\*\//g,'')` 라 `accept="image/*"` 뒤를 통째로 삼켰고,
     검사는 「0건 = 통과」로 초록이 됐다(tests/unit/strip-comments-shared.test.js S-6 가 막는다). */
import { stripComments } from './_strip-comments.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const HANDLES = read('js', 'overlay-handles.js');
const DRAG    = read('js', 'block-drag.js');
const CSS_EXTRA = read('css', 'editor-extra.css');

/** 선언 몸통을 중괄호 짝으로 잘라 온다. */
function bodyOf(src, label) {
  const i = src.indexOf(label);
  assert.notStrictEqual(i, -1, `★"${label}" 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라`);
  const start = src.indexOf('{', i);
  let depth = 0;
  for (let k = start; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (depth === 0) return src.slice(start, k + 1); }
  }
  assert.fail(`★"${label}" 의 몸통 끝을 못 찾았다`);
}

test('문① showHandlesFor 가 .icon-text-block 을 «오버레이 텍스트»와 같은 갈래로 본다', () => {
  const body = stripComments(bodyOf(HANDLES, 'function showHandlesFor'));
  assert.match(body, /icon-text-block/,
    '★showHandlesFor 에 .icon-text-block 갈래가 없다 — 오버레이를 켜도 모서리 핸들이 0개다');
  /* 그 갈래가 «텍스트와 같은» 손잡이를 부르는지까지 본다 — 새 손잡이를 따로 만들면
     hideAssetResizeHandles 일괄 remove·커서 전수검사 같은 기존 규율에서 새어 나간다. */
  const branch = body.slice(body.indexOf('icon-text-block'));
  assert.match(branch, /showTextOverlayResizeHandles\s*\(/,
    '★아이콘텍스트가 «다른» 손잡이를 쓴다 — 오버레이 텍스트와 한 벌이어야 한다');
  assert.match(branch, /dataset\.overlayBlock\s*!?==?=\s*'true'/,
    '★오버레이 여부를 dataset.overlayBlock 으로 안 가른다(클래스로 가르면 흐름 블럭에도 붙는다)');
});

test('문② block-drag 의 isIconText 클릭 핸들러가 showHandlesFor 를 «부른다»', () => {
  const i = DRAG.indexOf("const isIconText = block.classList.contains('icon-text-block')");
  assert.notStrictEqual(i, -1, '★isIconText 판정을 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  /* 그 뒤 첫 dblclick 배선 전까지가 «클릭» 핸들러 구간이다. */
  const j = DRAG.indexOf("block.addEventListener('dblclick'", i);
  assert.ok(j > i, '★isIconText 뒤에 dblclick 배선이 없다 — 구간 판정이 낡았다');
  const clickBlock = stripComments(DRAG.slice(i, j));
  assert.match(clickBlock, /showTextProperties\s*\(/, '★전제가 바뀌었다 — 이 갈래가 텍스트 패널을 안 연다');
  assert.match(clickBlock, /showHandlesFor\s*\?\.\s*\(/,
    '★클릭 경로가 showHandlesFor 를 안 부른다 — 레이어패널로는 나오는데 «클릭하면» 안 나온다');
});

test('문③ 폰트 스냅샷이 .itb-text 를 «센다» (핸들만 붙고 글자는 안 커지는 반쪽 방지)', () => {
  const body = stripComments(bodyOf(HANDLES, 'function _tfoFontSnapshot'));
  assert.match(body, /\.itb-text/,
    '★폰트 스냅샷 그물에 .itb-text 가 없다 — `[class^="tb-"]` 는 «itb-» 를 안 잡는다');
  assert.match(body, /\[class\^="tb-"\]/, '★기존 텍스트 그물이 사라졌다 — 아이콘텍스트만 남으면 본문이 안 커진다');
});

test('문⑤ 아이콘 칸(.itb-icon)도 «같은 배율»로 커진다 (현빈 2026-09-21 결정)', () => {
  /* ★결정: 「아이콘+텍스트를 키우면 아이콘도 같이 커진다」(현빈 2026-09-21 「같이커져야지」).
     2026-09-20 까지 이 자리엔 «아직 손대지 않았다»는 가드가 있었다 — 결정이 나왔으므로
     그 가드를 «뒤집는다»(그때의 주석이 「결정이 나면 이 검사부터 뒤집어라」였다).
     ⚠️아이콘 칸은 font-size 가 아니라 width/height 라 폰트 스냅샷에 «섞지» 않는다 —
       별도 스냅샷(_tfoIconSnapshot)이 지고, 폰트 그물은 그대로 font-size 만 본다. */
  const snap = stripComments(bodyOf(HANDLES, 'function _tfoFontSnapshot'));
  assert.ok(!/itb-icon/.test(snap),
    '★아이콘 칸을 «폰트» 스냅샷에 넣었다 — 그건 font-size 가 아니라 width/height 다(별도 스냅샷으로)');

  const icon = stripComments(bodyOf(HANDLES, 'function _tfoIconSnapshot'));
  assert.match(icon, /\.itb-icon/, '★아이콘 스냅샷이 .itb-icon 을 안 잡는다');
  assert.match(icon, /offsetWidth|getBoundingClientRect/,
    '★아이콘 칸의 «시작 크기»를 안 잰다 — 매 프레임 누적 곱은 표류한다');

  const down = stripComments(bodyOf(HANDLES, 'function _onTextOverlayResizeMouseDown'));
  assert.match(down, /_tfoIconSnapshot\s*\(/,
    '★마우스다운이 아이콘 스냅샷을 안 뜬다 — 글자만 커지고 아이콘은 40×40 으로 남는다');
  const iMove = down.indexOf('function onMove(');
  assert.ok(iMove > 0, '★onMove 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  const move = down.slice(iMove);
  const iIcon = move.indexOf('iconSnap.forEach');
  assert.ok(iIcon > 0, '★onMove 가 아이콘 스냅샷을 안 돈다 — 글자만 커진다');
  const iconApply = move.slice(iIcon, iIcon + 400);
  assert.match(iconApply, /style\.width\s*=[^;]*\bk\b/,
    '★onMove 가 아이콘 칸 width 에 «글자와 같은 k» 를 안 곱한다');
  assert.match(iconApply, /style\.height\s*=[^;]*\bk\b/,
    '★onMove 가 아이콘 칸 height 에 «글자와 같은 k» 를 안 곱한다');
  /* 글자 적용보다 «뒤»에 와야 새 높이(newH) 실측이 아이콘 확대를 포함한다 — 앞에 두면
     맞은편 코너 고정이 한 프레임 어긋난다. */
  assert.ok(move.indexOf('fontSize') < iIcon,
    '★아이콘 적용이 글자보다 «앞»이다 — 높이 실측(newH)이 한 프레임 낡는다');
});

test('문④ 드래그가 끝나면 «패널»도 새 폭을 안다 — 조건이 `tb !== posEl` 이 아니다', () => {
  /* ★문 넷째 — 손잡이가 붙어도 여기가 막히면 「키웠는데 패널은 옛 값을 말하고, 슬라이더를
     한 칸 건드리면 그 옛 값이 적용돼 폭이 도로 줄어드는」 반쪽이 된다.
     실측(2026-09-20 통합 라운드, tests/dom/overlay-icon-text-panel-sync):
       아이콘+텍스트 733px / 패널 600 → 슬라이더 한 칸 → 601 로 되돌아감.
       래퍼(text-frame) 있는 텍스트는 733 / 733.
     기전: .icon-text-block 은 래퍼가 없어 posElOf() 가 블럭 자신을 준다 ⇒ tb === posEl 이라
           옛 조건이 통째로 걸렀다. ⇒ 조건은 «텍스트 패널을 쓰는 블럭인가»여야 한다. */
  const body = stripComments(bodyOf(HANDLES, 'function _onTextOverlayResizeMouseDown'));
  const iUp = body.indexOf('function onUp()');
  assert.ok(iUp > 0, '★onUp 을 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  const up = body.slice(iUp);
  assert.match(up, /showTextProperties\s*\?\.\s*\(/,
    '★드래그 끝에 패널을 안 새로 그린다 — 패널이 옛 폭을 계속 말한다');
  assert.doesNotMatch(up, /tb\s*!==\s*posEl/,
    '★조건이 `tb !== posEl` 이다 — 래퍼가 «없는» 타입(.icon-text-block)이 통째로 빠진다');
  assert.match(up, /icon-text-block/,
    '★아이콘+텍스트가 패널 새로고침 대상에 없다');
});

test('문⑤ 흐름으로 돌아온 .icon-text-block 은 «제 행»을 못 넘는다 (max-width:100%)', () => {
  /* ★2026-09-21 최종통합 QA medium — 오버레이 모서리 핸들이 박은 인라인 width(792px)가
     오버레이를 끈 뒤에도 남는데, 돌아가는 .row 는 716px 이다. 일반 텍스트는 래퍼
     `.frame-block{max-width:100%}` 가 깎아 주지만 아이콘+텍스트는 래퍼가 «없어» 행을 76px,
     섹션 본문을 4px 넘어 글자가 경계에서 잘렸다(실측 renderW 808 / row 716 / 넘침 92·20).
     ⇒ 같은 결로 .icon-text-block 에도 max-width:100% 를 준다. style.width 는 그대로 남으므로
       「사용자가 정한 폭은 남는다」(현빈 2026-09-20)는 안 깨진다 — «그리는 폭»만 행에 맞춘다.
     숫자는 tests/dom/overlay-icon-text-exit-width.dom.spec.js 가 잰다. */
  /* ⚠️주석을 «먼저» 걷고 규칙을 자른다 — 이 규칙의 주석 안에 `.frame-block{max-width:100%}`
     라는 예시가 들어 있어, 먼저 자르면 그 `}` 에서 끊겨 본문이 통째로 사라진다. */
  const css = stripComments(CSS_EXTRA);
  const i = css.indexOf('.icon-text-block {');
  assert.notStrictEqual(i, -1, '★.icon-text-block 규칙을 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  const rule = css.slice(i, css.indexOf('}', i));
  assert.match(rule, /max-width:\s*100%/,
    '★.icon-text-block 에 max-width:100% 가 없다 — 오버레이로 키운 폭이 흐름에서 행을 넘어 글자가 잘린다');

  /* ⛔오버레이 «중»에는 이 상한이 걸리면 안 된다 — 핸들이 인라인 maxWidth:'none' 으로 푼다
     (현빈 2026-09-20 결정: 크기조절도 섹션 폭 밖까지 나갈 수 있다). 그 자리가 사라지면
     「손잡이는 가는데 상자는 안 커진다」로 되돌아간다. */
  const down = stripComments(bodyOf(HANDLES, 'function _onTextOverlayResizeMouseDown'));
  assert.match(down, /style\.maxWidth\s*=\s*'none'/,
    '★리사이즈가 maxWidth 상한을 안 푼다 — 오버레이 중에도 섹션 폭에서 막힌다');
});

test('문⑥ bindBlock 의 «오버레이 이동 드래그» 배선이 타입(클래스)으로 갈리지 않는다', () => {
  /* ★2026-09-21 마지막 라운드 최종반영 QA medium — 「오버레이 아이콘+텍스트가 마우스로
     전혀 안 옮겨지고 끌면 선택이 풀린다」.
     실앱 실측(9515, 줌 40%)으로 가른 «진짜 조건»: 패널 토글로 방금 켠 직후엔 움직인다
     (enterFloat 이 자기 마지막 줄에서 직접 건다). 저장→다시 열면 _overlayMoveBound=false 라
     0px 도 안 움직이고 선택도 전부 풀린다(끈 뒤의 합성 click 을 삼키는 가드가 그 드래그의
     onUp 안에 살기 때문). ⇒ «로드 경로»의 유일한 배선자리인 bindBlock 이 문제였다.
     옛 판은 `if (isShape || isAsset)` 과 `if (isText)` 둘로 갈라 걸었고, .icon-text-block 은
     .text-block 이 아니고 text-frame 래퍼도 없어 어느 갈래에도 안 걸렸다.
     ⇒ 배선 판정은 같은 함수의 «일반 드래그 비켜가기» 가드와 «같은 술어»(posElOf)여야 한다 —
       비켜가기만 전 타입이고 받아줄 드래그가 세 타입이면 그 «사이»로 새는 타입이 또 생긴다.
     숫자는 tests/dom/overlay-load-path-move-drag.dom.spec.js 가 타입 전수로 잰다. */
  const body = stripComments(bodyOf(DRAG, 'function bindBlock'));
  const call = body.indexOf('_bindFloatMoveDrag(');
  assert.notStrictEqual(call, -1,
    '★bindBlock 이 오버레이 이동 드래그를 아예 안 건다 — 다시 연 프로젝트의 오버레이가 안 움직인다');
  assert.match(body.slice(Math.max(0, call - 200), call), /_floatPosElOf\(\s*block\s*\)/,
    '★자리를 posElOf 로 안 구한다 — 타입 해석이 두 벌이 된다(SSOT 는 js/overlay-float.js)');

  /* 그 호출을 감싼 «가장 가까운 블록»의 머리를 본다. 클래스 판정 if 가 머리에 있으면
     그 타입 목록에 없는 블럭이 조용히 새는 옛 꼴로 돌아간 것이다. */
  let depth = 0, open = -1;
  for (let k = call; k >= 0; k--) {
    if (body[k] === '}') depth++;
    else if (body[k] === '{') { if (depth === 0) { open = k; break; } depth--; }
  }
  assert.notStrictEqual(open, -1, '★호출을 감싼 블록의 여는 괄호를 못 찾았다 — 이 검사부터 고쳐라');
  const head = body.slice(Math.max(0, open - 120), open);
  assert.doesNotMatch(head, /\bif\s*\([^)]*\bis[A-Z]/,
    `★이동 드래그 배선이 «클래스 갈래» 안에 있다(머리: ${head.trim().slice(-80)}) — `
    + '.icon-text-block 처럼 그 목록에 없는 타입이 또 샌다');
});
