// claude-pm/floating-button.js — 플로팅 패널의 Claude PM 버튼 onclick 핸들러
// feature/claude-pm — Phase 1 (UI only)
// 버튼 마크업은 index.html #floating-panel 내 정적으로 마운트되어 있음 (#claude-pm-btn).
// 이 파일은 onclick 핸들러를 window 전역에 노출만 한다.
// (ai-prompt.js와 동일한 vanilla pattern — non-module script)

(function () {
  'use strict';

  // 활성 프로젝트의 claude-pm 폴더 경로 — terminal-panel.js가 필요로 함.
  // ensureClaudePMFolder 성공 시 claudePM:folderMap[projectId]에 저장됨.
  function _resolveActiveFolderPath() {
    try {
      const pid = window.activeProjectId;
      if (!pid) return '';
      const raw = localStorage.getItem('claudePM:folderMap');
      if (!raw) return '';
      const map = JSON.parse(raw);
      return (map && map[pid]) || '';
    } catch (_) { return ''; }
  }

  /**
   * 플로팅 버튼 클릭 핸들러 (2026-05-23 UX 단순화).
   * - 매니저 패널 단계 제거 → 터미널 패널을 *직접* 토글.
   * - 기존 매니저 패널 (#claude-pm-panel) 코드는 dead-code로 유지.
   * - Finder 열기 / MCP 가이드는 터미널 헤더 안에 통합됨.
   */
  function onClickClaudePMBtn() {
    const term = document.getElementById('claude-pm-terminal-panel');
    const isOpen = term && term.classList.contains('cpmt-open');
    const mini = document.getElementById('claude-pm-terminal-mini');
    const miniVisible = mini && getComputedStyle(mini).display !== 'none';

    if (isOpen) {
      window.closeClaudePMTerminalPanel?.();
      return;
    }
    if (miniVisible) {
      window.restoreClaudePMTerminalPanel?.();
      return;
    }
    const folderPath = _resolveActiveFolderPath();
    if (!folderPath) {
      try { window.showToast?.('💻 활성 프로젝트가 없습니다. 프로젝트를 먼저 여세요.'); } catch (_) {}
      return;
    }
    window.openClaudePMTerminalPanel?.({ folderPath });
  }

  window.onClickClaudePMBtn = onClickClaudePMBtn;

  // ── Phase 2 동시수정 가드용 — 사용자 캔버스 키 입력 추적 (add_text_block에서 검사) ──
  // capture 단계로 1회만 등록. 클로드 PM 터미널/알약/xterm 영역은 *PM 자기 입력*이므로 제외 (Codex 리뷰 #4).
  if (!window.__cpmKeydownGuardBound) {
    window.__cpmKeydownGuardBound = true;
    document.addEventListener('keydown', (e) => {
      try {
        if (e.target && e.target.closest && e.target.closest(
          '#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea'
        )) return;
        window._lastUserKeydown = Date.now();
      } catch (_) {}
    }, true);
  }
})();
