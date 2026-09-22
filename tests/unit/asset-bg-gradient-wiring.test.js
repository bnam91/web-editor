/* T-011 ★이미지 에셋(placeholder, 이미지 미업로드 상태) «배경색» 피커의 그라데이션 탭 무동작 버그.
   실측(2026-09-16): prop-frame.js(ss-bg)·prop-banner02.js(bn2-bg)·prop-comparison.js(cmp-cXBg)는
   전부 wireColorField(...)에 onGradient 콜백을 넘기는데, prop-asset.js의 asset-bg만 그게 없었다.
   color-picker.js의 wireColorField는 onGradient가 없으면 goya-cp:gradient(-commit) 리스너를
   «아예 안 붙인다»(color-picker.js:918 `if (onGradient) { ... }`) — 즉 그라데이션 탭에서 스톱을
   움직여도 swatch도 안 바뀌고 대상 블록에도 아무 것도 전달되지 않는다. 현빈이 "그라데이션으로
   배경색이 바뀌지 않는다"고 신고한 바로 그 경로.
   ⛔이미지가 «이미 있는» 상태(hasImage=true)에는 배경색 컨트롤 자체가 없다(순수 Fit/교체/제거만) —
     즉 재현 경로는 이미지 미업로드 placeholder 상태의 배경색 필드다. */
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');
const { sliceCall } = require('./_slice-block.js');

const ROOT = path.join(__dirname, '..', '..');
const SRC = readSrc(ROOT, 'js', 'props', 'prop-asset.js');

function bgCall(src) {
  return sliceCall(src, "wireColorField('asset-bg'", 'asset 배경색 피커 배선');
}

test('A0 ★양성대조 — asset-bg 필드 자체가 렌더되고 있나(전제부터)', () => {
  assert.match(SRC, /idPrefix:\s*'asset-bg'/, 'colorFieldHTML에 asset-bg가 없으면 이 필드 자체가 없는 것 — 판정 무효');
});

test('A1 asset-bg wireColorField에 onGradient 콜백이 배선돼 있다', () => {
  const call = bgCall(SRC);
  assert.match(call, /onGradient\s*:/, 'onGradient가 없으면 color-picker.js가 goya-cp:gradient 리스너를 아예 안 붙인다(무동작 재현)');
});

test('A2 onGradient가 그라데이션 CSS를 실제 배경에 반영한다(solid backgroundColor는 비운다)', () => {
  const call = bgCall(SRC);
  const onGradBody = sliceCall(call, 'onGradient: (css, commit) =>', 'onGradient 핸들러 본문');
  assert.match(onGradBody, /ab\.style\.background\s*=\s*css/, '그라데이션 CSS를 style.background에 실어야 화면에 그려진다');
  assert.match(onGradBody, /ab\.style\.backgroundColor\s*=\s*''/, '이전 solid backgroundColor를 안 비우면 그라데이션 위에 겹쳐 보일 수 있다');
  assert.match(onGradBody, /window\.pushHistory/, '커밋 시 undo 히스토리에 안 남으면 그라데이션 적용이 되돌리기에서 사라진다');
});

test('A3 solid onApply가 이전 그라데이션(style.background)을 지운다(그라데이션→solid 전환 시 잔존 방지)', () => {
  const call = bgCall(SRC);
  const onApplyBody = sliceCall(call, 'onApply: (c) =>', 'onApply(solid) 핸들러 본문');
  assert.match(onApplyBody, /ab\.style\.background\s*=\s*''/, 'solid 적용 시 style.background(그라데이션)를 안 지우면 backgroundColor 위에 그라데이션이 계속 덮여 보인다');
});

test('A4 배경색 초기화(clear) 버튼도 style.background를 지운다', () => {
  const clearBody = sliceCall(SRC, "document.getElementById('asset-bg-clear').addEventListener('click', () =>", '배경색 초기화 버튼 핸들러');
  assert.match(clearBody, /ab\.style\.background\s*=\s*''/, '초기화가 backgroundColor만 지우면 그라데이션이 남아있는 채로 "초기화됨"으로 보인다');
});

test('A5 ★변이대조 — onGradient를 빼면 A1이 빨개져야 한다(이 검사가 실제로 그 배선을 본다는 증거)', () => {
  const call = bgCall(SRC);
  /* ★2026-09-22(T-011 2라운드) 끝 앵커에서 «들여쓰기 6칸»을 뺐다.
     옛 정규식은 `\n\s{6}\},\n` 이었다 — 배선이 else 안(콜백 닫는 줄 6칸)에 있다는 «모양 가정»이다.
     배경색을 hasImage 분기 밖으로 꺼내자 그 줄이 4칸이 되어, 구현이 옳은데도 A5가
     「변이가 안 먹었다」로 빨개졌다. 들여쓰기는 이 검사가 지키려는 사실이 아니다.
     ⇒ `\s*` 로 바꿔 콜백의 «자기 닫는 줄»에서 멈추게 한다(본문에 `},` 로 끝나는 줄이 없다).
     ⛔약해지지 않는다 — 아래 notStrictEqual 이 「변이가 실제로 무언가를 잘라냈다」를 못박는다.
       옛 A5 는 onGradient 가 «통째로 사라진» 소스에서도 조용히 초록이었다(자를 게 없어도 통과). */
  const mutated = call.replace(/onGradient\s*:\s*\(css, commit\)\s*=>\s*\{[\s\S]*?\n\s*\},\n/, '');
  assert.notStrictEqual(mutated, call, '변이가 한 글자도 안 잘랐다 = 이 대조는 아무것도 증명하지 않는다');
  assert.doesNotMatch(mutated, /onGradient\s*:/, '변이가 안 먹었다 = A1은 이 배선을 안 본다(거짓양성 위험)');
});

test('A6 참고: 다른 배경 피커들(frame/banner02/comparison)도 전부 onGradient를 쓴다 — asset만 예외였다', () => {
  const FRAME = readSrc(ROOT, 'js', 'props', 'prop-frame.js');
  const BANNER02 = readSrc(ROOT, 'js', 'props', 'prop-banner02.js');
  const COMPARISON = readSrc(ROOT, 'js', 'props', 'prop-comparison.js');
  assert.match(sliceCall(FRAME, "wireColorField('ss-bg'"), /onGradient\s*:/);
  assert.match(sliceCall(BANNER02, "wireColorField('bn2-bg'"), /onGradient\s*:/);
  assert.match(sliceCall(COMPARISON, "wireColorField('cmp-c' + idx + 'Bg'"), /onGradient\s*:/);
});
