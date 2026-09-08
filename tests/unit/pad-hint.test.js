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
  assert.match(body, /querySelectorAll\('\.selected'\)/, '형제 세척이 안 보인다 — 엉뚱한 덩이를 떴다');

  assert.match(body, /removeProperty\('--gdt-pad-l'\)/, '★세척이 --gdt-pad-l 을 안 걷는다');
  assert.match(body, /removeProperty\('--gdt-pad-r'\)/, '★세척이 --gdt-pad-r 을 안 걷는다');
  /* ⛔라이브 DOM 이 아니라 «클론(root)» 에만 써야 한다 — 이 함수의 계약이다. */
  assert.match(body, /root\.querySelectorAll\('\.section-inner'\)[\s\S]{0,200}removeProperty\('--gdt-pad-l'\)/,
    '★root(클론)가 아닌 곳에서 걷고 있다 — 라이브 DOM 을 건드리면 안 된다');
});
