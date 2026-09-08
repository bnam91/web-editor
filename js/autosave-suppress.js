/* ═══════════════════════════════════════════════════════════════════════════
   autosave-suppress.js — 자동저장 «억제 창»을 손으로 켜고 끄지 않게 하는 구조. (H6)
   ───────────────────────────────────────────────────────────────────────────
   ★왜 있나
     `state._suppressAutoSave` 가 true 로 «남으면» 자동저장이 조용히 멈춘다.
     오류도 안 나고 표시도 없다 — 앱은 멀쩡히 돌고, 사용자는 계속 편집하고,
     아무것도 저장되지 않는다. 대가를 사용자가 «작업물»로 치른다.
     켜는 줄과 끄는 줄이 «다르면» 그 사이의 예외 하나로 그 일이 난다.

   ★왜 「try/finally { = false }」가 정답이 아닌가
     (정본 = version-history-ui.js:385~410 의 주석. 실 Chromium 대조실험으로 확인된 것)
     ⑴ 억제 창은 «중첩»된다. false 로 되돌리면 남이 켜 둔 창(탭 전환·프로젝트 로드·
        collab 패치·드래그)을 «내가 중간에서» 꺼버린다.
     ⑵ «동기» 해제도 틀릴 수 있다. MutationObserver 는 microtask 뒤에 발화하므로
        applyProjectData 는 rAF 로 «한 프레임 뒤»에 푼다(io/save-load.js:533).
        동기로 닫으면 관측자가 억제 꺼진 상태로 발화해 자동저장을 예약한다.

   ★왜 「이전값 복원」이 아니라 «깊이 세기»인가
     이전값(prevSuppress) 복원은 «해제 순서»가 뒤바뀌면 영구 고착을 만든다.
     그리고 이 레포엔 실제로 그런 자리가 있다 — 바깥은 «동기»로 닫고
     안쪽(applyProjectData)은 «rAF» 로 닫는다. 그때:
        바깥이 먼저 false 로 되돌리고 → 뒤늦게 깨어난 안쪽이 「이전값=true」를 복원 → 고착.
     깊이는 «순서와 무관»하다. 마지막으로 나가는 자가 끈다.

   ★raw 대입과 «같이 산다»
     아직 직접 대입하는 자리가 넷 남아 있다(전부 의도적 — 목록과 «이유»는
     tests/unit/autosave-suppress.test.js 의 허용목록이 기계로 고정한다).
     그래서 깊이 0→1 로 들어갈 때 «남이 켜 둔 값»을 적어 두고, 마지막에 false 가 아니라
     그 값으로 되돌린다. 그래야 남의 억제를 안 깬다.

   ⛔감시견은 «알리기만» 한다. 억제를 자동으로 풀지 않는다 —
     남의 정당한 억제 창을 깨는 게 고착보다 더 큰 결함이다.

   ★고전 스크립트다(모듈 아님). report-buffer.js 와 같은 꼴 —
     모듈(import)·고전 스크립트가 «둘 다» 써야 하고, 검사가 DOM 없이 얹어 돌려야 한다.
═══════════════════════════════════════════════════════════════════════════ */
(function (w) {
  'use strict';

  /* 열려 있는 억제 창의 수. 0 이 되는 «그때만» 끈다. */
  var depth = 0;
  /* 깊이 0→1 때 «남이(raw 대입이)» 켜 두고 있던 값. 마지막에 이 값으로 되돌린다. */
  var outerPrev = false;
  /* 열려 있는 토큰들 — 감시견이 «누가 쥐고 있나»를 말하기 위해서만 쓴다. */
  var open = [];

  /* ★state 는 «부를 때» 찾는다. 이 파일은 globals.js 보다 먼저 실행되고(고전 스크립트),
     검사는 아예 DOM 없이 얹는다 — 로드 시점에 굳히면 둘 다 깨진다. */
  function st() { try { return w.state || null; } catch (_) { return null; } }
  function readFlag() { var s = st(); return !!(s && s._suppressAutoSave === true); }
  function writeFlag(v) { var s = st(); if (s) s._suppressAutoSave = v; }

  /** 억제 창을 «연다». 반환한 토큰을 반드시 end 에 넘겨라(try/finally). */
  function begin(reason, opts) {
    if (depth === 0) outerPrev = readFlag();
    depth++;
    writeFlag(true);
    var tok = {
      reason: String((reason == null ? '' : reason) || 'unknown'),
      longLived: !!(opts && opts.longLived), at: Date.now(), released: false,
    };
    open.push(tok);
    return tok;
  }

  /** 억제 창을 «닫는다».
   *  ★두 번 불러도 안전하고, 안 연 채 불러도 아무 일 없다 —
   *    드래그 종료는 dragend 가 캡처·버블 양쪽에서 와 «두 번» 불린다. 그때 깊이가
   *    두 번 깎이면 «남의 창»이 조용히 닫힌다. 토큰이 그걸 막는다. */
  function end(tok) {
    if (!tok || tok.released) return false;
    tok.released = true;
    var i = open.indexOf(tok); if (i >= 0) open.splice(i, 1);
    if (depth > 0) depth--;
    if (depth === 0) writeFlag(outerPrev);
    return true;
  }

  /* ★★안전망 시간 — «타이머가 이기는 유일한 경우 = 창이 가려진 때»에만 쓰인다.
       보이는 창에선 rAF(~16ms)가 늘 먼저 오고, 토큰은 «한 번만» 닫히므로 타이머는 아무 일도 안 한다.
       ⇒ 가려진 창에서 250ms 는 아무 의미가 없다(어차피 사람이 안 보고 있다).
       ⛔숫자만 남기면 다음 사람이 「왜 250?」 하고 줄이거나 늘린다 — 이 문장이 그 답이다.
       (같은 계열의 선례: io/save-load.js 의 _AUTOSAVE_DEFER_MAX_MS = 30000) */
  var NEXT_FRAME_FALLBACK_MS = 250;

  /** «한 프레임 뒤» 해제 — MutationObserver 의 잔여 mutation 까지 흡수해야 하는 자리용.
   *
   * ⛔★2026-09-09 실측 사고: 여기 `else setTimeout` 은 «rAF 가 없을 때» 폴백이지
   *   «rAF 가 안 돌 때» 안전망이 아니었다. 브라우저는 창이 «가려지면»(visibilityState:'hidden')
   *   rAF 를 «갖고 있지만 안 돌린다» — 그래서 else 가지가 «영영» 안 탄다.
   *   실측: hidden 창에서 3초를 기다려도 rAF 0회 · 억제가 true 로 고착.
   *   ⇒ 이 파일 머리가 경고하는 그 일이 그대로 났다:
   *     「자동저장이 조용히 멈춘다 … 대가를 사용자가 «작업물»로 치른다」
   * ⇒ 폴백이 아니라 «둘 다» 건다. 먼저 오는 쪽이 닫고, 토큰은 released 로 한 번만 닫힌다.
   *   ★이 계열의 «뿌리»라 여기서 막는다 — js/history.js:105·230 · js/collab/sync.js:418 에도
   *     같은 모양(rAF 단독 해제)이 남아 있다. 그쪽은 이 함수를 쓰게 바꾸는 게 정답이다.
   *     ⇒ 티켓 = `_context/BACKLOG-autosave-raf-only.md` (「다 고쳤을 때 무엇을 지우나」까지 적혀 있다)
   *     ⇒ 집행 = `tests/unit/autosave-overlap.test.js` N6 — 이 셋이 늘어도 줄어도 빨개진다. */
  function endNextFrame(tok) {
    var done = function () { end(tok); };
    if (typeof w.requestAnimationFrame === 'function') w.requestAnimationFrame(done);
    setTimeout(done, NEXT_FRAME_FALLBACK_MS);
  }

  /** 동기 구간을 감싼다 — 예외가 나도 창은 닫히고, 예외는 «그대로 전파»된다. */
  function wrap(reason, fn) {
    var tok = begin(reason);
    try { return fn(); } finally { end(tok); }
  }

  /** async 구간을 감싼다 — reject 돼도 창은 닫히고, 거부는 «그대로 전파»된다. */
  function wrapAsync(reason, fn) {
    var tok = begin(reason);
    return Promise.resolve().then(fn).then(
      function (v) { end(tok); return v; },
      function (e) { end(tok); throw e; }
    );
  }

  /* ═══ 감시견 — 「못 고치면 최소한 «들키게»」 ═══════════════════════════
     새 사용처가 생겨도 고착은 «어딘가 남는다». ⛔풀지는 않는다. */
  var STUCK_MS = 30000;        // 보통 창
  var STUCK_LONG_MS = 300000;  // 드래그처럼 «사람 손»이 쥐고 있는 창

  var trueSince = null;   // 플래그가 «연속으로» true 였던 시작 시각
  var reported = false;   // 이 에피소드는 이미 한 번 알렸다

  /** 순수 판정 — 시각을 받아 「알릴 것인가」와 근거를 돌려준다.
   *  ⛔여기서 억제 플래그를 «쓰지» 않는다(읽기만). 검사가 시계 없이 이 함수를 직접 잰다. */
  function evaluateStuck(now) {
    if (now == null) now = Date.now();
    if (!readFlag()) { trueSince = null; reported = false; return { on: false, report: null }; }
    if (trueSince == null) trueSince = now;
    var heldMs = now - trueSince;
    var holders = open.map(function (t) { return t.reason; });
    var anyLong = open.some(function (t) { return t.longLived; });
    var limit = anyLong ? STUCK_LONG_MS : STUCK_MS;
    var base = { on: true, heldMs: heldMs, limit: limit, depth: depth, holders: holders };
    if (reported || heldMs < limit) { base.report = null; return base; }
    reported = true;
    /* ★depth 0 인데 켜져 있다 = 허용목록의 raw 대입이 쥐고 있다.
       그 둘을 «가른» 문장을 남겨야 읽는 사람이 다음에 어디를 볼지 안다. */
    base.report = '[H6] 자동저장 억제가 ' + Math.round(heldMs / 1000) + '초째 켜져 있다 — '
      + (depth > 0
        ? '열린 창 ' + depth + '개(' + holders.join(', ') + ')'
        : '★열린 창이 «없는데» 켜져 있다 — 직접 대입 쪽(applyProjectData·collab·history·버전복원)')
      + '. 이 동안의 편집은 디스크에 안 남는다. ⛔이 알림은 억제를 풀지 않는다.';
    return base;
  }

  var timer = null;
  function startWatch(intervalMs) {
    if (timer) return null;
    timer = setInterval(function () {
      var r; try { r = evaluateStuck(); } catch (_) { return; }
      if (!r || !r.report) return;
      try { if (w.ReportBuffer && w.ReportBuffer.note) w.ReportBuffer.note(r.report); } catch (_) {}
      try { console.warn(r.report); } catch (_) {}
    }, intervalMs || 5000);
    return timer;
  }
  function stopWatch() { if (timer) { clearInterval(timer); timer = null; } }

  /** 관측용 — 하네스·검사가 「지금 누가 쥐고 있나」를 읽는다. ⛔읽기만. */
  function inspect() {
    var now = Date.now();
    return {
      flag: readFlag(), depth: depth, outerPrev: outerPrev,
      holders: open.map(function (t) { return { reason: t.reason, longLived: t.longLived, heldMs: now - t.at }; }),
      trueSinceMs: trueSince == null ? null : now - trueSince,
    };
  }

  /** ⛔검사 전용 — 카운터를 처음 상태로. 제품 코드에서 부르지 마라. */
  function resetForTest() {
    depth = 0; outerPrev = false; open.length = 0; trueSince = null; reported = false;
    writeFlag(false);
  }

  w.AutoSaveSuppress = {
    begin: begin, end: end, endNextFrame: endNextFrame, wrap: wrap, wrapAsync: wrapAsync,
    evaluateStuck: evaluateStuck, inspect: inspect,
    startWatch: startWatch, stopWatch: stopWatch, __resetForTest: resetForTest,
    STUCK_MS: STUCK_MS, STUCK_LONG_MS: STUCK_LONG_MS,
  };
  /* 자주 쓰는 셋은 짧은 이름으로도 — 부르는 자리를 읽기 좋게. */
  w.suppressAutoSave = wrap;
  w.suppressAutoSaveAsync = wrapAsync;
  w.__autoSaveSuppressState = inspect;

  if (typeof w.document !== 'undefined' && typeof setInterval === 'function') startWatch();
})(typeof window !== 'undefined' ? window : globalThis);
