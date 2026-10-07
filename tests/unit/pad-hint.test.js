/* ★좌우 패딩 힌트 — 「만지는 «동안»만 뜨고, 문서에는 새지 않는가」 (2026-09-08 현빈 지시)
 *
 * 범위는 «섹션 패널의 좌우 패딩 슬라이더» 하나다. 페이지·아래·모달·row 패딩은 대상이 아니다.
 *
 * ⛔이 기능의 위험은 옆집 그리드 가이드와 «같다» — 기능이 안 되는 게 아니라
 *   저장·내보내기에 섞이는 것이다. 다만 이쪽은 «일부러» DOM(인라인 변수)을 건드리므로
 *   ⑴ 내보내기 가드와 ⑵ 400ms 뒤 변수 회수, 이 둘이 그물이다.
 *
 * ★T0 은 «본 단언 앞»에 둔다 — 훑는 덩이가 비면 아래 단언은 전부 공회전으로 초록이 된다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');            // ⛔CRLF — win-portability
/* ⛔주석 거르개는 «공용 부품»만 쓴다. 자기 벌을 만들면 strip-comments-shared 의 S-6 이 즉시 빨강. */
const { stripComments } = require('./_strip-comments.js');
const codeOnly = stripComments;

const ROOT = path.join(__dirname, '..', '..');
const CSS = readSrc(ROOT, 'css', 'editor-canvas.css');
const SEC = readSrc(ROOT, 'js', 'props', 'prop-section.js');
const EXP = readSrc(ROOT, 'js', 'io', 'export-image.js');
const PAGE = readSrc(ROOT, 'js', 'props', 'prop-page.js');
const SER  = readSrc(ROOT, 'js', 'io', 'section-serialize.js');

/* ★런타임 마커 판정을 «실제로 돌려» 본다 — 소스에 그 줄이 «있나»로 재던 자리다.
   ⛔「querySelectorAll('.selected') 가 보이나」는 «모양»을 재는 계약이라, 성질 기반
     sweep 으로 바꾸면 행동이 더 좋아졌는데도 빨강이 났다(2026-09-09 실측).
     ⇒ 이제 IIFE 를 가짜 window 에 실어 판정 함수를 «부른다». DOM 없이 돈다. */
function loadRuntimeMarkers(serSrc) {
  const win = {};
  new Function('window', serSrc)(win);
  return win.runtimeMarkers;
}


/* ═══ 자르개 ═══
   ⛔고정 창(slice(i, i+900)) 금지 — 위아래 코드가 조금만 자라도 «본 적 없는 곳»을 재게 된다.
   ⚠️함정: `function f(opts = {})` 의 «기본값 중괄호»를 몸통으로 오인한다.
     ⇒ 매개변수 괄호를 «먼저» 닫고, 그 뒤의 첫 { 부터 균형을 센다. */
function _balance(src, b, label) {
  let d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) return src.slice(b, j + 1); }
  }
  assert.fail(`${label}: 몸통 중괄호가 안 닫힌다`);
}

/** `function f(a, b) { … }` — 매개변수 괄호를 «먼저» 닫고 몸통을 뜬다. */
function bodyOf(src, needle, label) {
  const at = src.indexOf(needle);
  assert.ok(at >= 0, `${label}: 시작점 «${needle}» 을 못 찾았다 — 이름이 바뀌었나`);
  let i = src.indexOf('(', at);
  assert.ok(i > at, `${label}: 매개변수 괄호가 없다`);
  let d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  assert.strictEqual(d, 0, `${label}: 매개변수 괄호가 안 닫힌다`);
  const b = src.indexOf('{', i);
  assert.ok(b > 0, `${label}: 몸통 여는 중괄호가 없다`);
  return _balance(src, b, label);
}

/** `const f = v => { … }` — 화살표는 «괄호 없는» 매개변수가 있다.
 *  ⚠️괄호부터 찾으면 몸통 안의 `Math.min(` 을 매개변수로 오인해 엉뚱한 덩이를 뜬다
 *    (실제로 그렇게 한 번 헛짚었다). ⇒ `=>` 를 먼저 찾고, 그게 «서명 안»인지 거리로 확인한다. */
function arrowBodyOf(src, needle, label) {
  const at = src.indexOf(needle);
  assert.ok(at >= 0, `${label}: 시작점 «${needle}» 을 못 찾았다 — 이름이 바뀌었나`);
  const a = src.indexOf('=>', at);
  assert.ok(a > at && a - at < 80,
    `${label}: 화살표를 «서명 안»에서 못 찾았다(거리 ${a - at}) — 화살표 함수가 아닌가`);
  const b = src.indexOf('{', a);
  assert.ok(b > a && b - a < 8, `${label}: 화살표 «바로 뒤»에 몸통 중괄호가 없다`);
  return _balance(src, b, label);
}

/** CSS 규칙 하나를 «중괄호 균형»으로 뜬다(셀렉터 포함). */
function ruleOf(src, selector, label) {
  const at = src.indexOf(selector);
  assert.ok(at >= 0, `${label}: 셀렉터 «${selector}» 가 없다`);
  const b = src.indexOf('{', at);
  assert.ok(b > at, `${label}: 여는 중괄호가 없다`);
  let d = 0;
  for (let j = b; j < src.length; j++) {
    if (src[j] === '{') d++;
    else if (src[j] === '}') { d--; if (d === 0) return src.slice(at, j + 1); }
  }
  assert.fail(`${label}: 중괄호가 안 닫힌다`);
}

/* ─────────────────────────────────────────────────────────────
   T0 ★입력이 살아 있다 — 아래 T1~T4 가 «무언가를 실제로 보고 있나»
   ⇐ 되돌리면 빨강: 거르개가 소스를 통째로 먹거나(주석 처리 실수),
      파일 경로가 바뀌어 빈 문자열을 재게 되면 여기서 «먼저» 터진다.
   ───────────────────────────────────────────────────────────── */
