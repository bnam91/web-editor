/* placeholder-not-content.test.js — «안내문구»(고스트 텍스트)를 «본문»으로 읽지 않는다
 *   2026-09-08 현빈 지시. 발견 경위: 현빈이 「고스트텍스트」라고 하셔서 찾아보다 나왔다.
 *
 * ★무엇이 문제였나
 *   빈 텍스트 블록의 「소제목을 입력하세요」는 CSS 유령이 아니라 «진짜 DOM 글자»다
 *   (block-factory.js 가 값으로 넣고 data-is-placeholder='true' 로 표시한다).
 *   에디터 UI 는 그 표시를 읽는데(block-drag.js 에 「안내문구가 본문으로 굳는 지뢰 방지」가 있다)
 *   MCP 는 «안 읽어서» 밖에서 보면 안 쓴 블록이 «다 쓴 것»으로 보였다.
 *   ⇒ ⑴「다 썼나」에 「다 썼다」고 답하고 ⑵말바꾸기가 안내문구를 «본문으로 굳히고»
 *     ⑶검색 히트가 안 쓴 블록으로 찬다.
 *
 * ⛔지우지 «않는다» — 표시한다. AI 가 「여긴 아직 안 썼다」를 알아야 채울 수 있다.
 *   숨기면 「없다」가 되고, 그럼 채워달라고 시킬 수도 없다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const readSrc = (...p) => fs.readFileSync(path.join(__dirname, ...p), 'utf8');
const CS  = readSrc('..', '..', 'js', 'canvas-state.js');
const MAIN = readSrc('..', '..', 'main.js');
const MCP = readSrc('..', '..', 'main', 'claude-pm', 'mcp-server.js');

/* ── 순수 함수로 «잣대» 자체를 검증한다 ─────────────────────────────────
   canvas-state 의 _isPlaceholderText 와 main.js 의 _isPh 는 «같은 규칙»이어야 한다.
   두 곳이 갈리면 「미리보기엔 안 뜨는데 검색엔 뜨는」 어긋남이 난다. */
function fakeEl(holders) {
  return {
    hasAttribute: () => false,
    querySelectorAll: () => holders,
  };
}
const H = (isPh, blank, text) => ({ dataset: { isPlaceholder: isPh, blank }, innerText: text });

/** canvas-state.js 의 규칙을 그대로 옮긴 판정기(원본이 바뀌면 P0 이 잡는다) */
function ruleFrom(src, fname) {
  const i = src.indexOf('function ' + fname);
  assert.ok(i > 0, `${fname} 이 없다 — 안내문구 판별이 통째로 사라졌다`);
  return src.slice(i, i + 900);
}

test('P0 ★두 곳의 «잣대»가 같은 신호를 본다 (미리보기 ⟷ 검색 어긋남 방지)', () => {
  const a = ruleFrom(CS, '_isPlaceholderText');
  const b = MAIN.slice(MAIN.indexOf('const _isPh ='), MAIN.indexOf('const _isPh =') + 700);
  for (const src of [a, b]) {
    assert.match(src, /data-placeholder/, '★홀더를 data-placeholder 로 안 찾는다');
    assert.match(src, /isPlaceholder === 'true'/, "★data-is-placeholder 표시를 안 본다");
    assert.match(src, /blank === 'true'/, '★의도적 빈 줄(data-blank)을 안 가른다');
  }
});

/** canvas-state.js 의 _isPlaceholderText 를 «그대로 떼어» 실행 가능한 함수로 만든다.
 *  ⛔문자열만 보면 로직이 뒤집혀도 초록이다 — 규칙은 «돌려서» 재야 한다.
 *  중괄호 균형으로 끝을 찾는다(정규식으로 자르면 안쪽 중괄호에서 끊긴다). */
function extractFn(src, name) {
  const head = src.indexOf('function ' + name);
  assert.ok(head > 0, `${name} 이 없다`);
  let i = src.indexOf('{', head), depth = 0;
  for (let k = i; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) {
      // eslint-disable-next-line no-new-func
      return new Function('return (' + src.slice(head, k + 1) + ')')();
    }
  }
  throw new Error(name + ' 의 끝을 못 찾았다');
}
/** DOM 흉내 — querySelectorAll 로 홀더를 주고, hasAttribute 는 없다고 답한다 */
const fakeEl2 = (holders) => ({ hasAttribute: () => false, querySelectorAll: () => holders });
const H2 = (isPh, blank, text) => ({ dataset: { isPlaceholder: isPh, blank }, innerText: text });

