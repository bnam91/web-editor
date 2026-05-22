// claude-pm/panel.js — Claude PM 메인 패널
// feature/claude-pm — Phase 1 (UI · 백엔드 stub)
// 책임:
//   - DOM lazy create
//   - open/close + slide-in
//   - 외부 클릭 / ESC 닫기
//   - AI 패널과 mutex (PM 열 때 AI 자동 닫기)
//   - MCP 상태 mock 렌더
//   - 3개 액션 (폴더 생성 / Finder / 터미널) — stub
// (vanilla, non-module — ai-prompt.js 패턴)

(function () {
  'use strict';

  // ── 상태 ──────────────────────────────────
  // basePath / lastFolderPath localStorage에 저장 — 기본 ~/Documents/claude-pm-projects/
  const DEFAULT_BASE_PATH = '~/Documents/claude-pm-projects/';
  window._claudePMState = window._claudePMState || {
    mcpConnected: false,
    get basePath() {
      try {
        return localStorage.getItem('claudePMBasePath') || DEFAULT_BASE_PATH;
      } catch (_) {
        return DEFAULT_BASE_PATH;
      }
    },
    set basePath(v) {
      try { localStorage.setItem('claudePMBasePath', v || DEFAULT_BASE_PATH); } catch (_) {}
    },
    get lastFolderPath() {
      try { return localStorage.getItem('claudePMLastFolderPath') || ''; } catch (_) { return ''; }
    },
    set lastFolderPath(v) {
      try { localStorage.setItem('claudePMLastFolderPath', v || ''); } catch (_) {}
    },
  };

  let _panelEl = null;
  let _outsideMouseDownHandler = null;
  let _escHandler = null;
  let _mcpPingTimer = null;

  // 드래그 누적 — 닫혔다 다시 열어도 마지막 위치 유지
  let _dragDx = 0, _dragDy = 0;

  // ── DOM lazy create ───────────────────────
  function _ensurePanelDOM() {
    if (_panelEl) return _panelEl;

    const panel = document.createElement('div');
    panel.id = 'claude-pm-panel';
    panel.innerHTML = `
      <div class="cpm-header">
        <span class="cpm-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <!-- 라운드 사각 말풍선 + 왼쪽 아래 꼬리 -->
            <path d="M3 2.5h8.5a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H6.5L4 13v-2.5H3A1.5 1.5 0 0 1 1.5 9V4A1.5 1.5 0 0 1 3 2.5Z"
                  fill="currentColor" opacity="0.92"/>
            <!-- 우상단 4점 스파클 -->
            <path d="M13 1.5 13.5 3 15 3.5 13.5 4 13 5.5 12.5 4 11 3.5 12.5 3Z" fill="#ffd66b"/>
          </svg>
          Claude PM
        </span>
        <button class="cpm-close" type="button" onclick="window.closeClaudePMPanel?.()" title="닫기" aria-label="닫기">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.8">
            <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
          </svg>
        </button>
      </div>
      <div class="cpm-status">
        <div class="cpm-status-row">
          <span class="cpm-status-dot" id="cpm-status-dot"></span>
          <span id="cpm-status-text">MCP 연결 확인 중…</span>
        </div>
        <div class="cpm-status-hint" id="cpm-status-hint">Claude Code에서 .mcp.json을 추가하면 연결됩니다.</div>
      </div>
      <div class="cpm-actions">
        <button class="cpm-action" type="button" data-cpm-action="create-folder">
          <span class="cpm-action-icon">📁</span>
          <span class="cpm-action-label">Claude PM 폴더 만들기</span>
          <span class="cpm-action-arrow">›</span>
        </button>
        <button class="cpm-action" type="button" data-cpm-action="open-finder">
          <span class="cpm-action-icon">🔍</span>
          <span class="cpm-action-label">Finder에서 폴더 열기</span>
          <span class="cpm-action-arrow">›</span>
        </button>
        <button class="cpm-action" type="button" data-cpm-action="run-claude-terminal">
          <span class="cpm-action-icon">💻</span>
          <span class="cpm-action-label">터미널에서 Claude 실행</span>
          <span class="cpm-action-arrow">›</span>
        </button>
      </div>
      <div class="cpm-footer">
        <div class="cpm-footer-desc">Claude Code에서 이 프로젝트를 열어 디자인 작업을 자동화하세요.</div>
        <button class="cpm-footer-link" type="button" data-cpm-action="mcp-guide">ⓘ .mcp.json 설정 가이드 →</button>
      </div>
    `;
    document.body.appendChild(panel);

    // 액션 위임
    panel.addEventListener('click', _onPanelClick);

    // 헤더 드래그 이동 — 닫기 버튼 누르면 제외
    const header = panel.querySelector('.cpm-header');
    if (header) _bindPanelDrag(header, panel);

    _panelEl = panel;
    _refreshClaudePMStatus();
    return panel;
  }

  // ── 드래그 이동 ───────────────────────────
  // folder-create-modal._bindModalDrag 패턴 미러
  // dx/dy 누적 — 닫혔다 다시 열어도 마지막 위치 유지
  function _bindPanelDrag(header, panel) {
    header.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      // 닫기 버튼은 드래그 제외
      if (e.target.closest('.cpm-close')) return;
      e.preventDefault();
      const startX = e.clientX, startY = e.clientY;
      const startDx = _dragDx, startDy = _dragDy;
      const onMove = (ev) => {
        _dragDx = startDx + (ev.clientX - startX);
        _dragDy = startDy + (ev.clientY - startY);
        panel.style.transform = `translate(${_dragDx}px, ${_dragDy}px)`;
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ── 액션 핸들러 ───────────────────────────
  function _onPanelClick(e) {
    const btn = e.target.closest('[data-cpm-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-cpm-action');
    switch (action) {
      case 'create-folder':
        window.openFolderCreateModal?.();
        break;
      case 'open-finder':
        _onClickOpenFinder();
        break;
      case 'run-claude-terminal':
        _onClickRunClaudeTerminal();
        break;
      case 'mcp-guide':
        _onClickMcpGuide();
        break;
    }
  }

  function _resolveFolderPath() {
    const last = window._claudePMState.lastFolderPath;
    if (last) return last;
    // fallback — basePath만 있고 폴더 미생성: basePath 자체를 연다
    return window._claudePMState.basePath || '';
  }

  async function _onClickOpenFinder() {
    const folderPath = _resolveFolderPath();
    if (!folderPath) {
      _toast('🔍 먼저 폴더를 생성해주세요');
      return;
    }
    try {
      const res = await window.electronAPI?.openInFinder?.(folderPath);
      if (!res || !res.ok) {
        _toast('🔍 Finder 열기 실패: ' + (res?.error || 'electronAPI 없음'));
        return;
      }
      _toast('🔍 Finder 열림');
    } catch (e) {
      _toast('🔍 Finder 열기 에러: ' + e.message);
    }
  }

  async function _onClickRunClaudeTerminal() {
    const folderPath = _resolveFolderPath();
    if (!folderPath) {
      _toast('💻 먼저 폴더를 생성해주세요');
      return;
    }
    // Phase 3 (F8) — 내부 터미널 패널 사용. 외부 Terminal.app 옵션은 Shift+Click으로 별도 호출.
    try {
      if (typeof window.openClaudePMTerminalPanel === 'function') {
        // PM 패널 닫고 터미널 패널 열기 (mutex)
        try { closeClaudePMPanel(); } catch (_) {}
        await window.openClaudePMTerminalPanel({ folderPath });
        return;
      }
      // fallback — 외부 Terminal.app
      const res = await window.electronAPI?.spawnClaudeTerminal?.(folderPath);
      if (!res || !res.ok) {
        _toast('💻 터미널 실행 실패: ' + (res?.error || 'electronAPI 없음'));
        return;
      }
      _toast('💻 터미널에서 Claude 실행');
    } catch (e) {
      _toast('💻 터미널 실행 에러: ' + e.message);
    }
  }

  function _onClickMcpGuide() {
    // Phase 3 — 가이드 문서 열기 (in-app overlay or external link)
    _toast('ⓘ .mcp.json 가이드 — Phase 3');
  }

  // ── 상태 갱신 ─────────────────────────────
  function _refreshClaudePMStatus() {
    if (!_panelEl) return;
    const connected = !!window._claudePMState.mcpConnected;
    const dot = _panelEl.querySelector('#cpm-status-dot');
    const txt = _panelEl.querySelector('#cpm-status-text');
    const hint = _panelEl.querySelector('#cpm-status-hint');
    if (dot) {
      dot.classList.toggle('connected', connected);
      dot.classList.toggle('disconnected', !connected);
    }
    if (txt) txt.textContent = connected ? 'MCP 연결됨' : 'MCP 연결 안 됨';
    if (hint) hint.textContent = connected
      ? 'Claude Code가 이 프로젝트를 인식 중입니다.'
      : 'Claude Code에서 .mcp.json을 추가하면 연결됩니다.';
  }

  // ── MCP ping (5s interval) ───────────────
  async function _pingMcpOnce() {
    try {
      const res = await window.electronAPI?.pingClaudePM?.();
      const connected = !!(res && res.ok && res.connected);
      if (window._claudePMState.mcpConnected !== connected) {
        window._claudePMState.mcpConnected = connected;
        _refreshClaudePMStatus();
      }
    } catch (_) {
      if (window._claudePMState.mcpConnected) {
        window._claudePMState.mcpConnected = false;
        _refreshClaudePMStatus();
      }
    }
  }
  function _startMcpPing() {
    if (_mcpPingTimer) return;
    _pingMcpOnce(); // 즉시 한 번
    _mcpPingTimer = setInterval(_pingMcpOnce, 5000);
  }
  function _stopMcpPing() {
    if (_mcpPingTimer) { clearInterval(_mcpPingTimer); _mcpPingTimer = null; }
  }

  // ── open / close ──────────────────────────
  function openClaudePMPanel() {
    // AI 패널과 mutex — PM 열 때 AI 패널 자동 닫음
    try { window.closeAiPrompt?.(); } catch (_) {}

    const panel = _ensurePanelDOM();
    // display:flex + transition trigger
    panel.style.display = 'flex';
    // 드래그 누적 위치 복원 (없으면 translate(0,0))
    panel.style.transform = `translate(${_dragDx}px, ${_dragDy}px)`;
    // 다음 프레임에 cpm-open 부착 → transition 발동
    requestAnimationFrame(() => panel.classList.add('cpm-open'));

    // 버튼 active
    const btn = document.getElementById('claude-pm-btn');
    if (btn) btn.classList.add('active');

    // 외부 mousedown 닫기 (캡처 단계)
    _bindOutsideClose();
    _bindEsc();

    _refreshClaudePMStatus();
    _startMcpPing();
  }

  function closeClaudePMPanel() {
    if (!_panelEl) return;
    _panelEl.classList.remove('cpm-open');
    // transition 150ms 끝나면 display:none
    setTimeout(() => {
      if (_panelEl && !_panelEl.classList.contains('cpm-open')) {
        _panelEl.style.display = 'none';
      }
    }, 160);

    const btn = document.getElementById('claude-pm-btn');
    if (btn) btn.classList.remove('active');

    _unbindOutsideClose();
    _unbindEsc();
    _stopMcpPing();
  }

  // ── 외부 클릭 / ESC ───────────────────────
  function _bindOutsideClose() {
    if (_outsideMouseDownHandler) return;
    _outsideMouseDownHandler = (e) => {
      if (!_panelEl) return;
      // 모달 열려있으면 외부 클릭 무시 (모달이 우선 닫힘 처리)
      const modal = document.getElementById('claude-pm-folder-modal');
      if (modal && modal.classList.contains('cpm-open')) return;

      const inPanel = _panelEl.contains(e.target);
      const onBtn = e.target.closest && e.target.closest('#claude-pm-btn');
      if (!inPanel && !onBtn) closeClaudePMPanel();
    };
    // 캡처 단계로 등록 (Plan §10)
    document.addEventListener('mousedown', _outsideMouseDownHandler, true);
  }
  function _unbindOutsideClose() {
    if (!_outsideMouseDownHandler) return;
    document.removeEventListener('mousedown', _outsideMouseDownHandler, true);
    _outsideMouseDownHandler = null;
  }

  function _bindEsc() {
    if (_escHandler) return;
    _escHandler = (e) => {
      if (e.key !== 'Escape') return;
      // 모달이 열려있으면 패널은 손대지 않음 (모달이 자체 ESC 처리)
      const modal = document.getElementById('claude-pm-folder-modal');
      if (modal && modal.classList.contains('cpm-open')) return;
      e.stopPropagation();
      closeClaudePMPanel();
    };
    document.addEventListener('keydown', _escHandler);
  }
  function _unbindEsc() {
    if (!_escHandler) return;
    document.removeEventListener('keydown', _escHandler);
    _escHandler = null;
  }

  // ── 유틸 ──────────────────────────────────
  function _toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
    else console.log('[Claude PM]', msg);
  }

  // ── 전역 노출 ─────────────────────────────
  window.openClaudePMPanel = openClaudePMPanel;
  window.closeClaudePMPanel = closeClaudePMPanel;
  window._refreshClaudePMStatus = _refreshClaudePMStatus;
})();