test('T0 ★입력이 살아 있다 — 훑는 덩이 셋이 비어 있지 않다', () => {
  const css = codeOnly(CSS), sec = codeOnly(SEC), exp = codeOnly(EXP);

  assert.ok(css.trim().length > 500, `editor-canvas.css 가 주석을 턴 뒤 ${css.trim().length}자 — 거르개가 코드까지 먹었다`);
  assert.ok(sec.trim().length > 500, `prop-section.js 가 주석을 턴 뒤 ${sec.trim().length}자 — 거르개가 코드까지 먹었다`);
  assert.ok(exp.trim().length > 500, `export-image.js 가 주석을 턴 뒤 ${exp.trim().length}자 — 거르개가 코드까지 먹었다`);

  /* ★살아 있는 «형제» 토큰 — 그리드 가이드는 이 기능과 무관하게 존재한다.
     이게 안 잡히면 거르개가 진짜 코드를 삼킨 것이다(0건=통과 의 거짓 초록 방지). */
  const gridOn = (css.match(/gdt-grid-on/g) || []).length;
  assert.ok(gridOn >= 1, `주석을 턴 CSS 에서 형제 토큰 gdt-grid-on 이 ${gridOn}곳 — 거르개가 코드를 먹었다`);

  /* ★세는 단언의 «셀 대상이 있다» — 섹션 inner 를 겨눈 규칙이 CSS 에 실재하나. */
  const innerRules = (css.match(/\.section-inner/g) || []).length;
  assert.ok(innerRules >= 2 && innerRules < 500,
    `.section-inner 를 겨눈 자리가 ${innerRules}곳 — 0 이면 셀 대상이 없고, 비정상적으로 많으면 잘못된 파일이다`);

  /* ★뜯어낼 덩이가 «실제로» 뜯긴다 — 아래 검사들이 쓰는 자르개의 전제. */
  assert.ok(bodyOf(sec, 'function _showPadXHint', 'T0').length > 50, '_showPadXHint 몸통이 비었다');
  assert.ok(arrowBodyOf(sec, 'const applyPadX =', 'T0').length > 50, 'applyPadX 몸통이 비었다');
  /* ★2026-10-07 — 아래 패딩 띠(현빈 ①)의 덩이도 «실제로» 뜯기나. */
  assert.ok(bodyOf(sec, 'function _showPadBHint', 'T0').length > 50, '_showPadBHint 몸통이 비었다');
  assert.ok(bodyOf(sec, 'function _schedulePadHintClear', 'T0').length > 50, '_schedulePadHintClear 몸통이 비었다');
  assert.ok(arrowBodyOf(sec, 'const applyPadB =', 'T0').length > 50, 'applyPadB 몸통이 비었다');
  assert.ok(bodyOf(exp, 'async function exportSection(', 'T0').length > 50, 'exportSection 몸통이 비었다');
});

/* ─────────────────────────────────────────────────────────────
   T1 CSS — «::before» 를 쓰고 색은 핑크 10% 다
   ⇐ 되돌리면 빨강: ::before 를 ::after 로 바꾸면(선택 아웃라인과 충돌하는 그 자리)
      셀렉터를 못 찾아 터진다. 색 숫자를 하나라도 바꿔도 터진다.
   ───────────────────────────────────────────────────────────── */
