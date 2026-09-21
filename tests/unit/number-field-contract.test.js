/* number-field-contract.test.js — 숫자칸 규약이 «한 자리»에 있는지 소스로 못 박는다 [0920b-numfield]
 *
 * 배경(2026-09-20 «사용자 관점 훑기» → 0921 numfield 라운드):
 *   숫자칸 규약이 40개 패널 파일 수십 곳에 손으로 적혀 있었다. 그래서
 *     ① 클램프는 하는데 칸에 안 되써서 「9999 인데 실제는 1000」
 *     ② 빈 칸을 0/min 으로 커밋해서 값이 조용히 죽고(sticker 는 dataset 에 "NaN" 저장)
 *     ③ 회원 판정이 «손으로 적은 클래스 목록»이라 19칸이 밖에 남았다
 *   ⇒ 규약을 커밋 깔때기(js/props/prop-number-commit-guard.js) 한 자리로 올리고,
 *      값의 SSOT 를 «칸의 min/max 속성»으로 정했다.
 *
 * 이 파일이 재는 것 = «그 한 자리가 그대로 있나» + «알려진 함정을 다시 밟지 않나».
 * 실제 거동(모델·칸 표시·pushHistory)은 tests/dom/number-field-contract.dom.spec.js 가
 * 진짜 키보드로 5개 패널 × C1~C7 로 잰다.
 *
 * ⛔주석 거르기는 tests/unit/_strip-comments.js 의 makeStripper «만» 쓴다.
 * ⛔구간 떼기는 tests/unit/_slice-block.js 의 sliceBlock/sliceCall «만» 쓴다
 *   (직접 중괄호를 세거나 꼬리 문자열로 끝을 찾으면 SB-16 이 빨개진다 — 그게 옳다).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { makeStripper } = require('./_strip-comments');
const { sliceBlock, sliceCall } = require('./_slice-block');

const ROOT = path.join(__dirname, '..', '..');
const GUARD_REL = path.join('js', 'props', 'prop-number-commit-guard.js');
const readSrc = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const codeOnly = (src) => { const strip = makeStripper(); return src.split('\n').map(strip).join('\n'); };

const GUARD_SRC  = readSrc(GUARD_REL);
const GUARD_CODE = codeOnly(GUARD_SRC);
const NORMALIZE_BODY = codeOnly(sliceBlock(GUARD_SRC, 'function normalizeBeforeCommit('));
const COMMIT_BODY    = codeOnly(sliceBlock(GUARD_SRC, 'function commitTyping('));
const RESTORE_BODY   = codeOnly(sliceBlock(GUARD_SRC, 'function restorePrev('));
/** change 캡처 리스너 «통째» — 여는 `{` 가 괄호 안이라 sliceCall 이다(꼬리 모양을 안 센다). */
const CHANGE_BODY = codeOnly(sliceCall(GUARD_SRC, "document.addEventListener('change'",
  'change 캡처 핸들러 — 커밋 수렴 지점'));
/** Enter 분기 — 커밋을 일으키는 자리(blur)와 포커스 되돌리기가 여기 있다. */
const ENTER_BODY = codeOnly(sliceBlock(GUARD_SRC, "if (e.key === 'Enter')",
  'Enter 커밋 분기'));

test('N0 [양성대조] 뗀 몸통들이 비어 있지 않다 (아래 초록이 빈 함수의 초록이 아니다)', () => {
  for (const [name, body] of Object.entries({
    normalizeBeforeCommit: NORMALIZE_BODY, commitTyping: COMMIT_BODY,
    restorePrev: RESTORE_BODY, 'change 캡처': CHANGE_BODY, 'Enter 분기': ENTER_BODY,
  })) {
    assert.ok(body.length > 80, `${name} 몸통이 너무 짧다(${body.length}자) — 추출이 깨졌다`);
  }
});

test('N1 회원 판정이 «타입»을 본다 — 손으로 적은 목록으로 세지 않는다', () => {
  const m = /const isPn\s*=\s*\(el\)\s*=>([\s\S]*?);\n/.exec(GUARD_CODE);
  assert.ok(m, 'isPn(회원 판정)을 못 찾았다');
  assert.match(m[1], /el\.type\s*===\s*'number'/,
    '★목록으로 되돌아갔다 — 새 패널이 목록을 안 고치면 그 칸은 또 조용히 샌다(0921 실측 19칸)');
  assert.match(m[1], /HTMLInputElement/,
    '<select class="prop-number"> 2곳(editor.js·prop-iconify.js)을 거르던 가드가 사라졌다');
  // 예외 목록은 «작게» 남는다 — 커지면 타입 주도가 다시 목록 주도로 퇴행한 것이다
  const t = /const PN_TEXT_SEL\s*=\s*'([^']+)'/.exec(GUARD_CODE);
  assert.ok(t, 'type=number 예외 목록(PN_TEXT_SEL)을 못 찾았다');
  const exceptions = t[1].split(',').map(s => s.trim()).filter(Boolean);
  assert.ok(exceptions.length <= 3,
    `예외 목록이 ${exceptions.length}개로 불었다 — 새 칸은 목록에 넣지 말고 type="number" 로 만들어라`);
});

