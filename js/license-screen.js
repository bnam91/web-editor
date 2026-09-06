/* ══════════════════════════════════════════════════════════════════════════
   license-screen.js — pages/license.html 의 «어느 화면을 보여줄지» 순수 판정.
   ──────────────────────────────────────────────────────────────────────────
   ★왜 따로 뺐나 — license.html 인라인 <script> 안에 있으면 「어느 분기가 어느 문구를
     쓰는가」를 단위검사로 못 잰다(DOM·IPC 를 다 흉내내야 하니까). 이 파일은 electron·DOM
     의존 0 이라 `tests/unit/license-screen.test.mjs` 가 «진짜 이 파일»을 vm 으로 돌려 잰다
     (report-buffer.js 검사와 같은 방식 — U-GLOGIN-0 규약: 하네스가 원본을 그대로 실행한다).

   ★★이 파일의 규율 — 지디 발주서 §E3 ㉮:
     「만료」(access_ended·구독이 «진짜로» 끝남)와 「연결 필요」(offline·clock_rollback·
     generic — 서명을 «아직 확인 못 했을 뿐», 구독은 살아 있을 수 있다)는 «절대 같은 문구를
     쓰지 않는다». 그래서 이 파일 안에 두 사전을 나눠 두고, 검사가 겹치는 낱말이 있으면
     빨개지게 만든다(EXPIRY_WORDS 배열). ⛔License.html 은 이 사전을 «그대로» 쓴다 —
     화면이 자기 문구를 새로 짓지 않는다(두 벌이 되는 사고를 막는다).

   ★services/entitlement.js(E1)·main.js(E2) 가 실제로 돌려주는 문자열(cls/status/reason)을
     «그대로» 입력으로 받는다. 여기서 새로 판정하지 않는다 — «옮겨 적기»만 한다.
═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = mod;
  if (typeof root !== 'undefined' && root) root.LicenseScreen = mod;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';

  /* ── 화면 3분류 ────────────────────────────────────────────────────────
   * 입력 = `electronAPI.getAuthState()`(main.js `auth:state`)의 반환값 그대로.
   * ★함정: `pending==='verify'` 인 기록도 `expired` 가 «같이» true 다
   *   (main.js:617 `expired: !!auth && !v.pass` — pass=false 면 무조건 true).
   *   ⇒ **pending 을 먼저 본다.** 순서를 바꾸면 「연결만 하면 되는」 사람이
   *   「만료됐다」 화면을 보게 된다 — 이 파일이 막으려는 바로 그 사고다.
   */
  function decideInitialScreen(st) {
    if (!st) return 'login';
    if (st.pending === 'verify') return 'verify';
    if (st.expired) return 'expired';
    return 'login';
  }

  /* ── auth:refresh 응답 → 「확인 필요」 화면의 하위 갈래 ──────────────────
   * 입력 = `electronAPI.refreshAuth()`(main.js `auth:refresh`)의 반환값.
   * ★반환값이 없거나(throw) reason 이 없으면 «오프라인과 같이» 다룬다 —
   *   말을 못 들은 것과 안 온 것을 구분할 방법이 렌더러엔 없다.
   */
  function decideVerifyOutcome(result) {
    if (result && result.ok === true) return 'ok';
    if (!result) return 'offline';
    var reason = result.reason;
    if (reason === 'offline') return 'offline';
    // 서버가 «세션이 죽었다»고 명시적으로 답한 경우만 로그인 화면으로 — 이건 사실이라 재로그인이 맞다.
    if (reason === 'invalid_session' || reason === 'email_not_verified') return 'session_cleared';
    // ★진짜 만료 — 서버가 서명한 사실이다(access_ended/access_unparsable, 계획서 §3-1 L5).
    if (reason === 'access_ended' || reason === 'access_unparsable' || result.status === 'access_ended') return 'expired';
    if (reason === 'clock_rollback') return 'clock_rollback';
    // sigless_needs_verify / sid_mismatch_needs_verify / signature_invalid / sub_mismatch /
    // grace_exceeded 등 — 서버에 물었지만 여전히 못 살린 나머지 전부. 「만료」가 «아니다».
    return 'generic';
  }

  /* ── 남은 기간 표시 종류 ────────────────────────────────────────────────
   * ★accessUntil === null(무기한)을 «끝났다»로 읽으면 무기한 사용자를 잠근다(§3-1 L5 주석).
   *   auth:state 는 무기한을 `accessUntil:''` + `perpetual:true` 로 따로 준다 — 그대로 따른다.
   *
   * ★★E3-b ㉮ — «검증되지 않은 값을 사용자에게 사실로 읽어 주지 마라»(지디 실측, E4 재현):
   *   main.js `auth:state` 는 평문 `accessUntil`/`perpetual` 을 **검증 여부와 무관하게**
   *   그대로 내보낸다(`userData/auth.json` 의 사용자가 고칠 수 있는 필드가 출처다). 서명이
   *   없거나(`status==='signature_missing'`) 서명이 안 맞으면(`status==='signature_invalid'`,
   *   sig_invalid·sub_mismatch 공용) 그 값은 «누구나 2099 로 고칠 수 있는 숫자」다 — 화면이
   *   그 숫자를 「구독은 2099년까지 남아 있음」으로 «사실»처럼 읽어 주면 안 된다.
   *   ⇒ 이 두 status 에서는 accessUntil·perpetual 둘 다 «안 보여준다»('unverified').
   *
   *   ⛔이건 «잠금(pass/reject)」을 바꾸는 게 아니다 — 판정은 여전히 classify/resolveAuth
   *   «한 곳»의 몫이고, 여기는 «표시만» 죽인다. ★sig_missing 은 «거부»가 아니라 «재질의»다
   *   (E4 실측: signed 삭제 → 오프라인 pending:verify → 온라인 auth:refresh 로 재수령 →
   *   정상 진입) — 그러니 이 화면이 「막혔다」로 과장해서도 안 된다(VERIFY_COPY 가 이미
   *   그렇게 갈라 놨다). 여기서 하는 일은 «기간 문구 하나»를 안 내보내는 것뿐이다.
   *
   *   ★clock_rollback(`status:'locked'`)·grace_exceeded/exp_in_grace(`status:'sig_expired'`)
   *   는 «서명 검증을 이미 통과한»(payload 가 있는) 상태다(entitlement.js classify L4·L6·L7
   *   — 전부 v.ok===true 뒤에만 도달) — 이 accessUntil 은 서명이 뒷받침하는 «사실»이라
   *   그대로 보여준다. 두 status 문자열만 보고 «뭉뚱그려» 다 가리면 진짜 정보까지 죽는다. */
  var UNVERIFIED_STATUSES = ['signature_missing', 'signature_invalid'];

  function remainingKind(st) {
    if (!st) return 'unknown';
    if (UNVERIFIED_STATUSES.indexOf(st.status) !== -1) return 'unverified';
    if (st.perpetual) return 'perpetual';
    if (st.accessUntil) return 'until';
    return 'unknown';
  }

  /* ── 문구 사전 — «만료」와 «연결 필요」가 이 사전 «하나»에서 갈라진다 ──────
   * ⛔VERIFY_COPY 의 어떤 항목도 「끝났다/만료/종료」류 낱말을 쓰지 않는다.
   *   (checking·ok 는 결과를 아직/이미 안 상태라 이 검사에서 뺀다 — «실패를 설명하는»
   *    offline·clock_rollback·generic 셋이 실제로 위험한 자리다.) */
  var VERIFY_COPY = {
    checking: {
      title: '확인하는 중…',
      desc: '로그인 상태를 확인하고 있어요. 잠시만 기다려 주세요.',
    },
    ok: {
      title: '확인됐습니다',
      desc: '',
    },
    offline: {
      title: '인터넷 연결이 필요해요',
      desc: '인터넷에 한 번 연결해 주세요. 연결하면 바로 이어서 쓸 수 있어요.',
    },
    clock_rollback: {
      title: '기기 시계를 확인해 주세요',
      desc: '이 기기의 시계가 실제보다 과거로 맞춰져 있어요. 시계를 맞춘 뒤 인터넷에 연결하면 확인돼요.',
    },
    generic: {
      title: '확인할 수 없어요',
      desc: '일시적인 문제로 로그인 상태를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
    },
  };

  var EXPIRED_COPY = {
    title: '이용 기간이 끝났습니다',
    desc: '구독 기간이 끝났습니다. 계속 사용하시려면 요금제를 확인해 주세요.',
  };

  /* 「연결 필요」 사전에 «만료 낱말»이 섞이면 안 된다 — 검사(license-screen.test.mjs)가
     이 배열로 각 VERIFY_COPY 항목을 훑는다. 여기 낱말을 늘리면 검사도 같이 세진다. */
  var EXPIRY_WORDS = ['만료', '종료', '끝났', '끝남'];

  return {
    decideInitialScreen: decideInitialScreen,
    decideVerifyOutcome: decideVerifyOutcome,
    remainingKind: remainingKind,
    UNVERIFIED_STATUSES: UNVERIFIED_STATUSES,
    VERIFY_COPY: VERIFY_COPY,
    EXPIRED_COPY: EXPIRED_COPY,
    EXPIRY_WORDS: EXPIRY_WORDS,
  };
});
