/* section-memo-format.js — 섹션 메모 «평문 ↔ 토큰» 변환의 단 하나의 자리 (1012t1A1)
 *
 * 저장 포맷은 종전 그대로 «평문»이다(.section-block 의 data-memo). 그 평문 위에 표식만 얹는다.
 *   `[ ]`  미체크 체크박스
 *   `[x]`  체크된 체크박스 (`[X]` 도 읽는다 — 손대지 않으면 `[X]` 그대로 다시 쓴다)
 * 옛 버전에서는 그 표식이 글자로 보일 뿐이다(깨지지 않는다).
 * ⛔`[]`(사이 공백 없음)은 표식이 «아니다» — 저장된 `[]` 는 글자다. `[]` 를 체크박스로 바꾸는 것은
 *   «치는 순간»의 일이고(checkTrigger), 그 결과가 `[ ]` 로 저장된다.
 *
 * 토큰 꼴:
 *   { type:'text',  text }            줄바꿈을 품지 않는 글자 토막
 *   { type:'br' }                     줄바꿈 하나(\n)
 *   { type:'check', checked, raw }    raw = 읽은 그대로의 3글자(직접 만든 토큰은 생략 가능)
 * ★새 표식(예: 이미지)은 RULES 에 한 칸, serializeTokens 에 한 갈래를 더하면 된다.
 *
 * ★순수 함수만 둔다(DOM 무접촉) — node 단위검사가 «같은 함수»를 잰다.
 * ★classic script 다(모듈 아님). index.html 이 js/section-memo.js «앞»에 싣는다.
 * 기계 검사: tests/unit/section-memo-format.test.mjs · tests/dom/section-memo-rich.dom.spec.js
 */
(function (root) {
  'use strict';

  var CHECK_OFF = '[ ]';
  var CHECK_ON = '[x]';

  /* 표식 규칙 — re 는 반드시 g 플래그. make 는 exec 결과 → 토큰. */
  var RULES = [
    { re: /\[([ xX])\]/g,
      make: function (m) { return { type: 'check', checked: m[1] !== ' ', raw: m[0] }; } },
    { re: /\n/g,
      make: function () { return { type: 'br' }; } },
  ];

  function tokenizeMemo(memo) {
    var s = memo == null ? '' : String(memo);
    var out = [];
    var pos = 0;
    while (pos < s.length) {
      var best = null;
      var bestRule = null;
      for (var i = 0; i < RULES.length; i++) {
        var re = RULES[i].re;
        re.lastIndex = pos;
        var m = re.exec(s);
        if (m && (!best || m.index < best.index)) { best = m; bestRule = RULES[i]; }
      }
      if (!best) break;
      if (best.index > pos) out.push({ type: 'text', text: s.slice(pos, best.index) });
      out.push(bestRule.make(best));
      pos = best.index + best[0].length;
    }
    if (pos < s.length) out.push({ type: 'text', text: s.slice(pos) });
    return out;
  }

  function serializeTokens(tokens) {
    var s = '';
    for (var i = 0; i < (tokens ? tokens.length : 0); i++) {
      var t = tokens[i];
      if (!t) continue;
      if (t.type === 'text') s += (t.text == null ? '' : String(t.text));
      else if (t.type === 'br') s += '\n';
      else if (t.type === 'check') {
        /* raw 는 «체크 상태가 그대로일 때만» 믿는다 — 뒤집힌 뒤에는 정본 글자로 쓴다 */
        var rawOk = typeof t.raw === 'string' && /^\[[ xX]\]$/.test(t.raw) && ((t.raw !== CHECK_OFF) === !!t.checked);
        s += rawOk ? t.raw : (t.checked ? CHECK_ON : CHECK_OFF);
      }
    }
    return s;
  }

  /* 캐럿 «앞» 글자가 체크박스 방아쇠로 끝나는가 — `[]` `[ ]` `[x]` `[X]`.
     돌려주는 값: null 또는 { len: 바꿀 글자 수, checked } */
  function checkTrigger(textBeforeCaret) {
    var s = textBeforeCaret == null ? '' : String(textBeforeCaret);
    var m = /\[([ xX]?)\]$/.exec(s);
    if (!m) return null;
    return { len: m[0].length, checked: m[1] === 'x' || m[1] === 'X' };
  }
  function checkTriggerLen(textBeforeCaret) {
    var t = checkTrigger(textBeforeCaret);
    return t ? t.len : 0;
  }

  /* 한도는 «코드포인트»로 센다(js/section-memo.js 의 setSectionMemo 와 같은 자) */
  function memoLength(memo) {
    return Array.from(memo == null ? '' : String(memo)).length;
  }

  var api = {
    tokenizeMemo: tokenizeMemo,
    serializeTokens: serializeTokens,
    checkTrigger: checkTrigger,
    checkTriggerLen: checkTriggerLen,
    memoLength: memoLength,
    CHECK_OFF: CHECK_OFF,
    CHECK_ON: CHECK_ON,
  };
  root.SectionMemoFormat = api;
  /* node 단위검사도 «같은 함수»를 재게 한다 */
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
