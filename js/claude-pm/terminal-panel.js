// js/claude-pm/terminal-panel.js — Claude PM 내부 터미널 패널 (멀티세션 + 최소화 알약)
// feature/claude-pm — Phase 5 (멀티세션 + mini pill)
//
// 변경:
//   - 프로젝트 ID 별 세션 dict: _projectStates[projectId] = { sessionId, term, fitAddon, folderPath,
//                                                            panelState:{left,top,width,height},
//                                                            unsubData, unsubExit, lastDataTs }
//   - 프로젝트 전환 시 자동 토글 (active-project-sync.js의 setter wrap에 hook)
//   - 헤더 ▭ 최소화 → mini pill (우하단 알약, 드래그 가능, claude data dot 점멸)
//
// 노출:
//   window.openClaudePMTerminalPanel({folderPath, projectId})
//   window.closeClaudePMTerminalPanel()
//   window.minimizeClaudePMTerminalPanel()
//   window.restoreClaudePMTerminalPanel()
//   window._claudePMTerminalOnProjectChange(projectId)   // active-project-sync.js가 호출

(function () {
  'use strict';

  let _panelEl = null;
  let _miniEl = null;
  let _resizeObs = null;
  let _dragging = false;
  let _activeProjectId = null;   // 현재 패널이 보여주고 있는 projectId
  let _globalDataUnsub = null;   // 모든 세션 data 이벤트 캐치 (mini dot용)
  let _globalExitUnsub = null;
  let _miniDotTimer = null;

  // 프로젝트별 상태 (term + sessionId + panelState + unsub들)
  // { [projectId]: {
  //     sessionId, term, fitAddon, body, folderPath,
  //     panelState: {left, top, width, height},
  //     unsubData, unsubExit, lastDataTs,
  //   } }
  const _projectStates = Object.create(null);

  const PANEL_STATE_LS_PREFIX = 'claudePMTerminalPanelState:';
  const MINI_POS_LS_KEY = 'claudePMTerminalMiniPos';

  function _ensureXtermLoaded() {
    return typeof window.Terminal === 'function';
  }

  function _loadPanelState(projectId) {
    try {
      const raw = localStorage.getItem(PANEL_STATE_LS_PREFIX + projectId);
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (v && typeof v === 'object') return v;
    } catch (_) {}
    return null;
  }
  function _savePanelState(projectId, state) {
    try { localStorage.setItem(PANEL_STATE_LS_PREFIX + projectId, JSON.stringify(state)); } catch (_) {}
  }

  function _ensurePanelDOM() {
    if (_panelEl) return _panelEl;
    const panel = document.createElement('div');
    panel.id = 'claude-pm-terminal-panel';
    panel.innerHTML = `
      <div class="cpmt-resizer cpmt-resizer-l"  data-dir="l"  title="너비 조절"></div>
      <div class="cpmt-resizer cpmt-resizer-r"  data-dir="r"  title="너비 조절"></div>
      <div class="cpmt-resizer cpmt-resizer-t"  data-dir="t"  title="높이 조절"></div>
      <div class="cpmt-resizer cpmt-resizer-b"  data-dir="b"  title="높이 조절"></div>
      <div class="cpmt-resizer cpmt-resizer-tl" data-dir="tl" title="크기 조절"></div>
      <div class="cpmt-resizer cpmt-resizer-tr" data-dir="tr" title="크기 조절"></div>
      <div class="cpmt-resizer cpmt-resizer-bl" data-dir="bl" title="크기 조절"></div>
      <div class="cpmt-resizer cpmt-resizer-br" data-dir="br" title="크기 조절"></div>
      <div class="cpmt-header">
        <span class="cpmt-title">
          <span class="cpmt-dot"></span>
          <span class="cpmt-title-text">Claude Terminal</span>
          <span class="cpmt-folder" id="cpmt-folder"></span>
        </span>
        <div class="cpmt-actions">
          <input type="range" class="cpmt-opacity-slider" min="20" max="100" value="100" title="투명도 조절" aria-label="투명도 조절">
          <button class="cpmt-btn" type="button" data-cpmt-action="open-finder" data-tip="Finder 열기" aria-label="Finder에서 폴더 열기">🔍</button>
          <button class="cpmt-btn" type="button" data-cpmt-action="open-external-terminal" data-tip="외부 터미널로 꺼내기" aria-label="Terminal.app에서 열기">↗</button>
          <button class="cpmt-btn" type="button" data-cpmt-action="mcp-guide" data-tip="MCP 가이드" aria-label=".mcp.json 가이드">ⓘ</button>
          <button class="cpmt-btn" type="button" data-cpmt-action="restart" data-tip="재시작" aria-label="재시작">↻</button>
          <button class="cpmt-btn" type="button" data-cpmt-action="minimize" data-tip="최소화" aria-label="최소화">▭</button>
          <button class="cpmt-btn cpmt-close" type="button" data-cpmt-action="close" data-tip="닫기" aria-label="닫기">✕</button>
        </div>
      </div>
      <div class="cpmt-body" id="cpmt-body"></div>
      <div class="cpmt-footer" id="cpmt-footer">세션 없음</div>
    `;
    document.body.appendChild(panel);
    panel.addEventListener('click', _onPanelClick);
    panel.querySelectorAll('.cpmt-resizer').forEach(r => r.addEventListener('mousedown', _startDrag));
    const header = panel.querySelector('.cpmt-header');
    if (header) _bindTerminalDrag(header, panel);

    // 투명도 슬라이더 — localStorage 저장값 복원 + input 이벤트 바인딩
    const slider = panel.querySelector('.cpmt-opacity-slider');
    if (slider) {
      const _OPACITY_LS_KEY = 'cpmt-bg-opacity';
      let saved = parseInt(localStorage.getItem(_OPACITY_LS_KEY) || '100', 10);
      if (!(saved >= 20 && saved <= 100)) saved = 100;
      slider.value = String(saved);
      panel.style.setProperty('--cpmt-bg-alpha', (saved / 100).toFixed(2));
      const _onOpacity = (e) => {
        const v = parseInt(e.target.value, 10);
        panel.style.setProperty('--cpmt-bg-alpha', (v / 100).toFixed(2));
        try { localStorage.setItem(_OPACITY_LS_KEY, String(v)); } catch (_) {}
      };
      slider.addEventListener('input', _onOpacity);
      // 슬라이더에서 mousedown → 패널 드래그/리사이즈로 번지지 않게
      slider.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    // 패널 크기 변화 → 현재 active 프로젝트의 fit
    if (typeof ResizeObserver !== 'undefined') {
      _resizeObs = new ResizeObserver(() => {
        const st = _activeProjectId && _projectStates[_activeProjectId];
        if (st && st.fitAddon) {
          try { st.fitAddon.fit(); _notifyResize(st); } catch (_) {}
        }
      });
      _resizeObs.observe(panel);
    }

    _panelEl = panel;
    // MCP 상태 dot — 패널 DOM 만들어진 직후 ping 시작 (매니저 패널 없이도 동작).
    _startDotPing();
    return panel;
  }

  function _ensureMiniDOM() {
    if (_miniEl) return _miniEl;
    const mini = document.createElement('button');
    mini.id = 'claude-pm-terminal-mini';
    mini.className = 'cpmt-mini-btn';
    mini.type = 'button';
    mini.innerHTML = `
      <span class="cpmt-mini-icon">›_</span>
      <span class="cpmt-mini-label">Claude</span>
      <span class="cpmt-mini-dot" aria-hidden="true"></span>
    `;
    mini.style.display = 'none';
    // 저장된 위치 복원
    try {
      const raw = localStorage.getItem(MINI_POS_LS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && Number.isFinite(p.left) && Number.isFinite(p.top)) {
          mini.style.left = p.left + 'px';
          mini.style.top = p.top + 'px';
          mini.style.right = 'auto';
          mini.style.bottom = 'auto';
        }
      }
    } catch (_) {}
    document.body.appendChild(mini);
    _bindMiniDrag(mini);
    _miniEl = mini;
    return mini;
  }

  // 헤더 드래그 (folder-create-modal._bindModalDrag 패턴 + panelState 저장)
  function _bindTerminalDrag(header, panel) {
    header.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.closest('.cpmt-btn, .cpmt-resizer')) return;
      e.preventDefault();
      const rect = panel.getBoundingClientRect();
      const startX = e.clientX, startY = e.clientY;
      const startLeft = rect.left, startTop = rect.top;
      if (!panel.style.width) panel.style.width = rect.width + 'px';
      if (!panel.style.height) panel.style.height = rect.height + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      let lastLeft = startLeft, lastTop = startTop;
      const onMove = (ev) => {
        lastLeft = startLeft + (ev.clientX - startX);
        lastTop  = startTop  + (ev.clientY - startY);
        panel.style.left = lastLeft + 'px';
        panel.style.top  = lastTop  + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        const st = _activeProjectId && _projectStates[_activeProjectId];
        if (st) {
          st.panelState = st.panelState || {};
          st.panelState.left = lastLeft;
          st.panelState.top = lastTop;
          st.panelState.width = panel.offsetWidth;
          st.panelState.height = panel.offsetHeight;
          if (st.fitAddon) { try { st.fitAddon.fit(); _notifyResize(st); } catch (_) {} }
          // fit() 이후 cols/rows 캡처 — 최소화→복원 정확성 향상
          if (st.term && Number.isFinite(st.term.cols) && Number.isFinite(st.term.rows)) {
            st.panelState.cols = st.term.cols;
            st.panelState.rows = st.term.rows;
          }
          _savePanelState(_activeProjectId, st.panelState);
        }
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // mini 알약 드래그 (5px threshold로 클릭과 분리)
  function _bindMiniDrag(mini) {
    let down = null;  // {x, y, t, left, top}
    let moved = false;
    mini.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const rect = mini.getBoundingClientRect();
      down = { x: e.clientX, y: e.clientY, t: Date.now(), left: rect.left, top: rect.top };
      moved = false;
      e.preventDefault();
      const onMove = (ev) => {
        if (!down) return;
        const dx = ev.clientX - down.x;
        const dy = ev.clientY - down.y;
        if (!moved && Math.hypot(dx, dy) < 5) return;
        moved = true;
        mini.classList.add('cpmt-mini-dragging');
        const nx = Math.max(4, Math.min(window.innerWidth - mini.offsetWidth - 4, down.left + dx));
        const ny = Math.max(4, Math.min(window.innerHeight - mini.offsetHeight - 4, down.top + dy));
        mini.style.left = nx + 'px';
        mini.style.top = ny + 'px';
        mini.style.right = 'auto';
        mini.style.bottom = 'auto';
      };
      const onUp = (ev) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        mini.classList.remove('cpmt-mini-dragging');
        if (moved) {
          try {
            localStorage.setItem(MINI_POS_LS_KEY, JSON.stringify({
              left: parseFloat(mini.style.left) || 0,
              top:  parseFloat(mini.style.top)  || 0,
            }));
          } catch (_) {}
        } else {
          // 클릭으로 처리
          restoreClaudePMTerminalPanel();
        }
        down = null;
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function _onPanelClick(e) {
    const btn = e.target.closest('[data-cpmt-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-cpmt-action');
    if (action === 'close') closeClaudePMTerminalPanel();
    else if (action === 'restart') _restartActiveSession();
    else if (action === 'minimize') minimizeClaudePMTerminalPanel();
    else if (action === 'open-finder') _onClickOpenFinder();
    else if (action === 'open-external-terminal') _onClickOpenExternalTerminal();
    else if (action === 'mcp-guide') _onClickMcpGuide();
  }

  async function _onClickOpenExternalTerminal() {
    const st = _activeProjectId && _projectStates[_activeProjectId];
    const folderPath = st && st.folderPath;
    if (!folderPath) {
      try { window.showToast?.('↗ 폴더 경로를 찾을 수 없음'); } catch (_) {}
      return;
    }
    try {
      const res = await window.electronAPI?.spawnClaudeTerminal?.(folderPath);
      if (!res || !res.ok) {
        try { window.showToast?.('↗ 외부 터미널 실행 실패: ' + (res?.error || 'electronAPI 없음')); } catch (_) {}
        return;
      }
      try { window.showToast?.('↗ Terminal.app으로 꺼냄 (앱 내부 세션은 유지)'); } catch (_) {}
    } catch (e) {
      try { window.showToast?.('↗ 외부 터미널 실행 예외: ' + (e?.message || e)); } catch (_) {}
    }
  }

  // 매니저 패널에서 이전 (2026-05-23 UX 단순화).
  async function _onClickOpenFinder() {
    const st = _activeProjectId && _projectStates[_activeProjectId];
    const folderPath = st && st.folderPath;
    if (!folderPath) {
      try { window.showToast?.('🔍 폴더 경로를 찾을 수 없음'); } catch (_) {}
      return;
    }
    try {
      const res = await window.electronAPI?.openInFinder?.(folderPath);
      if (!res || !res.ok) {
        try { window.showToast?.('🔍 Finder 열기 실패: ' + (res?.error || 'electronAPI 없음')); } catch (_) {}
      }
    } catch (e) {
      try { window.showToast?.('🔍 Finder 에러: ' + e.message); } catch (_) {}
    }
  }
  function _onClickMcpGuide() {
    try { window.showToast?.('ⓘ .mcp.json 가이드 — 본 프로젝트의 PM 폴더 안 .mcp.json이 자동 적용됨'); } catch (_) {}
  }

  // MCP 헬스 ping — cpmt-dot 색을 연결 상태에 동기화.
  // 패널 DOM 첫 생성 시 시작, 영구 5초 interval. 매니저 패널이 안 떠도 동작.
  let _mcpPingTimer = null;
  async function _pingMcpForDot() {
    if (!_panelEl) return;
    const dot = _panelEl.querySelector('.cpmt-dot');
    if (!dot) return;
    let connected = false;
    try {
      const res = await window.electronAPI?.pingClaudePM?.();
      connected = !!(res && res.ok && res.connected);
    } catch (_) { connected = false; }
    dot.classList.toggle('connected', connected);
    dot.classList.toggle('disconnected', !connected);
    // 다른 모듈 참조용 글로벌 상태 동기화
    try { window._claudePMState && (window._claudePMState.mcpConnected = connected); } catch (_) {}
  }
  function _startDotPing() {
    if (_mcpPingTimer) return;
    _pingMcpForDot();
    _mcpPingTimer = setInterval(_pingMcpForDot, 5000);
  }

  // Resizer (좌측 핸들 → 너비 변경)
  // 8방향 resize — 측면(l/r/t/b) + 코너(tl/tr/bl/br)
  let _resizeCtx = null;
  const _clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  function _startDrag(e) {
    if (!_panelEl) return;
    e.preventDefault();
    const dir = e.currentTarget?.dataset?.dir || 'l';
    const rect = _panelEl.getBoundingClientRect();
    _resizeCtx = {
      dir,
      startX: e.clientX, startY: e.clientY,
      startLeft: rect.left, startTop: rect.top,
      startW: rect.width, startH: rect.height,
    };
    _dragging = true;
    document.addEventListener('mousemove', _onResizerDrag);
    document.addEventListener('mouseup', _stopResizerDrag);
  }
  function _onResizerDrag(e) {
    if (!_resizeCtx || !_panelEl) return;
    const { dir, startX, startY, startLeft, startTop, startW, startH } = _resizeCtx;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const MIN_W = 320, MAX_W = Math.max(MIN_W, window.innerWidth  - 20);
    const MIN_H = 200, MAX_H = Math.max(MIN_H, window.innerHeight - 20);
    let newL = startLeft, newT = startTop, newW = startW, newH = startH;
    if (dir.includes('l')) {
      newW = _clamp(startW - dx, MIN_W, MAX_W);
      newL = startLeft + (startW - newW);
    }
    if (dir.includes('r')) {
      newW = _clamp(startW + dx, MIN_W, MAX_W);
    }
    if (dir.includes('t')) {
      newH = _clamp(startH - dy, MIN_H, MAX_H);
      newT = startTop + (startH - newH);
    }
    if (dir.includes('b')) {
      newH = _clamp(startH + dy, MIN_H, MAX_H);
    }
    _panelEl.style.left   = newL + 'px';
    _panelEl.style.top    = newT + 'px';
    _panelEl.style.width  = newW + 'px';
    _panelEl.style.height = newH + 'px';
    _panelEl.style.right  = 'auto';
    _panelEl.style.bottom = 'auto';
    try { localStorage.setItem('claudePMTerminalWidth', String(newW)); } catch (_) {}
    const st = _activeProjectId && _projectStates[_activeProjectId];
    if (st) {
      st.panelState = st.panelState || {};
      st.panelState.left = newL;
      st.panelState.top = newT;
      st.panelState.width = newW;
      st.panelState.height = newH;
      if (st.fitAddon) {
        try { st.fitAddon.fit(); _notifyResize(st); } catch (_) {}
      }
      // fit() 이후 cols/rows 캡처 — 최소화→복원 정확성 향상
      if (st.term && Number.isFinite(st.term.cols) && Number.isFinite(st.term.rows)) {
        st.panelState.cols = st.term.cols;
        st.panelState.rows = st.term.rows;
      }
      _savePanelState(_activeProjectId, st.panelState);
    }
  }
  function _stopResizerDrag() {
    _dragging = false;
    _resizeCtx = null;
    document.removeEventListener('mousemove', _onResizerDrag);
    document.removeEventListener('mouseup', _stopResizerDrag);
  }

  function _notifyResize(st) {
    if (!st || !st.term || !st.sessionId) return;
    try {
      window.electronAPI?.claudePMTerminalResize?.(st.sessionId, st.term.cols, st.term.rows);
    } catch (_) {}
  }

  function _applyPanelState(panelState) {
    if (!_panelEl) return;
    if (!panelState) {
      // 기본 위치 (CSS의 right:0; top:64px; bottom:0)
      _panelEl.style.left = '';
      _panelEl.style.top = '';
      _panelEl.style.right = '';
      _panelEl.style.bottom = '';
      try {
        const w = parseInt(localStorage.getItem('claudePMTerminalWidth') || '480', 10);
        if (w > 0) _panelEl.style.width = w + 'px';
      } catch (_) {}
      _panelEl.style.height = '';
      return;
    }
    if (Number.isFinite(panelState.left)) _panelEl.style.left = panelState.left + 'px';
    if (Number.isFinite(panelState.top))  _panelEl.style.top  = panelState.top + 'px';
    if (Number.isFinite(panelState.width))  _panelEl.style.width  = panelState.width + 'px';
    if (Number.isFinite(panelState.height)) _panelEl.style.height = panelState.height + 'px';
    if (Number.isFinite(panelState.left) || Number.isFinite(panelState.top)) {
      _panelEl.style.right = 'auto';
      _panelEl.style.bottom = 'auto';
    }
  }

  function _ensureTermForProject(projectId) {
    if (!_panelEl) return null;
    const st = _projectStates[projectId];
    if (!st) return null;
    if (st.term) return st.term;
    if (!_ensureXtermLoaded()) {
      _setFooter('xterm.js 로드 실패 — vendor/xterm/xterm.js 확인 필요');
      return null;
    }
    const Terminal = window.Terminal;
    const FitAddon = window.FitAddon && window.FitAddon.FitAddon;
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        // rgba + allowTransparency 짝 — xterm canvas가 자기 배경을 덮지 않게.
        // 실제 어두운 톤은 .cpmt-body 의 rgba(15,15,16, --cpmt-bg-alpha)가 그려준다.
        background: 'rgba(15, 15, 16, 0)',
        foreground: '#e6e6e6',
        cursor: '#6b9eff',
      },
      allowTransparency: true,
      convertEol: true,
      scrollback: 5000,
    });
    let fitAddon = null;
    if (FitAddon) {
      fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
    }
    // 프로젝트별 dedicated body div
    const body = document.createElement('div');
    body.className = 'cpmt-body-instance';
    body.style.width = '100%';
    body.style.height = '100%';
    body.style.display = 'none';
    const bodyContainer = _panelEl.querySelector('#cpmt-body');
    bodyContainer.appendChild(body);
    term.open(body);
    try { fitAddon && fitAddon.fit(); } catch (_) {}
    term.onData((data) => {
      if (st.sessionId) {
        window.electronAPI?.claudePMTerminalWrite?.(st.sessionId, data);
      }
    });
    st.term = term;
    st.fitAddon = fitAddon;
    st.body = body;
    return term;
  }

  async function _startSessionForProject(projectId, folderPath) {
    const st = _projectStates[projectId];
    if (!st) return false;
    if (!window.electronAPI?.claudePMTerminalStart) {
      _setFooter('electronAPI 없음');
      return false;
    }
    // per-project re-entrancy guard — 같은 프로젝트의 두 번째 start는 첫 promise 결과 공유
    if (st._startingPromise) return st._startingPromise;
    if (_activeProjectId === projectId) _setFooter('세션 시작 중…');
    const cols = st.term?.cols || 80;
    const rows = st.term?.rows || 24;
    st._startingPromise = (async () => {
      const res = await window.electronAPI.claudePMTerminalStart({ folderPath, cols, rows, projectId });
      if (!res || !res.ok) {
        if (_activeProjectId === projectId) _setFooter('세션 실패: ' + (res?.error || 'unknown'));
        st.term?.write(`\r\n\x1b[31m[error] ${res?.error || 'unknown'}\x1b[0m\r\n`);
        return false;
      }
      st.sessionId = res.sessionId;
      st.folderPath = folderPath;
      // footer는 active일 때만 갱신 (stale 가드)
      if (_activeProjectId === projectId) {
        _setFooter(`세션 ${st.sessionId} · claude=${res.claudeBin || (res.reused ? 'reused' : '?')}`);
      }
      // 프로젝트별 listener — sessionId 매칭으로 필터
      st.unsubData = window.electronAPI.onClaudePMTerminalData((p) => {
        if (p.sessionId !== st.sessionId) return;
        if (st.term) st.term.write(p.data);
        st.lastDataTs = Date.now();
      });
      st.unsubExit = window.electronAPI.onClaudePMTerminalExit((p) => {
        if (p.sessionId !== st.sessionId) return;
        st.term?.write(`\r\n\x1b[33m[exit code=${p.code} signal=${p.signal || ''}]\x1b[0m\r\n`);
        if (_activeProjectId === projectId) {
          _setFooter(`세션 종료 (code=${p.code})`);
        }
        st.sessionId = null;
      });
      return true;
    })().finally(() => { st._startingPromise = null; });
    return st._startingPromise;
  }

  async function _stopSessionForProject(projectId) {
    const st = _projectStates[projectId];
    if (!st) return;
    if (st.unsubData) { try { st.unsubData(); } catch (_) {} st.unsubData = null; }
    if (st.unsubExit) { try { st.unsubExit(); } catch (_) {} st.unsubExit = null; }
    if (st.sessionId) {
      try { await window.electronAPI?.claudePMTerminalKill?.(st.sessionId); } catch (_) {}
      st.sessionId = null;
    }
  }

  async function _restartActiveSession() {
    if (!_activeProjectId) return;
    const st = _projectStates[_activeProjectId];
    if (!st || !st.folderPath) return;
    await _stopSessionForProject(_activeProjectId);
    st.term?.clear();
    st.term?.write(`\r\n\x1b[36m[restarting…]\x1b[0m\r\n`);
    await _startSessionForProject(_activeProjectId, st.folderPath);
  }

  function _setFooter(msg) {
    if (!_panelEl) return;
    const f = _panelEl.querySelector('#cpmt-footer');
    if (f) f.textContent = msg;
  }

  function _showProjectBody(projectId) {
    if (!_panelEl) return;
    // 다른 프로젝트 body는 display:none
    for (const pid of Object.keys(_projectStates)) {
      const st = _projectStates[pid];
      if (!st || !st.body) continue;
      st.body.style.display = (pid === projectId) ? 'block' : 'none';
    }
    // active의 fit
    const st = _projectStates[projectId];
    if (st && st.fitAddon) {
      try { st.fitAddon.fit(); _notifyResize(st); } catch (_) {}
    }
    // 상단 폴더 라벨 갱신
    const folderEl = _panelEl.querySelector('#cpmt-folder');
    if (folderEl) folderEl.textContent = (st && st.folderPath) || '';
  }

  // mini dot 점멸 (5초 후 stop)
  function _ensureGlobalDataHook() {
    if (_globalDataUnsub) return;
    if (!window.electronAPI?.onClaudePMTerminalData) return;
    _globalDataUnsub = window.electronAPI.onClaudePMTerminalData(() => {
      // mini 떠 있을 때만 dot 점멸
      if (!_miniEl || _miniEl.style.display === 'none') return;
      _miniEl.classList.add('cpmt-mini-pulsing');
      if (_miniDotTimer) { clearTimeout(_miniDotTimer); _miniDotTimer = null; }
      _miniDotTimer = setTimeout(() => {
        _miniEl && _miniEl.classList.remove('cpmt-mini-pulsing');
        _miniDotTimer = null;
      }, 5000);
    });
  }

  // ── public ──
  async function openClaudePMTerminalPanel({ folderPath, projectId } = {}) {
    if (!folderPath) {
      if (typeof window.showToast === 'function') window.showToast('💻 폴더 경로 필요');
      return;
    }
    // projectId 없으면 현재 active 사용
    if (!projectId) projectId = window.activeProjectId || '_default';

    // mutex — AI 패널만 닫음. 매니저 모달은 옵션 C로 공존 허용 (z-index 9990 < 10001).
    try { window.closeAiPrompt?.(); } catch (_) {}

    _ensurePanelDOM();
    _ensureGlobalDataHook();

    // 프로젝트 상태 ensure
    let st = _projectStates[projectId];
    if (!st) {
      st = _projectStates[projectId] = {
        sessionId: null,
        term: null,
        fitAddon: null,
        body: null,
        folderPath,
        panelState: _loadPanelState(projectId),
        unsubData: null,
        unsubExit: null,
        lastDataTs: 0,
      };
    } else {
      st.folderPath = folderPath;  // 갱신
    }

    _activeProjectId = projectId;
    _applyPanelState(st.panelState);
    _panelEl.style.display = 'flex';
    requestAnimationFrame(() => _panelEl.classList.add('cpmt-open'));
    // mini 숨김
    if (_miniEl) _miniEl.style.display = 'none';

    _ensureTermForProject(projectId);
    _showProjectBody(projectId);

    // 세션 없으면 새로 시작 (reused면 main에서 기존 sessionId 반환)
    if (!st.sessionId) {
      await _startSessionForProject(projectId, folderPath);
    } else {
      _setFooter(`세션 ${st.sessionId} · 재연결`);
    }
  }

  async function closeClaudePMTerminalPanel() {
    if (!_panelEl) return;
    _panelEl.classList.remove('cpmt-open');
    setTimeout(() => {
      if (_panelEl && !_panelEl.classList.contains('cpmt-open')) {
        _panelEl.style.display = 'none';
      }
    }, 160);
    // 명시적 close는 active 세션 종료
    if (_activeProjectId) {
      const pid = _activeProjectId;
      _activeProjectId = null;
      await _stopSessionForProject(pid);
      // term/body는 cleanup (재오픈 시 새로 생성)
      const st = _projectStates[pid];
      if (st) {
        try { st.term && st.term.dispose && st.term.dispose(); } catch (_) {}
        try { st.body && st.body.remove(); } catch (_) {}
        st.term = null; st.fitAddon = null; st.body = null;
      }
    }
    // mini 숨김
    if (_miniEl) _miniEl.style.display = 'none';
  }

  function minimizeClaudePMTerminalPanel() {
    if (!_panelEl) return;
    // panelState 저장 (현재 위치/크기 + xterm cols/rows)
    // display:none *이전*에 getBoundingClientRect로 정확한 width/height 캡처
    if (_activeProjectId) {
      const st = _projectStates[_activeProjectId];
      if (st) {
        const rect = _panelEl.getBoundingClientRect();
        st.panelState = st.panelState || {};
        if (_panelEl.style.left)  st.panelState.left = parseFloat(_panelEl.style.left);
        if (_panelEl.style.top)   st.panelState.top  = parseFloat(_panelEl.style.top);
        st.panelState.width = rect.width;
        st.panelState.height = rect.height;
        // 현재 xterm cols/rows를 같이 저장 — restore 시 fit() 결과 의존도 줄이는 안전망.
        // 패널 transition / display 토글 타이밍에 fit()이 임시 width=0을 보더라도
        // 직접 term.resize(cols, rows)로 복원 가능.
        if (st.term && Number.isFinite(st.term.cols) && Number.isFinite(st.term.rows)) {
          st.panelState.cols = st.term.cols;
          st.panelState.rows = st.term.rows;
        }
        _savePanelState(_activeProjectId, st.panelState);
      }
    }
    _panelEl.classList.remove('cpmt-open');
    _panelEl.style.display = 'none';
    _ensureMiniDOM();
    _miniEl.style.display = 'inline-flex';
  }

  function restoreClaudePMTerminalPanel() {
    if (!_panelEl) return;
    if (_miniEl) _miniEl.style.display = 'none';
    if (_miniEl) _miniEl.classList.remove('cpmt-mini-pulsing');
    if (_miniDotTimer) { clearTimeout(_miniDotTimer); _miniDotTimer = null; }
    // active 프로젝트의 panelState 복원
    const st = _activeProjectId && _projectStates[_activeProjectId];
    if (st) {
      _applyPanelState(st.panelState);
    }
    _panelEl.style.display = 'flex';

    // [team-b fix] 최소화→복원 cols 좌쏠림 재발 방지.
    //
    // 기존 double-RAF 방식은 layout commit 직후(~16ms) fit()을 호출하지만,
    // CSS transition(0.18s)이 끝나기 전이라 fit()이 transient width를 잘못
    // 채집할 수 있다. 또한 ResizeObserver가 중간 width로 fit()을 다시
    // 호출하면 cols가 잘못 fix될 수 있음.
    //
    // 전략:
    //  1) panelState에 저장된 cols/rows가 있으면 term.resize(cols, rows)로
    //     즉시 정확한 dimension 복원 (display:flex 직후 1 RAF 후).
    //     → fit() 결과에 의존하지 않으므로 transition 중에도 안전.
    //  2) transition 완료 시점(transitionend 또는 230ms fallback)에 fit() 한 번
    //     더 호출해 픽셀 정밀 align (잔여 오차 보정).
    //  3) 저장된 cols/rows 없으면 (구버전 panelState) 기존 double-RAF 경로로 폴백.
    const savedCols = st && st.panelState && Number.isFinite(st.panelState.cols) ? st.panelState.cols : null;
    const savedRows = st && st.panelState && Number.isFinite(st.panelState.rows) ? st.panelState.rows : null;

    requestAnimationFrame(() => {
      _panelEl.classList.add('cpmt-open');
      // 1) 저장된 cols/rows 우선 복원
      if (st && st.term && savedCols && savedRows) {
        try {
          st.term.resize(savedCols, savedRows);
          _notifyResize(st);
        } catch (_) {}
      } else {
        // 폴백: 기존 double-RAF + fit() (첫 진입자 or 구버전 panelState)
        requestAnimationFrame(() => {
          const s = _activeProjectId && _projectStates[_activeProjectId];
          if (s && s.fitAddon) {
            try { s.fitAddon.fit(); _notifyResize(s); } catch (_) {}
          }
        });
      }

      // 2) transition 종료 후 fit()으로 잔여 오차 보정 — 한 번만 트리거
      let finalizeDone = false;
      let fallbackTimer = null;
      const onTrEnd = (e) => {
        // transform 또는 opacity 끝났을 때만 (transition 정의 기준)
        if (e.target !== _panelEl) return;
        if (e.propertyName !== 'transform' && e.propertyName !== 'opacity') return;
        finalize();
      };
      const finalize = () => {
        if (finalizeDone) return;
        finalizeDone = true;
        _panelEl.removeEventListener('transitionend', onTrEnd);
        if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
        // 가드: 패널이 현재 보이고 cpmt-open 상태일 때만 fit() 실행.
        // (사용자가 finalize 전에 다시 minimize / close 한 경우 width=0 함정 회피)
        if (!_panelEl || _panelEl.style.display === 'none' || !_panelEl.classList.contains('cpmt-open')) return;
        const s = _activeProjectId && _projectStates[_activeProjectId];
        if (s && s.fitAddon) {
          try { s.fitAddon.fit(); _notifyResize(s); } catch (_) {}
        }
      };
      _panelEl.addEventListener('transitionend', onTrEnd);
      // 폴백 — 0.18s transition + 마진. transitionend 안 오는 케이스(prefers-reduced-motion 등) 대비.
      fallbackTimer = setTimeout(finalize, 230);
    });
  }

  // active-project-sync.js에서 setter wrap 시 호출
  function onProjectChange(newProjectId) {
    if (!_panelEl) return;  // 패널 아예 안 열렸으면 무시
    if (newProjectId === _activeProjectId) return;
    // 이전 active 세션 hide (DOM 유지)
    const prev = _activeProjectId;
    _activeProjectId = newProjectId || null;
    if (!newProjectId) {
      // 프로젝트 없으면 패널 hide + mini도 숨김
      _panelEl.style.display = 'none';
      _panelEl.classList.remove('cpmt-open');
      if (_miniEl) _miniEl.style.display = 'none';
      return;
    }
    const st = _projectStates[newProjectId];
    if (st) {
      // 자동 표시 — panelState 복원, 패널이 보이고 있었으면 보이고, 미니였으면 미니 유지
      const wasMini = _miniEl && _miniEl.style.display !== 'none';
      _applyPanelState(st.panelState);
      _showProjectBody(newProjectId);
      if (!wasMini) {
        _panelEl.style.display = 'flex';
        requestAnimationFrame(() => _panelEl.classList.add('cpmt-open'));
      }
    } else {
      // 세션 없음 → 패널 hide, 이전이 보이고 있었으면 mini로 (사용자가 다시 열도록)
      _panelEl.style.display = 'none';
      _panelEl.classList.remove('cpmt-open');
      // mini도 끔 (CTA는 ProjectPM 사이드바의 "터미널 실행" 버튼)
      if (_miniEl) _miniEl.style.display = 'none';
    }
  }

  window.openClaudePMTerminalPanel     = openClaudePMTerminalPanel;
  window.closeClaudePMTerminalPanel    = closeClaudePMTerminalPanel;
  window.minimizeClaudePMTerminalPanel = minimizeClaudePMTerminalPanel;
  window.restoreClaudePMTerminalPanel  = restoreClaudePMTerminalPanel;
  window._claudePMTerminalOnProjectChange = onProjectChange;

  // CDP 등 외부에서 활성 PM 터미널에 프롬프트를 보낼 때 사용
  window.claudePMSendPrompt = async function (text, projectId, opts) {
    const pid = projectId || _activeProjectId;
    if (!pid) return { ok: false, error: '활성 프로젝트 없음' };
    const st = _projectStates[pid];
    if (!st || !st.sessionId) return { ok: false, error: `세션 없음 (project=${pid})` };
    if (!window.electronAPI?.claudePMTerminalWrite) return { ok: false, error: 'preload 브리지 없음' };
    const submitDelay = (opts && typeof opts.submitDelayMs === 'number') ? opts.submitDelayMs : 200;
    const body = String(text ?? '');
    await window.electronAPI.claudePMTerminalWrite(st.sessionId, body);
    if (submitDelay > 0) await new Promise(r => setTimeout(r, submitDelay));
    await window.electronAPI.claudePMTerminalWrite(st.sessionId, '\r');
    return { ok: true, projectId: pid, sessionId: st.sessionId, length: body.length, submitDelay };
  };
  window.claudePMListSessions = function () {
    return Object.keys(_projectStates).map(pid => ({
      projectId: pid,
      sessionId: _projectStates[pid]?.sessionId || null,
      active: pid === _activeProjectId,
    }));
  };
  // xterm 버퍼 덤프(가시영역 위주). lines 생략 시 전체 buffer.
  window.claudePMDumpBuffer = function (projectId, lines) {
    const pid = projectId || _activeProjectId;
    const st = _projectStates[pid];
    if (!st || !st.term) return { ok: false, error: '터미널 없음' };
    const buf = st.term.buffer.active;
    const total = buf.length;
    const take = Math.min(total, lines || total);
    const out = [];
    for (let i = total - take; i < total; i++) {
      const line = buf.getLine(i);
      if (line) out.push(line.translateToString(true));
    }
    return { ok: true, projectId: pid, sessionId: st.sessionId, lines: out.length, text: out.join('\n') };
  };
})();