test('N2 ★Number(el.min) 함정을 피한다 — 속성이 없으면 0 이 되어 좌표칸이 «음수 금지»가 된다', () => {
  assert.match(NORMALIZE_BODY, /parseFloat\(el\.min\)/,
    'min 을 parseFloat 로 안 읽는다 — Number("") 는 0 이라 min 없는 칸에 0 하한이 생긴다');
  assert.match(NORMALIZE_BODY, /parseFloat\(el\.max\)/, 'max 도 같은 길이다');
  assert.ok(!/Number\(\s*el\.(min|max)\s*\)/.test(NORMALIZE_BODY),
    '★Number(el.min/max) 가 남아 있다 — 속성 없는 칸(img-x/y, ss-pos-x/y, txt-x/y …)의 음수가 죽는다');
  assert.match(NORMALIZE_BODY, /Number\.isFinite\(\s*lo\s*\)/, '속성이 «있을 때만» 하한을 걸어야 한다');
  assert.match(NORMALIZE_BODY, /Number\.isFinite\(\s*hi\s*\)/, '속성이 «있을 때만» 상한을 걸어야 한다');
});

test('N3 규약 셋이 정규화 한 자리에 있다 — 빈값·클램프 되쓰기·0 구분', () => {
  assert.match(NORMALIZE_BODY, /return\s+'empty'/, '⑴ 빈 값을 «값 없음»으로 알리는 갈래가 없다');
  assert.match(NORMALIZE_BODY, /el\.value\s*=\s*String\(c\)/,
    "⑵ 클램프한 값을 «칸에 되쓰기»가 없다 — 「9999 인데 실제는 1000」이 그대로 남는다");
  // ⑶ 0 과 빈 칸의 갈림은 «유한수 판정»으로 난다: '' → empty, '0' → Number 0 은 유한
  assert.match(NORMALIZE_BODY, /Number\.isFinite\(n\)/, '⑶ 0 과 빈 칸을 가르는 유한수 판정이 없다');
  assert.ok(!/\|\|\s*0\b/.test(NORMALIZE_BODY),
    "★`|| 0` 폴백이 들어왔다 — 그 한 글자가 빈 칸을 0 으로 «커밋»시킨다(원래 버그 그 자체)");
});

test('N4 빈 값 갈래가 커밋을 «통째로» 없앤다 (apply·pushHistory·autosave 전부)', () => {
  assert.match(CHANGE_BODY, /normalizeBeforeCommit\(el\)\s*===\s*'empty'/,
    'change 수렴 지점에서 빈 값을 안 가른다');
  assert.match(CHANGE_BODY, /stopImmediatePropagation\(\)/,
    '빈 값인데 change 가 그대로 퍼진다 — 패널의 change 핸들러가 pushHistory 를 쌓는다');
  assert.match(CHANGE_BODY, /restorePrev\(el\)/, '이전 표시값 복원이 없다 — 칸이 빈 채 남는다');
  /* ⚠️stopImmediatePropagation 은 «빈 값 갈래에서만» 불러야 한다. 정상 입력에까지 걸면
     pushHistory/scheduleAutoSave 없이 값이 사라지는 «조용한 소실»(T-079)이 새로 난다. */
  const stops = (CHANGE_BODY.match(/stopImmediatePropagation\(\)/g) || []).length;
  assert.equal(stops, 1, `★change 캡처에 stopImmediatePropagation 이 ${stops}번 있다 — 빈 값 갈래 하나여야 한다`);
  // 스피너·휠 선커밋 경로도 같은 규약을 탄다(그쪽은 change 가 안 온다)
  assert.match(COMMIT_BODY, /normalizeBeforeCommit\(el\)\s*===\s*'empty'/,
    '선커밋(스피너·휠) 경로가 규약을 안 탄다 — 빈 칸에서 스텝하면 옛 버그가 그 길로 돌아온다');
  assert.match(RESTORE_BODY, /el\._pnPrev/, '복원이 타이핑 시작값(_pnPrev)을 안 쓴다');
});

