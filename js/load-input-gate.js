/* 로드 중 입력 막기 (시트 363 · 현빈 결정 2026-11-03)
 * 왜: 로드 중 캔버스는 곧 교체된다. 그 사이 넣은 것은 화면에도 파일에도 안 남고 말도 없다(앱 실측 9/9 · 창 30MB 3s · 80MB 8~10s).
 * 기준 = 로드 시작(begin)부터 «확정 + autosave 무장»까지(isProjectReady 와 같은 두 칸). 첫 해제 뒤엔 다시 안 잠근다 —
 *   무장 칸은 끌기·되돌리기 때도 잠깐 꺼지므로, 잠금을 그 값에 바로 걸면 사람의 끌기를 끊는다.
 *   ⛔URL·활성 칸은 안 본다: 어긋나면 영영 안 풀린다(대기는 새 begin 이 맡는다).
 * 안 막는 것: 탭 전환·홈·새 탭(PASS · 탭 이름 편집은 막는다) · 스크롤(휠은 안 건드리고, 스크롤 키는 기본 동작을 둔다) · 종료(메뉴 단축키도 기본 동작을 둔다) · 모달(SURFACE 밖).
 * 실패: settle('error') 또는 «못 읽음» 표식이 남은 채 끝나면 풀고 토스트로 말한다(깨진 파일이면 보존한 이름까지 · noteUnreadable). 저장은 saveProjectToFile 머리말이 계속 거절한다.
 * ⛔고전 스크립트로 일찍 싣는다 — window 캡처는 등록 순서대로라 뒤에 실으면 앞선 window 캡처 리스너(scratch·overlay)가 먼저 돈다.
 */
(function (w) {
  var PASS = '#home-btn, #tab-bar, #tab-add-wrap';
  var SURFACE = '#topbar, #main, #floating-panel, #focus-mode-bar, #fp-plugin-panel, #tpl-browser, #block-context-menu, #color-adjust-panel, #ai-prompt-overlay';
  /* 기본 동작까지 끊는 것. pointerdown·mousedown 은 스크롤바를 살리려고, keydown 은 스크롤 키·메뉴 단축키를 살리려고 안 끊는다.
     끝 신호(pointerup·mouseup·keyup)는 지나간다 — 로드 앞에 눌린 키·끌기가 눌린 채로 남으면 안 된다. */
  var CANCEL = ['click', 'dblclick', 'auxclick', 'contextmenu', 'dragstart', 'dragenter', 'dragover', 'drop', 'paste', 'cut', 'beforeinput', 'keypress'];
  var STOP_ONLY = ['pointerdown', 'mousedown', 'keydown'];
  var ARM_MAX_MS = 15000;   // 확정 뒤 무장이 안 오는 고장의 안전망. 로드 시간과 무관한 값이라 로드 대기에 쓰지 않는다
  var SHOW_AFTER_MS = 150;  // 캐시 탭 전환에서 덮개가 번쩍이지 않게. 부트는 index.html 의 정적 덮개가 이미 떠 있다

  var on = false, blocked = 0, settledAt = 0, showTimer = null, pollTimer = null, unreadable = null, readError = null;

  function onSurface(t) {
    var el = t && t.nodeType === 1 ? t : (t && t.parentElement) || null;
    if (!el || el === document.body || el === document.documentElement) return true;
    if (el.closest(PASS)) return false;
    return !!el.closest(SURFACE);
  }
  /* 탭 이름 편집만은 탭 바에서도 막는다 — 로드가 탭 바를 다시 그리면 편집 칸의 blur 가 그 안에서 또 그려 로드를 예외로 끊는다(앱: 앞 판도 3/3 · 이름도 잃고 실패로 끝남). */
  function tabRename(e) { return e.type === 'dblclick' && e.target && e.target.nodeType === 1 && !!e.target.closest('.proj-tab-name'); }
  function editable(t) { return !!t && t.nodeType === 1 && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'); }

  function gate(e) {
    if (!on || !(onSurface(e.target) || tabRename(e))) return;
    blocked++;
    e.stopImmediatePropagation();
    if (CANCEL.indexOf(e.type) >= 0) {
      e.preventDefault();
      if (e.dataTransfer && (e.type === 'dragover' || e.type === 'dragenter')) e.dataTransfer.dropEffect = 'none';
    } else if (e.type === 'keydown' && editable(e.target) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();   // 조합 입력은 beforeinput 이 끊는다
    }
  }
  CANCEL.concat(STOP_ONLY).forEach(function (n) { w.addEventListener(n, gate, true); });

  function clearTimers() {
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }
  function release(s) {
    on = false; clearTimers();
    if (w.hideProjectLoadingOverlay) w.hideProjectLoadingOverlay();
    if (s && (s.phase === 'error' || (w.isTabFirstLoading && w.isTabFirstLoading(s.projectId)))) {
      if (w.showToast) w.showToast(w.isTabStale && w.isTabStale(s.projectId)
        ? '⚠️ 앞 저장이 아직 안 끝나 이 탭은 저장을 막았습니다 — 잠시 뒤 탭을 닫았다 다시 열어 주세요.'
        : readError
        ? '⚠️ 파일을 지금 열 수 없습니다(' + readError + ') — 파일은 그대로입니다. 잠시 뒤 탭을 다시 열어 주세요.'
        : unreadable
        ? '⚠️ 파일이 깨져 이 프로젝트를 읽지 못했습니다 — 저장하지 않습니다.' + (unreadable.name ? ' 원본은 프로젝트 폴더의 ' + unreadable.name + ' 로 보존했습니다.' : '')
        : '⚠️ 이 프로젝트를 읽지 못했습니다 — 탭을 다시 열어 주세요.');
    }
  }
  function check() {
    var pr = w.gdtProjectReady; var s = pr && pr.get ? pr.get() : null;
    if (!s) { release(null); return; }
    if (s.phase === 'loading') return;
    if (s.phase === 'error' || s.autosaveArmed === true) { release(s); return; }
    if (Date.now() - settledAt > ARM_MAX_MS) { console.warn('[load-input-gate] 무장이 안 와서 푼다', s.detail); release(s); }
  }
  w.LoadInputGate = {
    begin: function (projectId) {
      clearTimers();
      if (!projectId) { if (on) release(null); return; }   // 프로젝트 없는 판은 쓸 파일이 없고, 끝 신호도 없을 수 있다
      on = true; settledAt = 0; unreadable = null; readError = null;
      showTimer = setTimeout(function () { showTimer = null; if (on && w.showProjectLoadingOverlay) w.showProjectLoadingOverlay(); }, SHOW_AFTER_MS);
    },
    settled: function () {
      if (!on) return;
      settledAt = Date.now();
      if (pollTimer) clearInterval(pollTimer);
      check();
      if (on) pollTimer = setInterval(check, 50);
    },
    noteUnreadable: function (name) { unreadable = { name: name || null }; },
    noteReadError: function (code) { readError = code; },
    isOn: function () { return on; },
    blockedCount: function () { return blocked; },
  };
})(window);
