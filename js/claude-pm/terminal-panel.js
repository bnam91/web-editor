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
  let _escHandler = null;
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
      <div class="cpmt-resizer" title="드래그하여 너비 조절"></div>
      <div class="cpmt-header">
        <span class="cpmt-title">
          <span class="cpmt-dot"></span>
          <span class="cpmt-title-text">Claude Terminal</span>
          <span class="cpmt-folder" id="cpmt-folder"></span>
        </span>
        <div class="cpmt-actions">
          <button class="cpmt-btn" type="button" data-cpmt-action="restart" title="재시작">↻</button>
          <button class="cpmt-btn" type="button" data-cpmt-action="minimize" title="최소화">▭</button>
          <button class="cpmt-btn cpmt-close" type="button" data-cpmt-action="close" title="닫기">✕</button>
        </div>
      </div>
      <div class="cpmt-body" id="cpmt-body"></div>
      <div class="cpmt-footer" id="cpmt-footer">세션 없음</div>
    `;
    document.body.appendChild(panel);
    panel.addEventListener('click', _onPanelClick);
    const resizer = panel.querySelector('.cpmt-resizer');
    resizer.addEventListener('mousedown', _startDrag);
    const header = panel.querySelector('.cpmt-header');
    if (header) _bindTerminalDrag(header, panel);

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
          _savePanelState(_activeProjectId, st.panelState);
          if (st.fitAddon) { try { st.fitAddon.fit(); _notifyResize(st); } catch (_) {} }
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
  }

  // Resizer (좌측 핸들 → 너비 변경)
  function _startDrag(e) {
    e.preventDefault();
    _dragging = true;
    document.addEventListener('mousemove', _onResizerDrag);
    document.addEventListener('mouseup', _stopResizerDrag);
  }
  function _onResizerDrag(e) {
    if (!_dragging || !_panelEl) return;
    const rect = _panelEl.getBoundingClientRect();
    // 우측이 fix면 left+dx 기준, 아니면 width 계산
    let newW;
    if (_panelEl.style.right === 'auto') {
      newW = Math.min(900, Math.max(320, (rect.right) - e.clientX));
      // 좌측 핸들 드래그: left 이동, width 변경
      const newLeft = e.clientX;
      const oldRight = rect.right;
      _panelEl.style.left = newLeft + 'px';
      _panelEl.style.width = (oldRight - newLeft) + 'px';
    } else {
      newW = Math.min(900, Math.max(320, window.innerWidth - e.clientX));
      _panelEl.style.width = newW + 'px';
    }
    try { localStorage.setItem('claudePMTerminalWidth', String(_panelEl.offsetWidth)); } catch (_) {}
    const st = _activeProjectId && _projectStates[_activeProjectId];
    if (st) {
      st.panelState = st.panelState || {};
      st.panelState.width = _panelEl.offsetWidth;
      st.panelState.height = _panelEl.offsetHeight;
      if (_panelEl.style.left) st.panelState.left = parseFloat(_panelEl.style.left);
      _savePanelState(_activeProjectId, st.panelState);
      if (st.fitAddon) {
        try { st.fitAddon.fit(); _notifyResize(st); } catch (_) {}
      }
    }
  }
  function _stopResizerDrag() {
    _dragging = false;
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
        background: '#0f0f10',
        foreground: '#e6e6e6',
        cursor: '#6b9eff',
      },
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

    // mutex — 다른 패널 닫기
    try { window.closeAiPrompt?.(); } catch (_) {}
    try { window.closeClaudePMPanel?.(); } catch (_) {}

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

    _bindEsc();
  }

  async function closeClaudePMTerminalPanel() {
    if (!_panelEl) return;
    _panelEl.classList.remove('cpmt-open');
    setTimeout(() => {
      if (_panelEl && !_panelEl.classList.contains('cpmt-open')) {
        _panelEl.style.display = 'none';
      }
    }, 160);
    _unbindEsc();
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
    // panelState 저장 (현재 위치/크기)
    if (_activeProjectId) {
      const st = _projectStates[_activeProjectId];
      if (st) {
        const rect = _panelEl.getBoundingClientRect();
        st.panelState = st.panelState || {};
        if (_panelEl.style.left)  st.panelState.left = parseFloat(_panelEl.style.left);
        if (_panelEl.style.top)   st.panelState.top  = parseFloat(_panelEl.style.top);
        st.panelState.width = rect.width;
        st.panelState.height = rect.height;
        _savePanelState(_activeProjectId, st.panelState);
      }
    }
    _panelEl.classList.remove('cpmt-open');
    _panelEl.style.display = 'none';
    _ensureMiniDOM();
    _miniEl.style.display = 'inline-flex';
    _unbindEsc();
  }

  function restoreClaudePMTerminalPanel() {
    if (!_panelEl) return;
    if (_miniEl) _miniEl.style.display = 'none';
    if (_miniEl) _miniEl.classList.remove('cpmt-mini-pulsing');
    if (_miniDotTimer) { clearTimeout(_miniDotTimer); _miniDotTimer = null; }
    // active 프로젝트의 panelState 복원
    if (_activeProjectId) {
      const st = _projectStates[_activeProjectId];
      _applyPanelState(st && st.panelState);
    }
    _panelEl.style.display = 'flex';
    requestAnimationFrame(() => _panelEl.classList.add('cpmt-open'));
    // fit
    const st = _activeProjectId && _projectStates[_activeProjectId];
    if (st && st.fitAddon) {
      try { st.fitAddon.fit(); _notifyResize(st); } catch (_) {}
    }
    _bindEsc();
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

  function _bindEsc() {
    if (_escHandler) return;
    _escHandler = (e) => {
      if (e.key !== 'Escape') return;
      if (_panelEl && _panelEl.contains(document.activeElement)) return;
      e.stopPropagation();
      closeClaudePMTerminalPanel();
    };
    document.addEventListener('keydown', _escHandler);
  }
  function _unbindEsc() {
    if (!_escHandler) return;
    document.removeEventListener('keydown', _escHandler);
    _escHandler = null;
  }

  window.openClaudePMTerminalPanel     = openClaudePMTerminalPanel;
  window.closeClaudePMTerminalPanel    = closeClaudePMTerminalPanel;
  window.minimizeClaudePMTerminalPanel = minimizeClaudePMTerminalPanel;
  window.restoreClaudePMTerminalPanel  = restoreClaudePMTerminalPanel;
  window._claudePMTerminalOnProjectChange = onProjectChange;
})();
