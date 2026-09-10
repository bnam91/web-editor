/* variation-write.test.js — A/B 베리에이션 «쓰기» (2026-09-08 현빈 지시)
 *
 * 읽기는 variation-visible.test.js 가 지킨다. 이건 그 짝 — 만들기·늘리기·바꾸기·확정·지우기.
 *
 * ★설계에서 지킨 것
 *   ⑴ 렌더러에 «이미 있는» 함수를 부른다(createVariation 등) — 흉내내면 배지·바인딩이 빠진 «반쪽 시안»이 된다
 *   ⑵ 판정은 «효과»로 — 부른 뒤 DOM 을 다시 세어 답한다(rc 를 안 믿는다)
 *   ⑶ 되돌리기 어려운 것(resolve·delete)은 confirm 없이는 «안 하고», 무엇이 지워지는지 «먼저 말한다»
 *   ⑷ 상한(5) 초과를 «조용히 무시»하지 않는다 — 렌더러는 그렇게 한다. 그건 「했다」로 읽힌다
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const MAIN = fs.readFileSync(path.join(ROOT, 'main.js'), 'utf8');
const MCP  = fs.readFileSync(path.join(ROOT, 'main', 'claude-pm', 'mcp-server.js'), 'utf8');
const VAR  = fs.readFileSync(path.join(ROOT, 'js', 'section-variation.js'), 'utf8');

const BRIDGE = (() => {
  const i = MAIN.indexOf('async function _invokeRendererVariation');
  assert.ok(i > 0, '★렌더러 다리(_invokeRendererVariation)가 없다');
  return MAIN.slice(i, MAIN.indexOf('\nasync function _invokeRendererSearchSections', i));
})();

test('W1 ★렌더러 함수를 «부른다» — DOM 을 직접 흉내내지 않는다', () => {
  /* 흉내내면 배지·클릭바인딩·히스토리가 빠진 «반쪽 시안»이 생긴다.
     ⇒ 렌더러가 가진 셋은 반드시 그것을 부른다. */
  for (const fn of ['createVariation', 'addVariation', 'toggleVariation', 'resolveVariation']) {
    assert.match(VAR, new RegExp(`function ${fn}\\(`), `전제: 렌더러에 ${fn} 이 있어야 한다`);
    assert.match(BRIDGE, new RegExp(`window\\.${fn}\\(`), `★${fn} 을 안 부르고 직접 만든다`);
  }
});

test('W2 ★상한(A~E 5개)을 «조용히» 넘기지 않는다 — 렌더러는 그냥 무시한다', () => {
  assert.match(VAR, /if \(all\.length >= VARIATION_LABELS\.length\) return;/,
    '전제: 렌더러가 상한 초과를 «조용히 return» 한다(그래서 우리가 말해야 한다)');
  assert.match(BRIDGE, /VARIATION_LIMIT/,
    '★상한을 넘었을 때 «넘었다고» 안 말한다 — 호출자는 「됐다」로 읽는다');
});

test('W3 ⛔되돌리기 어려운 둘은 confirm 없이 «안 한다» — 그리고 먼저 말한다', () => {
  const resolve = BRIDGE.slice(BRIDGE.indexOf("p.op === 'resolve'"), BRIDGE.indexOf("p.op === 'delete'"));
  assert.match(resolve, /if \(!p\.confirm\)/, '★resolve 가 confirm 없이 실행된다');
  assert.match(resolve, /willDelete/, '★무엇이 «지워질지»를 안 알려준다 — 알고 누르게 해야 한다');
  const del = BRIDGE.slice(BRIDGE.indexOf("p.op === 'delete'"));
  assert.match(del, /if \(!p\.confirm\)/, '★delete 가 confirm 없이 실행된다');
});

