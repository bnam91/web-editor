/* 0920b «textgrad-bar» — 글자 그라데이션에 «캔버스 그라데이션 바»가 안 뜨는 문제의 배선 감시.
 *
 * 증상(현빈 0920 원문 8번): 텍스트에 그라데이션을 넣으면 캔버스 위 그라데이션 바가 «안 보인다».
 *   도형·배너·비교표엔 보인다.
 *
 * 근본원인(dev @20e50e3 실독) — 렌더 버그가 아니라 «기능 미배선 두 지점»이다:
 *   ① gradient-model.js 의 어댑터 레지스트리에 text-block 이 «없다» → getGradientTarget(tb) === null
 *      → gradient-line-overlay.js showGradientLine 의 `if (!t) return;` 에서 조용히 끝난다(오버레이 DOM 자체가 안 생김).
 *   ② 텍스트 패널(prop-text.js → prop-text-wireup-text-edit.js)이 showGradientLine 을 «한 번도 안 부른다»
 *      (전수: prop-banner02 / prop-comparison / prop-shape 세 파일뿐).
 *   ⇒ 둘 중 하나만 고치면 여전히 안 뜬다. 그래서 둘 다 감시한다.
 *
 * ⛔음성대조: dev 현행에서 A1~A5 가 전부 빨강이어야 한다(고치기 «전»에 확인하고 기록했다).
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';
import { sliceCall, sliceBlock } from './_slice-block.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const MODEL = readSrc(ROOT, 'js', 'props', 'gradient-model.js');
const PROP_TEXT = readSrc(ROOT, 'js', 'props', 'prop-text.js');
const WIREUP = readSrc(ROOT, 'js', 'props', 'prop-text-wireup-text-edit.js');
const TBCOLOR = readSrc(ROOT, 'js', 'props', 'text-block-color.js');

// text-block 어댑터 등록 호출 한 덩이만 떠낸다(다른 어댑터의 코드를 삼키지 않게 — _slice-block 규율).
function textAdapterCall() {
  return sliceCall(MODEL, "registerGradientTarget({\n  match: (el) => el.classList.contains('text-block')", 'text-block 그라데이션 어댑터');
}

test('A0 ★양성대조 — 어댑터 레지스트리 자체가 살아 있고 등록이 3건 이상이다(검출기 자기시험)', () => {
  const n = (MODEL.match(/registerGradientTarget\(\{/g) || []).length;
  assert.ok(n >= 3, `registerGradientTarget 등록이 ${n}건 — 레지스트리 구조가 바뀐 것이다. 아래 A1 판정은 무효`);
  assert.match(MODEL, /function getGradientTarget\(blockEl\)/, 'getGradientTarget 이 없으면 이 파일의 전제가 무너진 것');
});

test('A1 gradient-model.js 에 text-block 어댑터가 등록돼 있다 (없으면 getGradientTarget=null → 바가 애초에 안 만들어진다)', () => {
  assert.match(MODEL, /match:\s*\(el\)\s*=>\s*el\.classList\.contains\('text-block'\)/,
    'text-block match 어댑터가 없으면 showGradientLine 첫 세 줄에서 조용히 리턴한다(현 증상)');
});

test('A2 text-block 어댑터는 space:\'css\' + contentEl rect + 그라데이션일 때만 get() (게이트 유지)', () => {
  const call = textAdapterCall();
  assert.match(call, /space:\s*'css'/, "저장 문자열이 linear-gradient(Ndeg,…) CSS 다 — 'bbox'(도형 전용)면 선 각도·길이가 틀린다");
  assert.match(call, /getTextGradient/, 'get() 이 그라데이션 여부를 안 가리면 단색 텍스트에도 바가 뜬다');
  assert.match(call, /resolveTextContentEl|_resolveContentEl/, 'rect/get/set 이 블럭이 아니라 contentEl 을 봐야 한다(그라데이션은 contentEl 배경에 칠해진다)');
  assert.match(call, /textGradientAllowed/, '패널과 같은 게이트를 안 쓰면 라벨·말풍선에 «끌 수는 있는데 글자는 안 바뀌는» 거짓 컨트롤이 뜬다');
});

test('A3 text-block 어댑터 set() 은 팝업과 «같은» 쓰기 경로(applyTextGradient)를 탄다', () => {
  const call = textAdapterCall();
  assert.match(call, /set:\s*\(css,\s*commit\)/, '어댑터 계약 set(css, commit) 시그니처');
  assert.match(call, /applyTextGradient/,
    '쓰기 경로를 새로 만들면 span 색 해제·형광펜 해제·caret-color·그림자 동기가 캔버스 드래그에서만 빠진다(이원화 금지)');
});

test('A4 prop-text.js 가 wireTextEditSection 에 tb 를 넘기고, wireup 이 캔버스 바를 켠다', () => {
  assert.match(PROP_TEXT, /wireTextEditSection\(\{\s*tb\s*,/, 'tb 가 없으면 wireup 이 showGradientLine 에 넘길 블럭이 없다');
  assert.match(WIREUP, /export function wireTextEditSection\(\{\s*tb\s*,/, 'wireup 시그니처가 tb 를 받아야 한다');
  // ⚠️머리를 '…({' 로 끊으면 _slice-block 이 «구조분해 객체»를 본문으로 읽어 파라미터만 떠낸다(거짓 빨강).
  const body = sliceBlock(WIREUP, 'export function wireTextEditSection({ tb, ctx, currentColorAlpha })', 'wireTextEditSection 본문');
  assert.match(body, /window\.showGradientLine\?\.\(/, '선택 시 바를 안 켜면 그라데이션 글자를 골라도 바가 없다');
  assert.match(body, /window\.bindGradientLinePicker\?\.\(/, '패널↔캔버스 양방향 배선(재오픈 시드·선택 스탑 동기)이 빠진다');
});

test('A5 clearTextGradient 가 해제될 때 바를 숨긴다 (단색 복귀·타입 전환·스포이드 세 경로 공용)', () => {
  const body = sliceBlock(TBCOLOR, 'export function clearTextGradient(contentEl)', 'clearTextGradient 본문');
  assert.match(body, /hideGradientLine/,
    '안 넣으면 «단색으로 바꿨는데 바가 남아 있다»는 새 버그가 난다(prop-shape.js:326,448 이 같은 이유로 hideGradientLine 을 부른다)');
});

test('A6 ★변이대조 — 어댑터의 applyTextGradient 를 지우면 A3 가 빨개져야 한다(검사가 그 줄을 실제로 본다는 증거)', () => {
  const call = textAdapterCall();
  const mutated = call.replace(/applyTextGradient/g, '__noop__');
  assert.doesNotMatch(mutated, /applyTextGradient/, '변이가 안 먹었다 = A3 는 이 배선을 안 본다(거짓양성 위험)');
});
