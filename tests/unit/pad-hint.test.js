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

  assert.match(rule, /border-left:\s*var\(--gdt-pad-l,\s*0px\)\s*solid\s*rgba\(255,\s*0,\s*128,\s*\.10\)/,
    '★왼쪽 띠가 「--gdt-pad-l 두께 · 핑크 10%」가 아니다');
  assert.match(rule, /border-right:\s*var\(--gdt-pad-r,\s*0px\)\s*solid\s*rgba\(255,\s*0,\s*128,\s*\.10\)/,
    '★오른쪽 띠가 「--gdt-pad-r 두께 · 핑크 10%」가 아니다');

  /* 테두리 «두께»가 곧 패딩 폭이 되려면 box-sizing:border-box + inset:0 이어야 한다. */
  assert.match(rule, /box-sizing:\s*border-box/, 'box-sizing:border-box 가 없으면 두께가 패딩 폭과 어긋난다');
  assert.match(rule, /inset:\s*0/, 'inset:0 이 없으면 띠가 섹션 안쪽을 덮지 못한다');
  assert.match(rule, /pointer-events:\s*none/, 'pointer-events:none 이 없으면 띠가 클릭을 먹는다');

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
  const exp = codeOnly(EXP);
  const body = bodyOf(exp, 'async function exportSection(', 'T3');

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
   ⇐ 되돌리면 빨강: removeProperty 두 줄을 빼면 터진다.
      왜 중요한가: 저장은 getSerializedCanvas(= clone.innerHTML)라 인라인 변수가
      «프로젝트 파일»에 그대로 실린다. 옆집 그리드 가이드가 DOM 을 안 건드리는 이유.
   ───────────────────────────────────────────────────────────── */
test('T4 ★400ms 뒤 클래스와 «변수까지» 거둔다 (프로젝트 파일 오염 방지)', () => {
  const sec = codeOnly(SEC);
  const body = bodyOf(sec, 'function _showPadXHint', 'T4');

  assert.match(body, /clearTimeout\(_padHintTimer\)/, '이전 타이머를 안 지우면 디바운스가 아니다');
  assert.match(body, /setTimeout\([\s\S]*?,\s*400\)/, '★400ms 디바운스가 없다 — 띠가 안 사라지거나 시간이 다르다');
  assert.match(body, /document\.body\.classList\.remove\('gdt-pad-on'\)/, '★클래스를 안 거둔다 — 띠가 영영 남는다');
  assert.match(body, /removeProperty\('--gdt-pad-l'\)/, '★--gdt-pad-l 을 안 거둔다 — 인라인 변수가 프로젝트 파일에 실린다');
  assert.match(body, /removeProperty\('--gdt-pad-r'\)/, '★--gdt-pad-r 을 안 거둔다 — 인라인 변수가 프로젝트 파일에 실린다');
});

/* ─────────────────────────────────────────────────────────────
   T5 ★범위를 안 넘었다 — «섹션 패널의 좌우 패딩» 하나만 건드렸다
   ⇐ 되돌리면 빨강: 아래 패딩(applyPadB)이나 row/모달 패딩에 힌트를 얹으면 터진다.
   ───────────────────────────────────────────────────────────── */
test('T5 ★힌트는 «좌우 패딩» 한 곳에서만 불린다', () => {
  const sec = codeOnly(SEC);
  const calls = (sec.match(/_showPadXHint\(/g) || []).length;
  /* ★하한도 박는다 — 「아무 데서도 안 부른다」가 통과하면 안 된다.
     선언(1) + applyPadX 호출(1) = 2. */
  assert.strictEqual(calls, 2,
    `_showPadXHint 가 ${calls}곳에 나온다 — 선언1+호출1 인 2 여야 한다(0이면 배선이 없고, 3 이상이면 범위를 넘었다)`);

  const padB = arrowBodyOf(sec, 'const applyPadB =', 'T5');
  assert.doesNotMatch(padB, /gdt-pad-on|_showPadXHint/,
    '★아래 여백(applyPadB)에까지 힌트가 붙었다 — 이번 범위는 «좌우 패딩» 하나다');
});
