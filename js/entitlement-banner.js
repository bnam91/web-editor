/* ══════════════════════════════════════════════════════════════════════════
   entitlement-banner.js — 「곧 인터넷 연결이 필요해요」 예고 판정 (E3-b ㉯).
   ──────────────────────────────────────────────────────────────────────────
   ★왜 이게 있나 — pages/license.html 은 pass=false 일 때만 뜬다(main.js
     checkAuthAndLoad). ㉮ 발주 때 지디가 실측한 대로, 「아직 온라인이고 곧 잠길 사람」은
     license.html 을 볼 일이 «없다». 그 사람이 있는 곳은 projects.html(에디터) 뿐이다.
     ⇒ 이 판정은 license-screen.js 와 «다른 화면»을 위한 것이라 별도 파일로 둔다.

   ★★규율 — electron·DOM 의존 0, entitlement.js·main.js 가 계산한 값만 «옮겨 적는다».
     ⛔`exp` 를 이 파일에서 다시 파싱하지 않는다 — `auth:state.daysUntilSigStale`
       (services/entitlement.js `daysUntilSigStale`)가 이미 계산한 값을 그대로 쓴다.
       두 번째 판정이 생기면 갈라진다(§E3-b ㉮ 에서 실제로 있었던 사고와 같은 종류).

   ★★legacy_grace 는 배너 대상에서 «제외»한다(지디 결정 ⒜, 2026-09-06).
     이유: legacy_grace 는 서명이 «없어서» `daysUntilSigStale` 가 계산될 수가 없다
     (entitlement.js 의 daysUntilSigStale 은 서명이 없으면 null). 이 사람들의 실제
     마감은 exp 가 아니라 SIGLESS_GRACE_UNTIL(전역 고정일)이고, 온라인 한 번이면
     서명본으로 자동 교체돼 조용히 해소된다 — 겁줄 이유가 없다.
     ⇒ null 을 그대로 「배너 없음」으로 읽으면 «자동으로» 제외된다. 별도 분기 불필요.

   ★★원칙(지디, ㉮ 와 같다) — 예고는 «정보»지 «제한»이 아니다.
     이 모듈은 「보여줄까 말까」와 「문구」만 답한다. 창을 막거나, 입력을 가로채거나,
     사용자가 하던 일을 끊는 코드는 «이 파일에도, 이 파일을 쓰는 쪽에도» 없어야 한다.
     ⇒ 반환값에 dismiss 강제·모달·확인버튼 같은 개념이 «아예 없다» — 그냥 문구 하나.
═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = mod;
  if (typeof root !== 'undefined' && root) root.EntitlementBanner = mod;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /** 예고를 띄우는 창(일). exp−이 값부터 「아직 온라인일 때」 한 줄 — 지디 §E3-b ㉯. */
  var WARN_WINDOW_DAYS = 7;

  /**
   * @param {object|null} st  `electronAPI.getAuthState()`(main.js auth:state)의 반환값 그대로.
   * @returns {{days:number, text:string}|null} null = 배너 안 띄움.
   */
  function decideExpiryBanner(st) {
    if (!st) return null;
    /* ★status 를 «명시적으로» 본다 — 「daysUntilSigStale 이 0~7이면 무조건」으로 넓히면
       우연히 그 범위에 들어오는 다른 cls(있다면)까지 새로 걸릴 수 있다. §E3-b ㉮ 의
       교훈: 우연에 기대지 말고 «의도한 상태»만 명시적으로 고른다. */
    if (st.status !== 'signature_ok') return null;
    var d = st.daysUntilSigStale;
    if (!Number.isFinite(d)) return null;          // legacy_grace 등 — 계산 근거 자체가 없다
    if (d < 0 || d > WARN_WINDOW_DAYS) return null; // 창 밖 — 이미 지났거나(다른 화면 몫) 아직 멀었다
    return { days: d, text: bannerText(d) };
  }

  function bannerText(days) {
    /* ★지디 예시 문구를 그대로 따른다: 「곧 인터넷 연결이 한 번 필요해요」.
       ⛔「잠깁니다」·「막힙니다」류 낱말을 안 쓴다 — 예고는 «정보»지 «위협」이 아니다. */
    if (days <= 0) return '곧 인터넷 연결이 한 번 필요해요. 지금 연결돼 있다면 자동으로 확인돼요.';
    return '곧 인터넷 연결이 한 번 필요해요 (' + days + '일 후). 온라인 상태면 자동으로 확인돼요.';
  }

  return {
    WARN_WINDOW_DAYS: WARN_WINDOW_DAYS,
    decideExpiryBanner: decideExpiryBanner,
  };
});