test('T1 ★띠는 ::before 로 그리고 색은 핑크 10% 다', () => {
  const css = codeOnly(CSS);

  /* ⛔::after 를 «먼저» 본다 — 순서를 바꾸면 ::after 로 바꾼 변이가
       「셀렉터가 없다」라는 자르개 쪽 이유로 터져, 진짜 원인(충돌)을 못 댄다.
     ::after 는 섹션 선택 아웃라인(.section-block.selected::after)과 hover fill 이 이미 쓴다.
     섹션은 «선택된 채로» 슬라이더를 만지므로 충돌이 확정이다. */
  assert.doesNotMatch(css, /body\.gdt-pad-on[^{]*::after/,
    '★패딩 힌트가 ::after 를 쓴다 — 섹션 선택 아웃라인이 이미 그 의사요소를 쓴다(충돌)');

  const rule = ruleOf(css, 'body.gdt-pad-on .section-inner::before', 'T1');

  /* ★2026-10-07 현빈 ② — 색을 «변수로 열었다»(컬러피커). ⛔폴백은 ★여전히 핑크 10% 다:
       폴백을 바꾸면 D1(:129 색 문자열)·D11(:542 PINK_ON_BLUE 픽셀)이 빨강이다.
       ⇒ 이 단언은 ⑴변수를 쓰나 ⑵기본값이 그대로인가 ★둘을 같이 잠근다. */
  assert.match(rule, /border-left:\s*var\(--gdt-pad-l,\s*0px\)\s*solid\s*var\(--gdt-padhint-color,\s*rgba\(255,\s*0,\s*128,\s*\.10\)\)/,
    '★왼쪽 띠가 「--gdt-pad-l 두께 · var(--gdt-padhint-color, 핑크 10%)」가 아니다');
  assert.match(rule, /border-right:\s*var\(--gdt-pad-r,\s*0px\)\s*solid\s*var\(--gdt-padhint-color,\s*rgba\(255,\s*0,\s*128,\s*\.10\)\)/,
    '★오른쪽 띠가 「--gdt-pad-r 두께 · var(--gdt-padhint-color, 핑크 10%)」가 아니다');

  /* 테두리 «두께»가 곧 패딩 폭이 되려면 box-sizing:border-box + inset:0 이어야 한다. */
  assert.match(rule, /box-sizing:\s*border-box/, 'box-sizing:border-box 가 없으면 두께가 패딩 폭과 어긋난다');
  assert.match(rule, /inset:\s*0/, 'inset:0 이 없으면 띠가 섹션 안쪽을 덮지 못한다');
  assert.match(rule, /pointer-events:\s*none/, 'pointer-events:none 이 없으면 띠가 클릭을 먹는다');

  /* ★띠는 풀블리드 에셋 «위»에 얹힌다 — z-index 가 없으면 에셋에 가려 폭이 짧아 «보인다»
     (실측: 패딩 88px 줄이 55px 로 읽혔다). ⛔이 단언은 「소스에 있나」까지만 안다 —
     «화면에서 실제로 보이나»는 dom D11 이 픽셀로 잰다. 둘 다 있어야 한다. */
  assert.match(rule, /z-index:\s*1\b/,
    '★z-index 가 없다 — 풀블리드 에셋이 띠를 덮어 패딩 폭이 «틀리게» 보인다');

  /* 절대배치가 서려면 부모에 position 이 있어야 한다 — .section-inner 는 평소 position 이 없다. */
  assert.match(css, /body\.gdt-pad-on\s+\.section-inner\s*\{[^}]*position:\s*relative/,
    '★부모에 position:relative 가 없다 — inset:0 이 섹션이 아닌 «더 바깥»을 기준으로 잡힌다');
});

/* ─────────────────────────────────────────────────────────────
   T2 JS — 변수를 «그 섹션의 inner 에» 박는다
   ⇐ 되돌리면 빨강: inner.style → document.body.style 로 바꾸면
      「받는 쪽이 첫 매개변수가 아니다」로 터진다(그리고 런타임 D3 도 같이 터진다).
   ───────────────────────────────────────────────────────────── */
test('T2 ★--gdt-pad-l·--gdt-pad-r 는 «그 섹션의 inner» 에 박힌다 (body 아님)', () => {
  const sec = codeOnly(SEC);

  /* 헬퍼의 첫 매개변수 이름을 «소스에서» 읽는다 — 이름이 바뀌어도 검사는 산다. */
  const sig = sec.match(/function\s+_showPadXHint\s*\(\s*([A-Za-z_$][\w$]*)\s*,/);
  assert.ok(sig, '★_showPadXHint 의 매개변수를 못 읽었다 — 배선이 사라졌나');
  const innerParam = sig[1];

  const body = bodyOf(sec, 'function _showPadXHint', 'T2');

  for (const v of ['--gdt-pad-l', '--gdt-pad-r']) {
    const m = body.match(new RegExp(`([\\w$.]+)\\.style\\.setProperty\\('${v}'`));
    assert.ok(m, `★${v} 를 setProperty 하는 곳이 없다`);
    assert.strictEqual(m[1], innerParam,
      `★${v} 를 «${m[1]}» 에 박고 있다 — 그 섹션의 inner(${innerParam})가 아니면 ` +
      '모든 섹션이 같은 띠를 쓰게 된다');
  }

  /* body/documentElement 에 «따로» 박는 길이 생기지 않았나. */
  assert.doesNotMatch(body, /document\.(body|documentElement)\.style\.setProperty\('--gdt-pad/,
    '★변수를 body 에 박고 있다 — 섹션마다 패딩이 다른데 모든 섹션이 같은 띠를 쓴다');

  /* 클래스는 반대로 «body 에» 붙어야 CSS 셀렉터가 선다. */
  assert.match(body, /document\.body\.classList\.add\('gdt-pad-on'\)/,
    'body 에 gdt-pad-on 을 안 붙이면 CSS 규칙이 서지 않는다');

  /* 슬라이더·숫자칸이 «같은 손»을 타나 — applyPadX 한 곳을 지나므로 둘 다 걸린다. */
  const ap = arrowBodyOf(sec, 'const applyPadX =', 'T2');
  assert.match(ap, /_showPadXHint\(\s*inner\s*,/,
    '★applyPadX 가 힌트를 안 부른다 — 배선이 끊겼다(슬라이더를 움직여도 띠가 안 뜬다)');
});

/* ─────────────────────────────────────────────────────────────
   T3 내보내기 가드 — gdt-pad-on «도» 끈다
   ⇐ 되돌리면 빨강: remove('gdt-pad-on') 한 줄을 빼면 터진다.
      ★기존 M2(그리드)도 계속 초록이어야 한다 — 이 검사는 그 옆에 «더한다».
   ───────────────────────────────────────────────────────────── */
test('T3 ★내보내기 직전 gdt-pad-on 도 끄고 finally 로 되돌린다', () => {
  /* ★L1(2026-10-04) — 가드 몸은 capture-safety.js withGuideOff «한 벌»로 옮겼다(PNG exportSection · 썸네일 captureThumbnail 이 같이 부른다).
     닻을 그 함수로 옮기고, exportSection 이 그 함수를 «부르는지»를 따로 본다. */
  const exp = codeOnly(EXP);
  assert.match(bodyOf(exp, 'async function exportSection(', 'T3'), /withGuideOff\(/, '★exportSection 이 가드(withGuideOff)를 안 부른다');
  const body = bodyOf(codeOnly(readSrc(ROOT, 'js', 'io', 'capture-safety.js')), 'export async function withGuideOff(', 'T3');

  assert.match(body, /classList\.remove\('gdt-pad-on'\)/,
    '★내보내기 직전에 패딩 힌트를 끄는 코드가 없다 — 띠가 내보낸 이미지에 찍힌다');
  assert.match(body, /finally\s*\{[\s\S]*classList\.add\('gdt-pad-on'\)/,
    '★되돌리기가 finally 에 없다 — 내보내기가 실패하면 띠가 영영 꺼진 채로 남는다');

  /* 형제 가드(그리드)를 밀어내지 않았나 — 둘 다 살아 있어야 한다. */
  assert.match(body, /classList\.remove\('gdt-grid-on'\)/,
    '★그리드 가드가 사라졌다 — 패딩 가드를 넣으며 형제를 밀어냈다');
});

/* ─────────────────────────────────────────────────────────────
   T4 ★변수는 «문서에 남지 않는다» — 400ms 뒤 회수한다
   ⇐ 되돌리면 빨강: 거두기(_schedulePadHintClear)의 어느 한 줄을 빼도, 또는
      ★두 소비자(좌우·아래) 중 하나가 그 문을 안 부르면 터진다.
   왜 중요한가: 저장은 getSerializedCanvas(= clone.innerHTML)라 인라인 변수가
   «프로젝트 파일»에 그대로 실린다. 옆집 그리드 가이드가 DOM 을 안 건드리는 이유.
   ★2026-10-07 구조 변경 — 거두기를 «한 벌»로 모았다(아래 패딩 띠가 생기며 두 벌이 될 자리였다).
     ⛔그래서 이 검사는 「_showPadXHint 몸통에 removeProperty 가 있나」로 ★재지 않는다 —
       그 꼴을 요구하면 ★중복이 싼 길이 되어 명부가 둘로 갈린다.
     ★대신 ⑴공용 본문이 온전한가 ⑵★소비자가 둘 다 그 문을 지나나 를 ★같이 잰다.
   ───────────────────────────────────────────────────────────── */
test('T4 ★400ms 뒤 클래스와 «변수까지» 거둔다 — 공용 한 벌 ＋ 소비자 둘', () => {
  const sec = codeOnly(SEC);
  const clear = bodyOf(sec, 'function _schedulePadHintClear', 'T4');

  assert.match(clear, /clearTimeout\(_padHintTimer\)/, '이전 타이머를 안 지우면 디바운스가 아니다');
  assert.match(clear, /setTimeout\([\s\S]*?,\s*400\)/, '★400ms 디바운스가 없다 — 띠가 안 사라지거나 시간이 다르다');
  assert.match(clear, /document\.body\.classList\.remove\('gdt-pad-on'\)/, '★클래스를 안 거둔다 — 띠가 영영 남는다');
  assert.match(clear, /sweepPadHintVars\(\)/,
    '★변수를 안 거둔다 — 인라인 변수가 프로젝트 파일에 실린다');

  /* ★「합쳤다」로 끝내지 않는다 — ★합친 것을 쓰는 자가 ★둘 다인지 센다.
     ⇒ 공용 본문을 무력화하면 ★두 기능이 같이 죽는다(그게 한 벌이라는 뜻이다). */
  for (const [fn, label] of [['_showPadXHint', '좌우'], ['_showPadBHint', '아래']]) {
    const body = bodyOf(sec, 'function ' + fn, 'T4');
    assert.match(body, /_schedulePadHintClear\(\)/,
      `★${label} 띠(${fn})가 공용 거두기를 안 부른다 — 그 띠의 변수가 영영 남는다`);
  }
  /* ★타이머는 «한 벌»이다 — 둘이 각자 타이머를 가지면 앞 타이머가 둘 다의 클래스를 먼저 끈다. */
  const timers = (sec.match(/_padHintTimer\s*=\s*setTimeout/g) || []).length;
  assert.strictEqual(timers, 1,
    `★타이머를 거는 자리가 ${timers}곳 — 1 이어야 한다(2 면 앞 타이머가 뒤 띠를 꺼 버린다)`);
});

/* ─────────────────────────────────────────────────────────────
   T5 ★범위를 안 넘었다 — «섹션 패널의 좌우 ＋ 아래 패딩» 둘이다
   ★★T5 는 «뒤집혔다»(2026-10-07). 옛 단언은 「아래 여백(applyPadB)에 힌트가 붙으면 빨강」이었고,
     그 까닭은 «그때의 범위»(2026-09-08 = 좌우 하나)였다. 현빈이 그걸 콕 집어 무르셨다:
       「아래 패딩 조절시 안보이는 문제가 있음 / 이걸 조절해도 패딩이 어떻게 줄어드는지 안보임」
     ⇒ 막아둔 ★까닭이 죽었고 ★문만 남아, 검사가 ★현빈이 시킨 것을 도로 막고 있었다.
   ⛔그래서 지우는 게 아니라 «★방향을 뒤집어» 그대로 세운다 — 같은 파일 T6 이 세운 선례다.
     「범위를 안 넘었다」는 ★규칙 자체는 살아 있다: row·모달·프레임 패딩에 섹션용 힌트가
     새로 얹히면 ★여전히 빨강이다. 조건이 하나 ★늘었지 줄지 않았다.
   ⇐ 되돌리면 빨강: applyPadB 의 _showPadBHint 호출을 빼면(= 현빈 ① 이전으로 돌리면) 터진다.
   ───────────────────────────────────────────────────────────── */
test('T5 ★힌트는 «좌우»와 «아래» 두 곳에서 불린다 (그 밖으로는 안 번진다)', () => {
  const sec = codeOnly(SEC);

  /* ★하한도 박는다 — 「아무 데서도 안 부른다」가 통과하면 안 된다. 각 선언(1)+호출(1)=2. */
  for (const [fn, wire, label] of [
    ['_showPadXHint', 'const applyPadX =', '좌우'],
    ['_showPadBHint', 'const applyPadB =', '아래'],
  ]) {
    const calls = (sec.match(new RegExp(fn + '\\(', 'g')) || []).length;
    assert.strictEqual(calls, 2,
      `${fn} 가 ${calls}곳에 나온다 — 선언1+호출1 인 2 여야 한다(0이면 배선 없음, 3+면 범위를 넘었다)`);
    const body = arrowBodyOf(sec, wire, 'T5');
    assert.match(body, new RegExp(fn + '\\('),
      `★${label} 패딩 핸들러(${wire})가 ${fn} 를 안 부른다 — 슬라이더를 움직여도 띠가 안 뜬다`);
  }

  /* ★아래 띠는 «섹션 상자»에 박힌다 — inner 에 박으면 그릴 자리가 없다(padding-bottom 은 섹션 것). */
  const bBody = bodyOf(sec, 'function _showPadBHint', 'T5');
  const sig = sec.match(/function\s+_showPadBHint\s*\(\s*([A-Za-z_$][\w$]*)\s*,/);
  assert.ok(sig, '★_showPadBHint 의 매개변수를 못 읽었다');
  const m = bBody.match(/([\w$.]+)\.style\.setProperty\('--gdt-pad-b'/);
  assert.ok(m, '★--gdt-pad-b 를 setProperty 하는 곳이 없다');
  assert.strictEqual(m[1], sig[1],
    `★--gdt-pad-b 를 «${m[1]}» 에 박고 있다 — 그 섹션(${sig[1]})이 아니면 띠가 엉뚱한 상자에 선다`);

  /* ★게이트를 좌우와 «같은 문»으로 본다 — 「패딩 비주얼 끔」인데 아래만 뜨면 결함이다. */
  assert.match(bBody, /if\s*\(\s*window\.readPadHintOn\s*&&\s*window\.readPadHintOn\(\)\s*===\s*false\s*\)\s*return;/,
    '★아래 띠에 on/off 게이트가 없다 — 꺼도 아래 띠만 뜬다');

  /* ⛔범위 밖으로 번지지 않았다 — row/모달 패딩 핸들러엔 섹션 힌트가 없다. */
  for (const needle of ['const applyPadX =', 'const applyPadB =']) {
    assert.ok(sec.includes(needle), `★${needle} 가 사라졌다 — 이 검사의 전제가 무너졌다`);
  }
  const hintCalls = (sec.match(/_showPad[XB]Hint\(/g) || []).length;
  assert.strictEqual(hintCalls, 4,
    `★섹션 힌트 호출/선언이 모두 ${hintCalls}곳 — 좌우2+아래2 인 4 여야 한다(더 많으면 범위를 넘었다)`);
});

/* ═══════════════════════════════════════════════════════════════
   켜고 끄기 (2026-09-08 현빈 추가 지시)
   > 「페이지 프로퍼티 세팅에서 그리드섹션 쪽에 패딩비쥬얼 활성화여부 체크를 가능하게 하자.
      핑크 색보이게하는것도 꺼둘수 있게 … 혹은」
   ⚠️문장이 «혹은»에서 끊겼다 — 끊긴 뒤는 짓지 않는다. 확정된 것만 잰다.
   ═══════════════════════════════════════════════════════════════ */

/* ⇐ 되돌리면 빨강: 체크박스 줄을 지우거나, Grid 절 «밖»으로 옮기거나, 라디오로 바꾸면 터진다. */
/* ★T6 은 «뒤집혔다»(2026-09-09). 옛 단언은 「이 절의 어휘는 «체크박스»다」였고 라디오를 «금지»했다.
     현빈이 그걸 콕 집어 무르셨다: 「이건 라디오버튼으로 해주고 섹션이 깨지네」
   ⇒ 절의 어휘가 «라디오»로 바뀌었다. 옛 단언을 남겨 두면 «현빈이 시킨 것»을 검사가 도로 막는다.
   ⛔그래서 지우는 게 아니라 «방향을 뒤집어» 그대로 세운다 — 어휘가 섞이면 안 된다는 «규칙 자체»는 살아 있다.
     (체크박스가 몰래 돌아오는 것도 여전히 빨강이다. 조건이 하나 늘었지 줄지 않았다.) */
test('T6 ★페이지 패널 Grid 절 «안»에 패딩 비주얼 «라디오 쌍»이 있다 (어휘가 안 섞인다)', () => {
  const src = codeOnly(PAGE);

  /* ★입력이 살아 있다 — Grid 절을 «실제로» 찾았나. 못 찾으면 아래는 통째로 공회전이다. */
  const gi = src.indexOf('<div class="prop-section-title">Grid</div>');
  assert.ok(gi > 0, 'Grid 절 제목을 못 찾았다 — 페이지 패널 구조가 바뀌었나');
  /* 절의 끝 = 다음 prop-section 제목(없으면 문서 끝). ⛔고정 창으로 자르지 않는다. */
  const nx = src.indexOf('<div class="prop-section-title">', gi + 10);
  const grid = src.slice(gi, nx > 0 ? nx : src.length);
  assert.ok(grid.length > 200 && grid.length < 6000,
    `Grid 절을 ${grid.length}자로 떴다 — 0 이면 잴 게 없고, 너무 크면 절 경계를 놓쳤다`);

  /* 형제(그리드 가이드)가 «같은 절 안»에 있나 — 이 절을 제대로 떴다는 양성대조. */
  assert.match(grid, /id="page-grid-on"/, 'Grid 절 안에 그리드 가이드 체크박스가 없다 — 엉뚱한 덩이를 떴다');

  assert.match(grid, /type="radio"[^>]*id="page-pad-hint-on"/,
    '★Grid 절 안에 패딩 비주얼 «라디오»가 없다 (현빈 2026-09-09)');
  assert.match(grid, /id="page-pad-hint-off"/,
    '★끔 라디오가 없다 — 라디오는 «짝»이 있어야 끌 수 있다(.checked=false 로는 못 끈다)');
  /* ⛔한 절에 두 어휘를 섞지 않는다 — 이제 어휘는 «라디오»다. 체크박스가 돌아오면 빨강. */
  assert.doesNotMatch(grid, /type="checkbox"/,
    '★같은 절에 체크박스가 섞였다 — 이 절의 어휘는 라디오다');
});

/* ⇐ 되돌리면 빨강: `raw === null` 분기를 지우거나 `!!o.on` 으로 바꾸면(=기본 꺼짐) 터진다. */
test('T7 ★기본은 «켜짐» — 저장된 키가 없으면 true 다', () => {
  const src = codeOnly(PAGE);
  const body = bodyOf(src, 'function readPadHintOn', 'T7');

  assert.match(body, /raw\s*===\s*null[\s\S]{0,40}return\s+true/,
    '★키가 «없을» 때 true 를 돌려주는 분기가 없다 — 기본이 꺼짐이 되어 버린다');
  assert.doesNotMatch(body, /return\s+!!\s*o?\.?on/,
    '★`!!pref.on` 꼴이 있다 — 그건 그리드(기본 꺼짐)의 식이다. 여기는 기본이 켜짐이다');
  /* 깨진 값도 켜짐으로 — 기능이 «사라지는» 쪽보다 낫다 */
  assert.match(body, /catch[\s\S]{0,30}return\s+true/, '읽기가 던졌을 때 true 로 떨어지지 않는다');
});

/* ⇐ 되돌리면 빨강: 키를 GRID_KEY 와 합치면(한 키에 섞으면) 터진다. */
test('T8 ★저장 키는 그리드와 «따로»다 — 한 키에 섞으면 한쪽이 다른 쪽을 지운다', () => {
  const src = codeOnly(PAGE);

  const padKey  = src.match(/const PAD_HINT_KEY\s*=\s*'([^']+)'/);
  const gridKey = src.match(/const GRID_KEY\s*=\s*'([^']+)'/);
  /* ★입력이 살아 있다 — 두 키를 «둘 다» 찾았나. 한쪽이라도 못 찾으면 비교가 무의미하다. */
  assert.ok(padKey,  'PAD_HINT_KEY 를 못 찾았다');
  assert.ok(gridKey, 'GRID_KEY 를 못 찾았다 — 그리드 저장이 사라졌나');
  assert.notStrictEqual(padKey[1], gridKey[1],
    `★두 설정이 같은 키(${padKey[1]})를 쓴다 — 한쪽 저장이 다른 쪽을 지운다`);

  /* 읽고 쓰는 문이 «하나»인가 — localStorage 를 만지는 자리가 그 두 함수 안에만 있어야 한다. */
  const uses = [...src.matchAll(/localStorage\.(?:getItem|setItem)\(PAD_HINT_KEY/g)].length;
  assert.strictEqual(uses, 2,
    `PAD_HINT_KEY 로 localStorage 를 만지는 곳이 ${uses}군데 — 읽기1+쓰기1 인 2여야 한다(0이면 배선 없음, 3+면 문이 늘었다)`);
});

/* ⇐ 되돌리면 빨강: 게이트 한 줄을 지우면 꺼도 핑크가 뜬다.
     ⛔`!window.readPadHintOn?.()` 로 «바꿔도» 빨강이어야 한다 — 그건 기본값을 뒤집는다. */
test('T9 ★꺼져 있으면 힌트가 아예 안 뜬다 (그리고 기본값을 뒤집지 않는다)', () => {
  const sec = codeOnly(SEC);
  const body = bodyOf(sec, 'function _showPadXHint', 'T9');

  /* ⛔이 검사를 «먼저» 둔다 — 순서를 바꾸면 옵셔널 체이닝 변이가
       「게이트가 없다」라는 뭉툭한 이유로 터져, 진짜 원인(기본값이 뒤집힌다)을 못 댄다. */
  assert.doesNotMatch(body, /!\s*window\.readPadHintOn\?\.\(\)/,
    '★`!window.readPadHintOn?.()` 꼴이다 — 함수가 아직 없을 때(로드 순서) 「꺼짐」으로 읽혀 기본값이 뒤집힌다');

  assert.match(body, /if\s*\(\s*window\.readPadHintOn\s*&&\s*window\.readPadHintOn\(\)\s*===\s*false\s*\)\s*return;/,
    '★「있고 그게 false 일 때만 접는다」 게이트가 없다');
  /* 게이트는 «클래스·변수를 붙이기 전»에 있어야 한다 — 뒤에 있으면 껐는데도 변수가 박힌다. */
  const gate = body.indexOf('readPadHintOn');
  const set  = body.indexOf("setProperty('--gdt-pad-l'");
  assert.ok(gate > 0 && set > 0 && gate < set,
    '★게이트가 변수 박기 «뒤»에 있다 — 꺼도 인라인 변수가 남는다');
});

/* ⇐ 되돌리면 빨강: 세척에서 두 줄을 빼면 「끄는 중 저장」 창으로 변수가 샌다(D6 이 런타임으로 잡는다). */
test('T10 ★세척(serializeCleanRoot)도 --gdt-pad 를 걷는다 — 거두기가 «못 도는 창»의 그물', () => {
  const src = codeOnly(SER);

  /* ★입력이 살아 있다 — 세척 함수를 «실제로» 떴나. */
  const body = bodyOf(src, 'function serializeCleanRoot', 'T10');
  assert.ok(body.length > 500, `serializeCleanRoot 몸통이 ${body.length}자 — 못 떴다`);
  assert.match(body, /root\.querySelectorAll\('\[class\]'\)/, '형제 세척(런타임 마커 sweep)이 안 보인다 — 엉뚱한 덩이를 떴다');
  /* ★그 sweep 이 «진짜 마커를 잡는가» — 모양이 아니라 행동으로 확인한다. */
  const rm = loadRuntimeMarkers(SER);
  assert.ok(rm && rm.isRuntimeMarker('selected') && rm.isRuntimeMarker('bn2-line-selected'),
    '★런타임 마커 판정이 죽었다 — sweep 이 돌아도 아무것도 안 걷는다');

  assert.match(body, /removeProperty\('--gdt-pad-l'\)/, '★세척이 --gdt-pad-l 을 안 걷는다');
  assert.match(body, /removeProperty\('--gdt-pad-r'\)/, '★세척이 --gdt-pad-r 을 안 걷는다');
  /* ⛔라이브 DOM 이 아니라 «클론(root)» 에만 써야 한다 — 이 함수의 계약이다. */
  assert.match(body, /root\.querySelectorAll\('\.section-inner'\)[\s\S]{0,200}removeProperty\('--gdt-pad-l'\)/,
    '★root(클론)가 아닌 곳에서 걷고 있다 — 라이브 DOM 을 건드리면 안 된다');
});


/* ═══════════════════════════════════════════════════════════════
   아래 패딩 띠 ＋ 색 피커 (2026-10-07 현빈 ①②)
   ═══════════════════════════════════════════════════════════════ */

/* ⇐ 되돌리면 빨강: 셀렉터를 .section-inner 로 되돌리거나, ::after 로 바꾸거나,
     border-bottom 을 지우거나, box-sizing/inset/pointer-events/z-index 중 하나를 빼면 터진다. */
test('T11 ★아래 띠는 «.section-block 의 ::before» 로 그린다 (좌우와 상자가 다르다)', () => {
  const css = codeOnly(CSS);

  /* ⛔::after 를 «먼저» 본다 — ::after 로 바꾼 변이가 「셀렉터가 없다」라는
       자르개 쪽 이유로 터져 진짜 원인(hover fill·선택 아웃라인과 충돌)을 못 대는 것을 막는다. */
  assert.doesNotMatch(css, /body\.gdt-pad-on\s+\.section-block[^{]*::after/,
    '★아래 띠가 ::after 를 쓴다 — hover fill 과 선택 아웃라인(z-index 90)이 이미 그 의사요소를 쓴다');

  const rule = ruleOf(css, 'body.gdt-pad-on .section-block[style*="--gdt-pad-b"]::before', 'T11');

  assert.match(rule, /border-bottom:\s*var\(--gdt-pad-b,\s*0px\)\s*solid\s*var\(--gdt-padhint-color,\s*rgba\(255,\s*0,\s*128,\s*\.10\)\)/,
    '★아래 띠가 「--gdt-pad-b 두께 · var(--gdt-padhint-color, 핑크 10%)」가 아니다');
  /* 테두리 «두께»가 곧 padding-bottom 이 되려면 border-box + inset:0 이어야 한다(계산이 없다). */
  assert.match(rule, /box-sizing:\s*border-box/, 'box-sizing:border-box 가 없으면 두께가 패딩과 어긋난다');
  assert.match(rule, /inset:\s*0/, 'inset:0 이 없으면 띠가 섹션 상자에 맞지 않는다');
  assert.match(rule, /pointer-events:\s*none/, 'pointer-events:none 이 없으면 띠가 클릭을 먹는다');
  assert.match(rule, /z-index:\s*1\b/, '★z-index 가 없다 — 섹션 안 블록이 띠를 덮어 폭이 «틀리게» 보인다');

  /* ★절대배치의 전제 — .section-block 에 position 이 «평소에도» 있어야 한다.
     ⚠️좌우 쪽은 켜는 «동안»만 relative 로 바꾼다(.section-inner 는 평소 position 이 없다).
       여기는 그 보정이 없으므로, 그 전제가 사라지면 띠가 «더 바깥»을 기준으로 잡힌다. */
  assert.match(css, /^\.section-block\s*\{[^}]*position:\s*relative/m,
    '★.section-block 에 position:relative 가 없다 — inset:0 이 섹션이 아닌 더 바깥을 기준으로 잡힌다');

  /* ⛔좌우 규칙에 border-bottom 을 끼워 넣는 «형제 구현»이 생기지 않았나 —
       좌우 띠는 inner 에 서므로 거기에 아래 띠를 그리면 padding-bottom 영역을 못 덮는다. */
  const leftRule = ruleOf(css, 'body.gdt-pad-on .section-inner::before', 'T11');
  assert.doesNotMatch(leftRule, /border-bottom/,
    '★좌우(inner) 규칙에 border-bottom 이 들어갔다 — inner 에는 padding-bottom 이 없어 엉뚱한 자리를 칠한다');
});

/* ⇐ 되돌리면 빨강: 두 소스의 접두사 문자열이 갈리면 터진다.
     ★그리고 색 변수를 `--gdt-pad-color` 로 되돌리면(= 접두사에 걸리게 하면) 터진다. */
test('T12 ★쓸기 접두사는 «두 소스에서 같다» · 사용자 색은 그 접두사에 ⛔안 걸린다', () => {
  const page = codeOnly(PAGE);
  const ser  = codeOnly(SER);

  const a = page.match(/PAD_HINT_VAR_PREFIX\s*=\s*'([^']+)'/);
  const b = ser.match(/PAD_HINT_VAR_PREFIX\s*=\s*'([^']+)'/);
  /* ★입력이 살아 있다 — 둘 다 찾았나. 한쪽이라도 없으면 비교가 무의미하다. */
  assert.ok(a, '★prop-page.js 에서 PAD_HINT_VAR_PREFIX 를 못 찾았다 — 쓸기가 사라졌나');
  assert.ok(b, '★section-serialize.js 에서 PAD_HINT_VAR_PREFIX 를 못 찾았다 — 저장 안전망이 사라졌나');
  assert.strictEqual(a[1], b[1],
    `★두 소스의 접두사가 갈렸다(page='${a[1]}' serialize='${b[1]}') — 한쪽이 못 걷는 변수가 생긴다. ` +
    'section-serialize.js 는 플레인 스크립트라 import 를 못 해서 이 검사가 그 자리의 자다');

  /* ★쓸는 변수들이 «정말» 그 접두사로 시작하나 — 접두사가 맞아도 변수 이름이 어긋나면 안 걷힌다. */
  for (const v of ['--gdt-pad-l', '--gdt-pad-r', '--gdt-pad-b']) {
    assert.ok(v.startsWith(a[1]), `★${v} 가 접두사 '${a[1]}' 로 시작하지 않는다 — 쓸기가 이 변수를 못 걷는다`);
  }

  /* ★★경계 — 사용자가 고른 «색»이 접두사에 걸리면 쓸기가 그 설정을 조용히 지운다.
       `--gdt-pad-color` 와 `--gdt-padhint-color` 는 ★한 글자 차이다. 그래서 이 줄이 있다. */
  const css = codeOnly(CSS);
  const colorVars = [...new Set([...css.matchAll(/var\((--gdt-[A-Za-z-]*color)\s*,/g)].map(m => m[1]))];
  assert.ok(colorVars.includes('--gdt-padhint-color'),
    `★CSS 에서 패딩 띠 색 변수를 못 찾았다(찾은 것: ${JSON.stringify(colorVars)})`);
  for (const v of colorVars) {
    assert.ok(!v.startsWith(a[1]),
      `★색 변수 ${v} 가 쓸기 접두사 '${a[1]}' 에 걸린다 — 띠를 거둘 때 사용자가 고른 색까지 지워진다`);
  }
});

/* ⇐ 되돌리면 빨강: 두 피커 중 하나를 Grid 절 밖으로 옮기거나, 키를 합치거나,
     칠하는 식을 두 벌로 만들면 터진다. */
test('T13 ★색 피커 둘이 Grid 절 «안»에 각자 자기 로우에 있다 · 키 넷이 모두 다르다', () => {
  const src = codeOnly(PAGE);

  /* ★입력이 살아 있다 — Grid 절을 실제로 떴나(T6 과 같은 자르개). */
  const gi = src.indexOf('<div class="prop-section-title">Grid</div>');
  assert.ok(gi > 0, 'Grid 절 제목을 못 찾았다 — 페이지 패널 구조가 바뀌었나');
  const nx = src.indexOf('<div class="prop-section-title">', gi + 10);
  const grid = src.slice(gi, nx > 0 ? nx : src.length);
  assert.ok(grid.length > 200 && grid.length < 6000, `Grid 절을 ${grid.length}자로 떴다`);
  assert.match(grid, /id="page-grid-on"/, 'Grid 절 안에 그리드 라디오가 없다 — 엉뚱한 덩이를 떴다');

  assert.match(grid, /type="color"[^>]*id="page-grid-color"/,
    '★그리드 가이드 색 피커가 Grid 절 안에 없다 (현빈 ②「그리드 가이드 켬 라디오 같은 로우에」)');
  assert.match(grid, /type="color"[^>]*id="page-pad-hint-color"/,
    '★패딩 비주얼 색 피커가 Grid 절 안에 없다 (현빈 ②「패딩비쥬얼 로우에도」)');

  /* ★각 피커가 «자기 로우» 안에 있나 — 한 로우에 둘이 몰리면 폭이 넘친다(211px 실측). */
  for (const [pickId, radioId] of [['page-grid-color', 'page-grid-on'], ['page-pad-hint-color', 'page-pad-hint-on']]) {
    const pi = grid.indexOf('id="' + pickId + '"');
    const ri = grid.indexOf('id="' + radioId + '"');
    assert.ok(pi > ri && pi > 0 && ri > 0, `★${pickId} 가 ${radioId} 보다 앞에 있다 — 로우 짝이 어긋났다`);
    /* 그 사이에 «다음 로우의 시작»이 끼면 다른 로우에 붙은 것이다. */
    const between = grid.slice(ri, pi);
    assert.ok(!between.includes('<div class="prop-row">'),
      `★${pickId} 가 ${radioId} 의 로우가 아니라 «다음 로우»에 붙었다`);
  }

  /* ★키 넷이 모두 다르다 — 한 키에 섞으면 토글 한 번이 색을 지운다(그 까닭이 코드 주석에 있다). */
  const keys = {};
  for (const name of ['PAD_HINT_KEY', 'GRID_KEY', 'PAD_HINT_COLOR_KEY', 'GRID_COLOR_KEY']) {
    const m = src.match(new RegExp('const ' + name + "\\s*=\\s*'([^']+)'"));
    assert.ok(m, `★${name} 를 못 찾았다`);
    keys[name] = m[1];
  }
  const vals = Object.values(keys);
  assert.strictEqual(new Set(vals).size, 4,
    `★저장 키가 겹친다: ${JSON.stringify(keys)} — 한쪽 저장이 다른 쪽을 지운다`);

  /* ★칠하는 식은 «한 곳»에서만 온다 — 패널 열 때와 피커 만질 때가 갈리면 색이 두 벌이 된다. */
  for (const fn of ['applyPadHintColor', 'applyGridColor']) {
    const defs = (src.match(new RegExp('function ' + fn + '\\(', 'g')) || []).length;
    assert.strictEqual(defs, 1, `★${fn} 의 정의가 ${defs}곳 — 1 이어야 한다`);
  }
  /* ★알파는 한 자리에서만 — 좌우/아래/그리드가 같은 투명도를 써야 「아래가 보이는 채로」가 선다. */
  const alphas = (src.match(/const HINT_ALPHA\s*=/g) || []).length;
  assert.strictEqual(alphas, 1, `★HINT_ALPHA 가 ${alphas}곳 — 1 이어야 한다`);

  /* ★모듈을 싣는 순간 칠한다 — 페이지 패널을 «한 번도 안 열어도» 섹션 슬라이더가 띠를 띄운다. */
  assert.match(src, /^applyPadHintColor\(readPadHintColor\(\)\);$/m,
    '★모듈 최상위에서 패딩 띠 색을 안 칠한다 — 패널을 안 열면 색이 폴백으로만 뜬다');
  assert.match(src, /^applyGridColor\(readGridColor\(\)\);$/m,
    '★모듈 최상위에서 그리드 색을 안 칠한다');
});


/* ⇐ 되돌리면 빨강: 라이브 거두기 두 자리 중 하나가 공용 쓸기를 안 부르거나,
     section-serialize.js 가 자기 쓸기를 잃으면 터진다.
   ★왜 «두 층»인가 — 합칠 수 없다(지디 2026-10-07 판정):
     ★저장 = 클론(root)에만 쓰는 계약 · ★화면 = 라이브 DOM.
     ⇒ 저장 쪽이 초록이라고 라이브 두 자리를 지우면 ★에디터 화면에 띠가 남는다.
     ⇒ 여긴 「경고를 달 자리 = 구조를 합칠 자리」의 ★반례다. 그래서 «수»를 박는다. */
test('T14 ★거두기는 «두 층»이다 — 라이브 2곳 ＋ 저장 1벌, ⛔한쪽으로 합칠 수 없다', () => {
  const page = codeOnly(PAGE);
  const sec  = codeOnly(SEC);
  const ser  = codeOnly(SER);

  /* ★쓸기의 «정의»는 한 곳 — 두 벌이면 식이 갈린다. */
  const defs = (page.match(/export function sweepPadHintVars\s*\(/g) || []).length;
  assert.strictEqual(defs, 1, `★sweepPadHintVars 정의가 ${defs}곳 — 1 이어야 한다`);

  /* ★라이브 소비자 = ★2. N 의 출처:
       ⑴ js/props/prop-section.js `_schedulePadHintClear` — 400ms 뒤 거두기
       ⑵ js/props/prop-page.js    패딩 비주얼 «끔» 라디오 — 즉시 거두기
     ⛔하한만 두지 않는다 — 「아무 데서도 안 부른다」도, 「엉뚱한 데 번졌다」도 빨강이어야 한다. */
  const secCalls  = (sec.match(/sweepPadHintVars\(\)/g) || []).length;
  const pageCalls = (page.match(/sweepPadHintVars\(\)/g) || []).length;
  assert.strictEqual(secCalls, 1,
    `★prop-section.js 의 공용 쓸기 호출이 ${secCalls}곳 — 1(거두기) 이어야 한다`);
  assert.strictEqual(pageCalls, 1,
    `★prop-page.js 의 공용 쓸기 호출이 ${pageCalls}곳 — 1(끔 라디오) 이어야 한다`);

  /* ★저장 층은 «자기 벌»을 갖는다 — 이 파일은 플레인 스크립트라 import 를 못 한다.
     ⇒ 공용 함수 이름을 부르면 그건 «런타임에 없을 수도 있는» 전역 의존이다. */
  assert.strictEqual((ser.match(/sweepPadHintVars/g) || []).length, 0,
    '★section-serialize.js 가 공용 쓸기 이름을 부른다 — 플레인 스크립트라 그 이름이 없을 수 있다(조용히 안 걷힌다)');
  assert.strictEqual((ser.match(/PAD_HINT_VAR_PREFIX\s*=/g) || []).length, 1,
    '★section-serialize.js 가 자기 접두사 선언을 잃었다 — 저장 안전망이 사라졌다');

  /* ★거두기가 «클래스»도 같이 끄나 — 변수만 걷고 클래스를 남기면 다음 섹션에 띠가 번진다. */
  assert.match(bodyOf(sec, 'function _schedulePadHintClear', 'T14'),
    /document\.body\.classList\.remove\('gdt-pad-on'\)/,
    '★라이브 거두기가 클래스를 안 끈다');
});

/* ⇐ 되돌리면 빨강: 주석 거르개(_strip-comments.js)가 죽으면 터진다.
   ★왜 — T5·T14 가 `_showPad[XB]Hint(` · `sweepPadHintVars()` 를 ★정규식으로 «센다».
     ⇒ 누군가 ★주석에 그 이름을 괄호째 적으면 ★제품 0줄인데 수가 늘어 빨강이 난다
       (2026-10-07 circletext 레인이 실제로 그 사고를 냈다 — 주석이 소스 파싱 게이트의 입력이다).
   ⇒ 「주석엔 괄호 없이 적어라」는 ★규약이고, 규약은 ★재는 자가 있어야 집행된다. 이것이 그 자다. */
test('T15 ★주석은 세어지지 않는다 — 소스 파싱 게이트의 입력에서 주석이 빠진다', () => {
  /* ★양성대조 — 거르개에 «주석 둘 ＋ 진짜 하나»를 먹여 1 이 나오나. 3 이면 거르개가 죽었다. */
  const probe = 'const a=1;\n/* _showPadXHint(기만) */\n// _showPadXHint(또기만)\nconst b=_showPadXHint(2);\n';
  const n = (codeOnly(probe).match(/_showPadXHint\(/g) || []).length;
  assert.strictEqual(n, 1,
    `★거르개가 주석 속 이름을 ${n}건 남겼다 — T5·T14 의 수가 «주석»에 따라 흔들린다`);
  /* ★음성대조 — 거르개가 «코드»까지 먹지는 않았나(0 이면 모든 수가 0 이 되어 전부 초록이 된다). */
  assert.ok(codeOnly(probe).includes('const b='), '★거르개가 코드까지 먹었다');

  /* ★그리고 지금 소스가 그 규약을 지키나 — 주석 줄에 그 꼴이 0건이어야 한다.
     ⛔거르개가 막아 주더라도 적지 마라: 거르개가 바뀌면 그날 수가 흔들린다. */
  const raw = readSrc(ROOT, 'js', 'props', 'prop-section.js');
  const commentLines = raw.split('\n').filter(l => /^\s*(\/\/|\/\*|\*)/.test(l));
  const bad = commentLines.filter(l => /_showPad[XB]Hint\(|sweepPadHintVars\(\)/.test(l));
  assert.strictEqual(bad.length, 0,
    `★주석 ${bad.length}줄에 세어지는 이름이 괄호째 적혀 있다: ${JSON.stringify(bad.slice(0, 2))}`);
  /* ★이 검사가 «무언가를 보고 있나» — 주석 줄 자체가 0 이면 위 단언이 공회전이다. */
  assert.ok(commentLines.length > 20,
    `★prop-section.js 의 주석 줄이 ${commentLines.length}줄 — 자르개가 주석을 못 찾았다(위 단언이 공회전)`);
});
