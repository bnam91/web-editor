// claude-pm/active-project-sync.js — renderer ↔ main active project 동기화
// 2026-05-21 신규. H3 (codex 통합 리뷰에서 지적된 active project 미설정 이슈) 해결용.
//
// 책임:
//   1. 페이지 로드 시 현재 window.activeProjectId를 main에 전달 (초기 sync)
//   2. window.activeProjectId setter를 wrap해서 변경 시마다 main에 알림 (탭 전환 등)
//
// MCP 서버의 read_project tool이 global.currentActiveProjectId를 읽으려면 이 모듈 필요.

(function () {
  'use strict';

  if (!window.electronAPI?.setClaudePMActiveProject) {
    // Electron 외부 또는 Phase 2 미배포 환경 — silent skip
    return;
  }

  function _push(pid) {
    try {
      window.electronAPI.setClaudePMActiveProject(pid || null);
    } catch (_) {
      // best-effort, 실패해도 앱 동작에 영향 X
    }
  }

  // ── setter wrap ─────────────────────────────
  // save-load.js가 Object.defineProperty로 setter를 박아둠. 그 위에 한 겹 더 감쌈.
  function _wrapSetter() {
    const desc = Object.getOwnPropertyDescriptor(window, 'activeProjectId');
    if (!desc || !desc.set) {
      // setter 없으면 polling fallback
      _pollingFallback();
      return false;
    }
    const origGet = desc.get;
    const origSet = desc.set;
    Object.defineProperty(window, 'activeProjectId', {
      get: origGet,
      set(v) {
        origSet(v);
        _push(v);
      },
      configurable: true,
    });
    return true;
  }

  // ── polling fallback ────────────────────────
  // setter wrap 실패 시 2초 폴링 (URL 파라미터 변경 등에 대응)
  let _lastPushed = null;
  function _pollingFallback() {
    setInterval(() => {
      const cur = window.activeProjectId || null;
      if (cur !== _lastPushed) {
        _lastPushed = cur;
        _push(cur);
      }
    }, 2000);
  }

  // ── init ───────────────────────────────────
  function _init() {
    const ok = _wrapSetter();
    // 초기 1회 전송 — 현재 activeProjectId가 이미 set된 상태
    _push(window.activeProjectId || null);
    // setter wrap 성공해도 안전망으로 _lastPushed 갱신
    _lastPushed = window.activeProjectId || null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init, { once: true });
  } else {
    _init();
  }
})();