test('N5 ★센서스 — js/ 의 «모든» input[type=number] 가 타입 주도 판정에 걸린다', () => {
  /* 이 검사의 뜻: «새 패널이 목록을 안 고쳐도 규약이 따라온다»를 기계가 지킨다.
     ⛔실패하면 목록에 줄을 더하지 마라 — 그 칸을 type="number" 로 만들거나,
       진짜 예외면 PN_TEXT_SEL 에 «사유와 함께» 넣어라(N1 이 크기를 막는다). */
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.js')) files.push(p);
    }
  })(path.join(ROOT, 'js'));

  let numberInputs = 0, withPropNumber = 0;
  const outsideList = [];          // type=number 인데 .prop-number 가 «없는» 칸 = 옛 목록의 구멍
  const propNumberNotNumber = [];  // .prop-number 인데 input[type=number] 가 «아닌» 것
  for (const f of files) {
    if (f.endsWith('prop-number-commit-guard.js')) continue;   // 이 파일의 주석엔 예시 마크업이 있다
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(ROOT, f);
    for (const m of src.matchAll(/<(input|select|textarea)\b[\s\S]*?>/g)) {
      const tag = m[0];
      const isNum = m[1] === 'input' && /type\s*=\s*["']number["']/.test(tag);
      const hasCls = /\bprop-number\b/.test(tag);
      const line = src.slice(0, m.index).split('\n').length;
      if (isNum) { numberInputs++; if (hasCls) withPropNumber++; else outsideList.push(`${rel}:${line}`); }
      else if (hasCls) propNumberNotNumber.push(`${rel}:${line} <${m[1]}>`);
    }
  }

  // ⒜ 양성대조 — 센서스가 실제로 세고 있다(정규식이 0건을 세고 초록나는 것 방지)
  assert.ok(numberInputs > 150, `센서스가 깨졌다: input[type=number] 를 ${numberInputs}개밖에 못 셌다`);

  // ⒝ ★핵심 — 옛 «목록»(.prop-number)은 이 중 일부만 덮었다. 타입 주도는 전부 덮는다.
  assert.ok(outsideList.length > 0,
    '목록 밖 칸이 0개다 — 전제가 바뀌었으면 이 검사의 뜻(목록은 못 따라온다)부터 다시 써라');
  assert.ok(numberInputs > withPropNumber,
    `목록이 전부를 덮는다고 나왔다(${withPropNumber}/${numberInputs}) — 센서스를 의심하라`);

  // ⒞ .prop-number 를 단 것 중 input[type=number] 가 아닌 건 <select> 뿐이어야 한다
  //    (HTMLInputElement 가드가 그것들을 이미 뺀다. <input type=text class=prop-number> 가
  //     생기면 타입 주도 판정이 그 칸을 «잃는다» — 그때 여기가 빨개져야 한다.)
  const lostInputs = propNumberNotNumber.filter(x => !x.includes('<select>'));
  assert.deepEqual(lostInputs, [],
    '★.prop-number 인데 type="number" 가 아닌 <input> 이 생겼다 — 타입 주도 판정이 이 칸을 놓친다');

  // ⒟ 규약의 재료(min/max)가 실제로 칸에 붙어 있다 — 「속성이 SSOT」라는 전제의 실측
  assert.ok(withPropNumber > 150,
    `.prop-number 표준 칸이 ${withPropNumber}개로 줄었다 — 표준을 안 쓰는 칸이 늘었다면 그쪽부터 보라`);
});

test('N7 ★Enter 가 뺏은 포커스를 «되돌린다» — BODY 면 다음 Backspace 가 블럭을 지운다', () => {
  /* 가드는 커밋을 일으키려고 el.blur() 한다. 그 부작용으로 activeElement 가 BODY 가 되면,
     블럭이 .selected 인 채라 Backspace 가 캔버스 삭제로 샌다(0920b grad-alpha 라운드가 stop
     두 칸에서 실제로 겪고 제 파일에서 고쳤다). 0921 numfield 는 회원을 19칸 늘리므로 그 길로
     «오늘 없던» 칸들이 새로 들어온다 ⇒ 한 자리에서 닫는다. 거동은 DOM 스펙 C8 이 잰다. */
  const body = ENTER_BODY;
  assert.match(body, /el\.blur\(\)/, 'Enter 커밋의 수단(blur)이 사라졌다');
  assert.match(body, /document\.activeElement\s*===\s*document\.body/,
    '★«아무도 안 가져갔을 때만» 이라는 조건이 없다 — 커밋이 옮긴 포커스를 도로 뺏는다');
  assert.match(body, /el\.isConnected/,
    '★재생성으로 칸이 DOM 에서 떨어진 경우를 안 가린다 — 그 경우는 제 패널 복원 핸들러 몫이다');
  assert.match(body, /el\.focus\(\)/, '되돌려주는 호출이 없다');
  // setSelectionRange 는 type=number 에서 throw 한다 — 따로 감싸지 않으면 포커스까지 같이 날아간다
  const si = body.indexOf('setSelectionRange');
  assert.ok(si > 0, '캐럿을 끝으로 보내는 처리가 없다');
  assert.ok(/try\s*\{[^}]*setSelectionRange/.test(body.slice(Math.max(0, si - 80), si + 40)),
    '★setSelectionRange 를 제 try 로 안 감쌌다 — type=number 에서 InvalidStateError 가 나면 포커스 복원이 통째로 죽는다');
});

test('N6 규약을 «패널 파일에 다시 적지 마라»는 못이 가드 머리말에 박혀 있다', () => {
  // 안심 주는 문장보다 «경고 부재»가 나쁘다 — 다음 사람이 여기로 오게 하는 문장을 원문에 둔다.
  assert.match(GUARD_SRC, /min\/max/, '값의 SSOT 가 칸의 min\\/max 속성이라는 선언이 머리말에 없다');
  assert.match(GUARD_SRC, /⛔/, '「패널 파일에 규약을 다시 적지 마라」는 금지 표식이 없다');
});
