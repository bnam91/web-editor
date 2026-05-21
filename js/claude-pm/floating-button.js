// claude-pm/floating-button.js — 플로팅 패널의 Claude PM 버튼 onclick 핸들러
// feature/claude-pm — Phase 1 (UI only)
// 버튼 마크업은 index.html #floating-panel 내 정적으로 마운트되어 있음 (#claude-pm-btn).
// 이 파일은 onclick 핸들러를 window 전역에 노출만 한다.
// (ai-prompt.js와 동일한 vanilla pattern — non-module script)

(function () {
  'use strict';

  /**
   * 플로팅 버튼 클릭 핸들러.
   * - 패널이 열려있으면 닫기 (토글)
   * - 닫혀있으면 열기
   * panel.js의 open/closeClaudePMPanel을 위임 호출.
   */
  function onClickClaudePMBtn() {
    const panel = document.getElementById('claude-pm-panel');
    const isOpen = panel && panel.classList.contains('cpm-open');
    if (isOpen) {
      window.closeClaudePMPanel?.();
    } else {
      window.openClaudePMPanel?.();
    }
  }

  window.onClickClaudePMBtn = onClickClaudePMBtn;
})();
