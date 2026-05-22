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
    // 터미널 패널 멀티세션 hook — 프로젝트 전환 시 자동 토글
    try {
      if (typeof window._claudePMTerminalOnProjectChange === 'function') {
        window._claudePMTerminalOnProjectChange(pid || null);
      }
    } catch (_) {}
    // 자동 PM 폴더 마이그레이션 — 기존 프로젝트도 첫 진입 시 폴더 보장
    _ensureFolderForActive(pid);
  }

  // ── ensureFolder: 활성 프로젝트의 PM 폴더 자동 마이그레이션 ──
  // pid-scoped in-flight 캐시(여러 프로젝트 빠르게 전환해도 각각 1번씩 시도).
  // 같은 세션에서 같은 pid가 한 번 OK 받았으면 더 호출하지 않음(_ensuredSet).
  // 한계: 사용자가 같은 세션 도중 폴더를 수동 삭제 → 페이지 reload 전에는 재생성 안 됨.
  const _ensuredSet = new Set();
  const _inflight = new Map(); // pid -> Promise
  async function _ensureFolderForActive(pid) {
    try {
      if (!pid || _ensuredSet.has(pid)) return;
      if (_inflight.has(pid)) return _inflight.get(pid);
      if (!window.electronAPI?.ensureClaudePMFolder) return;
      // folderMap 사전 확인 — 매핑 있고 폴더 검증 필요 없으면 IPC 자체 skip 가능하지만,
      // main 측 검증이 더 안전하므로 IPC는 그대로 호출 (basePath 힌트는 미사용 — base 고정)
      let projectName = null;
      try {
        const tab = window.openTabs?.find?.((t) => t && t.id === pid);
        if (tab && tab.name) projectName = tab.name;
      } catch (_) {}
      if (!projectName) projectName = window.activeProjectName || null;
      if (!projectName) return; // 다음 setter 발화 때 재시도

      const p = (async () => {
        const res = await window.electronAPI.ensureClaudePMFolder({
          projectId: pid,
          projectName,
        });
        if (res && res.ok && res.folderPath) {
          _ensuredSet.add(pid);
          try {
            const raw = localStorage.getItem('claudePM:folderMap') || '{}';
            const map = JSON.parse(raw);
            map[pid] = res.folderPath;
            localStorage.setItem('claudePM:folderMap', JSON.stringify(map));
          } catch (_) {}
        }
        return res;
      })();
      _inflight.set(pid, p);
      try { await p; } finally { _inflight.delete(pid); }
    } catch (_) { /* best-effort */ }
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