test('W4 ★판정을 «효과»로 한다 — 부르고 나서 다시 센다', () => {
  assert.match(BRIDGE, /NOEFFECT/,
    '★함수를 «불렀다»로 성공을 답한다 — 이 앱은 «거짓 성공» 전력이 있다');
  /* ⚠️첫 판은 switch «구간 안»에서 getComputedStyle 을 찾다가 빨개졌다 — 동작은 맞는데 «재는 자리»가 틀렸다.
       visible 은 공용 snap() 이 만들고 switch 가 그걸 쓴다. ⇒ 「어디서 만드나」와 「누가 쓰나」를 나눠 잰다. */
  assert.match(BRIDGE, /visible: getComputedStyle\(x\)\.display !== 'none'/,
    '★«화면에 보이나»를 아예 안 잰다 — active 표시만 바뀌고 화면이 그대로면 사용자에겐 아무 일도 없다');
  const sw = BRIDGE.slice(BRIDGE.indexOf("p.op === 'switch'"), BRIDGE.indexOf("p.op === 'resolve'"));
  assert.match(sw, /visible: shown/,
    '★switch 가 «무엇이 보이는지»를 답에 안 싣는다 — 호출자가 화면 상태를 못 본다');
});

test('W5 ★switch 는 «지목»이다 — 렌더러 toggle 은 「다음 안으로」뿐이다', () => {
  assert.match(VAR, /const nextIdx = \(activeIdx \+ 1\) % all\.length;/,
    '전제: 렌더러 toggle 이 «순환»이라 지목이 안 된다');
  const sw = BRIDGE.slice(BRIDGE.indexOf("p.op === 'switch'"), BRIDGE.indexOf("p.op === 'resolve'"));
  assert.match(sw, /for \(let i = 0; i < before\.length \+ 1; i\+\+\)/,
    '★원하는 안이 나올 때까지 «돌리되 상한»이 있어야 한다 — 없으면 무한루프다');
  assert.match(sw, /NO_SUCH_VARIATION/, '★없는 안을 지목하면 그렇게 말해야 한다');
});

test('W6 ★하나만 남으면 «묶음을 해체»한다 — 더는 시안이 아니다', () => {
  const del = BRIDGE.slice(BRIDGE.indexOf("p.op === 'delete'"));
  /* ⛔첫 판은 `rest.length === 1` «문자열»만 봤다 — 변이 L4(`if (false) {` 로 바꾸기)가 «살아남았다».
       조건이 죽어도 그 아래 블록의 글자는 그대로라서다.
     ⇒ 「조건이 «살아 있나»」를 본다: if 문 안에 그 비교가 «실제로» 들어 있는지. */
  assert.match(del, /if \(rest\.length === 1\) \{/,
    '★해체 조건이 «죽었다» — 마지막 하나가 남아도 A/B 표시를 달고 있게 된다');
  assert.ok(!/if \(false\)/.test(del), '★분기가 상수로 죽어 있다');
  assert.match(del, /delete one\.dataset\.variationGroup/, '★묶음 표시를 안 뗀다');
  assert.match(del, /variation-badge.*remove|remove\(\)/s, '★배지를 안 뗀다');
  assert.match(del, /one\.style\.display = ''/,
    "★display:none 인 채로 해체하면 «섹션이 사라진 것»처럼 보인다");
  assert.match(del, /LAST_VARIATION/, '★남은 게 하나뿐인데 지우려 하면 거절해야 한다');
});

test('W7 ★지운 것이 «보이던 안»이면 다른 안을 보이게 한다 — 아니면 자리가 빈다', () => {
  const del = BRIDGE.slice(BRIDGE.indexOf("p.op === 'delete'"));
  assert.match(del, /wasActive/, '★보이던 안을 지웠는지 안 본다');
  assert.match(del, /variationActive = i === 0 \? '1' : '0'/,
    '★보이던 안을 지운 뒤 아무도 안 보이게 된다 — 섹션 자리가 통째로 빈다');
});

test('W8 ★도구 계약이 «대안이지 중복이 아니다»를 말한다', () => {
  const i = MCP.indexOf("'edit_variation'");
  assert.ok(i > 0, '★edit_variation 이 등록돼 있지 않다');
  const d = MCP.slice(i, i + 2600);
  assert.match(d, /ALTERNATIVES, never duplicates/,
    '★「대안이지 중복이 아니다」를 안 말한다 — 그걸 모르면 하나를 «정리»한다');
  assert.match(d, /VARIATION_LIMIT/, '★상한 동작을 설명이 안 말한다');
  assert.match(d, /requires confirm:true/, '★확정·삭제가 confirm 을 요구한다는 걸 안 말한다');
  assert.match(d, /enum: \['create', 'add', 'switch', 'resolve', 'delete'\]/, '★op 목록이 계약에 없다');
});