test('P1 ★규칙을 «돌려서» 잰다 — 진짜 글자가 하나라도 있으면 안내문구가 아니다', () => {
  const isPh = extractFn(CS, '_isPlaceholderText');

  // ⑴ 안내문구만 → true
  assert.equal(isPh(fakeEl2([H2('true', undefined, '소제목을 입력하세요')])), true,
    '★안내문구뿐인데 «본문»이라고 한다');

  // ⑵ ★진짜 글자가 «섞여» 있으면 false — 여기가 뒤집히면 사용자 원고가 「빈 칸」이 된다
  assert.equal(isPh(fakeEl2([H2('true', undefined, '소제목을 입력하세요'),
                             H2(undefined, undefined, '실제로 쓴 본문')])), false,
    '★★진짜 본문이 섞였는데 «빈 칸»이라고 한다 — 사용자 글이 검색·미리보기에서 사라진다');

  // ⑶ 의도적 빈 줄(data-blank)은 글자가 없다 → 안내문구로 본다
  assert.equal(isPh(fakeEl2([H2(undefined, 'true', '')])), true);

  // ⑷ 홀더가 아예 없으면 «판단하지 않는다»(false) — 모르면 본문으로 두는 쪽이 안전하다
  assert.equal(isPh(fakeEl2([])), false, '★모르는 것을 «빈 칸»으로 단정한다');

  // ⑸ 표시가 없고 글자만 있으면 본문
  assert.equal(isPh(fakeEl2([H2(undefined, undefined, '그냥 글')])), false);
});

test('P2 ★_firstMeaningful 이 안내문구를 «건너뛴다» — 빈 칸을 건너뛰는 것과 같은 이유', () => {
  const i = MCP.indexOf('function _firstMeaningful');
  const body = MCP.slice(i, MCP.indexOf('\n}\n', i));
  assert.match(body, /b\.placeholder === true/,
    '★블록의 placeholder 표시를 안 본다 — 「첫 의미 있는 블록」이 의미 없는 걸 집는다');
  assert.match(body, /summary.*placeholder === true/,
    '★프레임 요약의 placeholder 를 안 본다(텍스트는 summary 로 오는 경로가 있다)');
  assert.match(body, /type !== 'gap'/, '전제: 빈 칸 건너뛰기는 그대로 있어야 한다');
});

test('P3 ★_slimCanvasState 허용목록이 placeholder 를 «안 버린다»', () => {
  /* ⛔이 허용목록이 「렌더러가 새로 보내는 필드를 조용히 버린다」는 경고가 이미 코드에 있었는데
       내가 정확히 거기 걸렸다(2026-09-08). 그래서 «검사»로 못박는다. */
  const i = MCP.indexOf('function _slimCanvasState');
  const body = MCP.slice(i, i + 3000);
  assert.match(body, /if \(b\.placeholder === true\) o\.placeholder = true/,
    '★렌더러는 보내는데 여기서 버린다 — 밖에서 보면 빈 블록이 «다 쓴 것»이 된다');
});

test('P4 ★검색이 안내문구를 «매치한 뒤에» 센다 — 아니면 안내가 거짓말한다', () => {
  const i = MAIN.indexOf('if (_isPh(b)) { phSkipped++');
  assert.ok(i > 0, '★검색에 안내문구 거르기가 없다');
  const before = MAIN.slice(Math.max(0, i - 1200), i);
  /* 세는 자리가 «매치 판정 뒤»여야 한다 — 앞이면 질의와 무관한 블록까지 세고
     「N개가 매치했다」가 거짓이 된다(실측: '효과' → matches=0 인데 skipped=4 였다). */
  assert.match(before, /const i = norm\(raw\)\.indexOf\(needle\);/,
    '★매치 판정보다 «앞»에서 세고 있다 — 안내 문구가 사실과 달라진다');
  assert.match(before, /if \(i < 0\) continue;/, '전제: 매치 안 한 블록은 이미 걸러져야 한다');
});

test('P5 ★조용히 빼지 않는다 — 몇 개를 뺐는지·되찾는 법을 말한다', () => {
  assert.match(MAIN, /placeholderSkipped: phSkipped/, '★뺀 개수를 안 준다');
  assert.match(MAIN, /includePlaceholder:true/, '★되찾는 법을 안 알려준다');
  // 도구 계약에도 있어야 한다 — 응답에만 있으면 호출 «전»엔 모른다
  assert.match(MCP, /includePlaceholder: \{ type: 'boolean'/, '★스키마에 인자가 없다');
  assert.match(MCP, /placeholderSkipped/, '★도구 설명이 이 동작을 안 말한다');
});

test('P6 ⛔거르기는 «끌 수 있어야» 한다 — 「어디가 빈 칸인가」를 찾을 때가 있다', () => {
  const i = MAIN.indexOf('if (_isPh(b)) { phSkipped++');
  const line = MAIN.slice(i, i + 120);
  assert.match(line, /if \(!p\.includePlaceholder\) continue;/,
    '★includePlaceholder 를 줘도 계속 거른다 — 빈 칸을 영영 못 찾는다');
  // 배선이 끝까지 이어져 있나 (도구 → main → 렌더러)
  assert.match(MAIN, /includePlaceholder: !!includePlaceholder/, '★렌더러로 안 넘긴다');
  assert.match(MCP, /includePlaceholder: !!includePlaceholder/, '★도구가 main 으로 안 넘긴다');
});

test('P7 ★렌더러가 표시를 «실제로 붙인다» (읽기 경로 세 갈래 전부)', () => {
  assert.match(CS, /_isPlaceholderText\(block\) \? \{ placeholder: true \}/,
    '★텍스트 블록에 표시를 안 붙인다');
  assert.match(CS, /preview: t, placeholder: true/, '★프레임 미리보기에 표시를 안 붙인다');
  assert.match(CS, /text: t, placeholder: true/, '★전문(_fullContent) 경로에 표시를 안 붙인다');
});
