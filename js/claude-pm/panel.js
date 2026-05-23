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
  // basePath / lastFolderPath localStorage에 저장
  // 2026-05-22: 기본 위치를 Goditor userData 안으로 이동
  //   구: ~/Documents/claude-pm-projects/
  //   신: ~/Library/Application Support/Goya Design Editor/projects/<projectId>/claude-pm/
  // 백엔드(Move-A)가 basePath 인자 생략 시 자동으로 신규 경로 사용.
  // UI는 표시용으로 신규 경로를 보여주고, 사용자가 직접 입력한 path는 그대로 존중.
  const DEFAULT_BASE_PATH = '~/Library/Application Support/Goya Design Editor/projects/<projectId>/claude-pm/';
  const LEGACY_BASE_PATH = '~/Documents/claude-pm-projects/';

  // localStorage에 옛 default가 박혀있으면 → 그건 사용자가 명시 설정한 게 아니라
  // 이전 버전의 default가 자동 저장된 값이므로 제거(신규 default를 사용하도록).
  // 사용자가 명시적으로 다른 경로를 골랐다면(예: /Users/foo/work/...) 절대 건드리지 않음.
  try {
    const stored = localStorage.getItem('claudePMBasePath');
    if (stored && stored === LEGACY_BASE_PATH) {
      localStorage.removeItem('claudePMBasePath');
    }
  } catch (_) {}

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
  // _outsideMouseDownHandler 제거 — 2026-05-23 중앙 모달화 후 overlay의 mousedown으로 대체
  let _escHandler = null;
  let _mcpPingTimer = null;

  // 드래그 누적 — 닫혔다 다시 열어도 마지막 위치 유지
  let _dragDx = 0, _dragDy = 0;

  // ── DOM lazy create ───────────────────────
  function _ensurePanelDOM() {
    if (_panelEl) return _panelEl;

    const panel = document.createElement('div');
    panel.id = 'claude-pm-panel';
    // 2026-05-23 (팀 C — UX): 중앙 모달화. overlay(#claude-pm-panel) + shell(.cpm-panel-shell) 구조.
    // - overlay 클릭 = 닫기
    // - shell 내부 클릭은 stopPropagation으로 닫힘 방지
    panel.innerHTML = `
      <div class="cpm-panel-shell" role="dialog" aria-modal="true" aria-labelledby="cpm-panel-title">
        <div class="cpm-header">
          <span class="cpm-title" id="cpm-panel-title">
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
      </div>
    `;
    document.body.appendChild(panel);

    // 액션 위임
    panel.addEventListener('click', _onPanelClick);

    // overlay(dim) mousedown 닫기 — shell 내부 클릭은 무시
    panel.addEventListener('mousedown', (e) => {
      if (e.target === panel) closeClaudePMPanel();
    });

    // 헤더 드래그 이동 — 닫기 버튼 누르면 제외. shell 자체에 transform 적용.
    const shell  = panel.querySelector('.cpm-panel-shell');
    const header = panel.querySelector('.cpm-header');
    if (header && shell) _bindPanelDrag(header, shell);

    _panelEl = panel;
    _refreshClaudePMStatus();
    return panel;
  }

  // ── 드래그 이동 ───────────────────────────
  // folder-create-modal._bindModalDrag 패턴 미러
  // dx/dy 누적 — 닫혔다 다시 열어도 마지막 위치 유지
  // 2026-05-23 (팀 C — UX): 중앙 모달화 후, transform은 shell에 적용.
  function _bindPanelDrag(header, shell) {
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
        shell.style.transform = `translate(${_dragDx}px, ${_dragDy}px)`;
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
    // active-project-sync.js가 ensureClaudePMFolder 성공 시 claudePM:folderMap[projectId] = folderPath
    // 를 저장한다. lastFolderPath가 비어있으면 거기서 현재 active 프로젝트의 폴더를 가져옴.
    try {
      const pid = window.activeProjectId;
      if (pid) {
        const raw = localStorage.getItem('claudePM:folderMap');
        if (raw) {
          const map = JSON.parse(raw);
          if (map && typeof map === 'object' && map[pid]) return map[pid];
        }
      }
    } catch (_) {}
    // fallback — basePath만 있고 폴더 미생성: basePath 자체를 연다.
    // 단, <projectId> placeholder가 박혀 있으면 현재 activeProjectId로 치환 (Finder/Terminal이
    // 리터럴 "<projectId>" 경로로 열리는 사고 방지). 그래도 존재하지 않을 수 있으니 backend가 알아서.
    let bp = window._claudePMState.basePath || '';
    try {
      if (bp.indexOf('<projectId>') >= 0) {
        const pid = window.activeProjectId;
        if (pid) bp = bp.replace('<projectId>', pid);
        else bp = ''; // projectId 없으면 placeholder 노출 막기 위해 빈 값
      }
    } catch (_) {}
    return bp;
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
    // ensure 성공으로 PM 폴더가 이미 자동 생성된 프로젝트에선 "만들기" 버튼 숨김.
    // 판단: claudePM:folderMap[activeProjectId]에 경로가 기록되어 있으면 ensure 성공한 것.
    const createBtn = _panelEl.querySelector('[data-cpm-action="create-folder"]');
    if (createBtn) {
      let hasAutoFolder = false;
      try {
        const pid = window.activeProjectId;
        if (pid) {
          const raw = localStorage.getItem('claudePM:folderMap');
          if (raw) {
            const map = JSON.parse(raw);
            if (map && typeof map === 'object' && map[pid]) hasAutoFolder = true;
          }
        }
      } catch (_) {}
      createBtn.style.display = hasAutoFolder ? 'none' : '';
    }
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
    // 2026-05-23 (팀 C — UX): 터미널 패널과는 공존 허용 (옵션 C). 닫지 않음.
    // 매니저 모달 z-index(9990) < 터미널 z-index(10001) → 터미널이 dim 위에 그대로 보이고 클릭 가능.

    const panel = _ensurePanelDOM();
    // 드래그 누적 위치 복원 (없으면 translate(0,0)) — shell에 적용
    const shell = panel.querySelector('.cpm-panel-shell');
    if (shell) shell.style.transform = `translate(${_dragDx}px, ${_dragDy}px)`;
    // 다음 프레임에 cpm-open 부착 → transition 발동
    requestAnimationFrame(() => panel.classList.add('cpm-open'));

    // 버튼 active
    const btn = document.getElementById('claude-pm-btn');
    if (btn) btn.classList.add('active');

    // 외부 클릭은 overlay 자체의 mousedown으로 처리 (중앙 모달 패턴).
    // _bindOutsideClose는 기존 사이드 패널 시절 잔재 → 모달화 후 불필요.
    _bindEsc();

    _refreshClaudePMStatus();
    _startMcpPing();

    // 1회 마이그레이션 안내 — Goditor userData로 default 이동
    try {
      const KEY = 'claudePM:migrationNoticeShown';
      if (!localStorage.getItem(KEY)) {
        localStorage.setItem(KEY, '1');
        setTimeout(() => {
          _toast('📁 PM 폴더 위치가 Goditor 프로젝트 안으로 이동했어요');
        }, 250);
      }
    } catch (_) {}
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

    _unbindEsc();
    _stopMcpPing();
  }

  // ── ESC ───────────────────────────────────
  // 2026-05-23 (팀 C — UX): capture 단계로 등록.
  //   - folder-create-modal이 열려 있으면 그쪽 ESC가 먼저(capture) 잡아 매니저는 무시.
  //   - 터미널 패널(bubble 단계 ESC)과 충돌 시 매니저 모달이 우선 닫히고 stopPropagation으로
  //     터미널은 닫히지 않음 — 두 패널 공존(옵션 C) UX 보존.
  function _bindEsc() {
    if (_escHandler) return;
    _escHandler = (e) => {
      if (e.key !== 'Escape') return;
      // 폴더 생성 모달이 열려있으면 패널은 손대지 않음 (모달이 자체 ESC 처리)
      const modal = document.getElementById('claude-pm-folder-modal');
      if (modal && modal.classList.contains('cpm-open')) return;
      // 매니저 패널 안에 focus가 있는 인터랙티브 요소가 있으면(미래 input 추가 대비) skip
      if (_panelEl && _panelEl.contains(document.activeElement) &&
          document.activeElement &&
          /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      e.stopPropagation();
      closeClaudePMPanel();
    };
    document.addEventListener('keydown', _escHandler, true);
  }
  function _unbindEsc() {
    if (!_escHandler) return;
    document.removeEventListener('keydown', _escHandler, true);
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
