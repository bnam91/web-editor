// js/claude-pm/terminal-panel.js — Claude PM 내부 터미널 패널
// feature/claude-pm — Phase 3 (F8)
//
// xterm.js (vendor/xterm)를 사용해 우측 슬라이드 패널에 터미널을 띄우고,
// IPC로 main process에 child_process.spawn된 claude 세션과 양방향 통신한다.
//
// 노출:
//   window.openClaudePMTerminalPanel({folderPath})
//   window.closeClaudePMTerminalPanel()
//
// AI 패널 / Claude PM 메인 패널과 mutex (셋 중 하나만)

(function () {
  'use strict';

  let _panelEl = null;
  let _term = null;
  let _fitAddon = null;
  let _sessionId = null;
  let _unsubData = null;
  let _unsubExit = null;
  let _escHandler = null;
  let _resizeObs = null;
  let _currentFolder = null;
  let _dragging = false;

  // 헤더 드래그 이동 — 패널 자체 위치(left/top) 누적.
  // 닫혔다 다시 open 시 모듈 스코프 변수로 마지막 위치 유지.
  // null이면 기본 위치(right:0; top:64px; bottom:0) 사용.
  let _panelLeft = null, _panelTop = null;

  function _ensureXtermLoaded() {
    // xterm.js / xterm.css는 index.html에서 정적 link/script로 로드된다.
    // 여기서는 window.Terminal 존재 여부만 확인.
    return typeof window.Terminal === 'function';
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
          <button class="cpmt-btn cpmt-close" type="button" data-cpmt-action="close" title="닫기">✕</button>
        </div>
      </div>
      <div class="cpmt-body" id="cpmt-body"></div>
      <div class="cpmt-footer" id="cpmt-footer">세션 없음</div>
    `;
    document.body.appendChild(panel);

    panel.addEventListener('click', _onPanelClick);
    // 리사이저 (좌측 핸들 → 너비 변경)
    const resizer = panel.querySelector('.cpmt-resizer');
    resizer.addEventListener('mousedown', _startDrag);

    // 헤더 드래그 이동 — 버튼/리사이저는 제외
    const header = panel.querySelector('.cpmt-header');
    if (header) _bindTerminalDrag(header, panel);

    _panelEl = panel;
    return panel;
  }

  // ── Header drag (패널 자체 위치 이동) ──
  // folder-create-modal._bindModalDrag와 동일 패턴.
  // left/top inline style을 누적 갱신 → CSS의 right:0/bottom:0 무력화.
  // mousedown 시 panel의 현재 BoundingClientRect를 기준점으로 캐싱.
  function _bindTerminalDrag(header, panel) {
    header.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      // 닫기/재시작 버튼, 리사이저 클릭은 드래그 제외
      if (e.target.closest('.cpmt-btn, .cpmt-resizer')) return;
      e.preventDefault();
      // 현재 화면상 위치를 시작점으로 (right/bottom 기반이어도 정확)
      const rect = panel.getBoundingClientRect();
      const startX = e.clientX, startY = e.clientY;
      const startLeft = rect.left, startTop = rect.top;
      // right/bottom 제약 해제 전에 현재 width/height를 명시 — 레이아웃 보존
      // (top:64px;bottom:0 → height:836px 같은 식으로 고정)
      if (!panel.style.width) panel.style.width = rect.width + 'px';
      if (!panel.style.height) panel.style.height = rect.height + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      const onMove = (ev) => {
        _panelLeft = startLeft + (ev.clientX - startX);
        _panelTop  = startTop  + (ev.clientY - startY);
        panel.style.left = _panelLeft + 'px';
        panel.style.top  = _panelTop  + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (_fitAddon) {
          try { _fitAddon.fit(); _notifyResize(); } catch (_) {}
        }
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
    else if (action === 'restart') _restartSession();
  }

  // ── Resizer (좌측 핸들 드래그 → 패널 너비 변경) ──
  function _startDrag(e) {
    e.preventDefault();
    _dragging = true;
    document.addEventListener('mousemove', _onDrag);
    document.addEventListener('mouseup', _stopDrag);
  }
  function _onDrag(e) {
    if (!_dragging || !_panelEl) return;
    const newW = Math.min(900, Math.max(320, window.innerWidth - e.clientX));
    _panelEl.style.width = newW + 'px';
    try { localStorage.setItem('claudePMTerminalWidth', String(newW)); } catch (_) {}
    if (_fitAddon) {
      try { _fitAddon.fit(); } catch (_) {}
      _notifyResize();
    }
  }
  function _stopDrag() {
    _dragging = false;
    document.removeEventListener('mousemove', _onDrag);
    document.removeEventListener('mouseup', _stopDrag);
  }

  function _notifyResize() {
    if (!_term || !_sessionId) return;
    try {
      window.electronAPI?.claudePMTerminalResize?.(_sessionId, _term.cols, _term.rows);
    } catch (_) {}
  }

  async function _ensureTerm() {
    if (_term) return _term;
    if (!_ensureXtermLoaded()) {
      _setFooter('xterm.js 로드 실패 — vendor/xterm/xterm.js 확인 필요');
      return null;
    }
    const Terminal = window.Terminal;
    const FitAddon = window.FitAddon && window.FitAddon.FitAddon;
    _term = new Terminal({
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
    if (FitAddon) {
      _fitAddon = new FitAddon();
      _term.loadAddon(_fitAddon);
    }
    const body = _panelEl.querySelector('#cpmt-body');
    _term.open(body);
    if (_fitAddon) {
      try { _fitAddon.fit(); } catch (_) {}
    }
    _term.onData((data) => {
      if (_sessionId) {
        window.electronAPI?.claudePMTerminalWrite?.(_sessionId, data);
      }
    });
    // ResizeObserver — 패널 크기 변하면 fit
    if (typeof ResizeObserver !== 'undefined') {
      _resizeObs = new ResizeObserver(() => {
        if (_fitAddon) {
          try { _fitAddon.fit(); _notifyResize(); } catch (_) {}
        }
      });
      _resizeObs.observe(body);
    }
    return _term;
  }

  async function _startSession(folderPath) {
    if (!window.electronAPI?.claudePMTerminalStart) {
      _setFooter('electronAPI 없음');
      return false;
    }
    _setFooter('세션 시작 중…');
    const cols = _term?.cols || 80;
    const rows = _term?.rows || 24;
    const res = await window.electronAPI.claudePMTerminalStart({ folderPath, cols, rows });
    if (!res || !res.ok) {
      _setFooter('세션 실패: ' + (res?.error || 'unknown'));
      _term?.write(`\r\n\x1b[31m[error] ${res?.error || 'unknown'}\x1b[0m\r\n`);
      return false;
    }
    _sessionId = res.sessionId;
    _setFooter(`세션 ${_sessionId} · claude=${res.claudeBin || '?'}`);
    // 리스너
    _unsubData = window.electronAPI.onClaudePMTerminalData((p) => {
      if (!_term || p.sessionId !== _sessionId) return;
      _term.write(p.data);
    });
    _unsubExit = window.electronAPI.onClaudePMTerminalExit((p) => {
      if (p.sessionId !== _sessionId) return;
      _term?.write(`\r\n\x1b[33m[exit code=${p.code} signal=${p.signal || ''}]\x1b[0m\r\n`);
      _setFooter(`세션 종료 (code=${p.code})`);
      _sessionId = null;
    });
    return true;
  }

  async function _stopSession() {
    if (_unsubData) { try { _unsubData(); } catch (_) {} _unsubData = null; }
    if (_unsubExit) { try { _unsubExit(); } catch (_) {} _unsubExit = null; }
    if (_sessionId) {
      try { await window.electronAPI?.claudePMTerminalKill?.(_sessionId); } catch (_) {}
      _sessionId = null;
    }
  }

  async function _restartSession() {
    if (!_currentFolder) return;
    await _stopSession();
    _term?.clear();
    _term?.write(`\r\n\x1b[36m[restarting…]\x1b[0m\r\n`);
    await _startSession(_currentFolder);
  }

  function _setFooter(msg) {
    if (!_panelEl) return;
    const f = _panelEl.querySelector('#cpmt-footer');
    if (f) f.textContent = msg;
  }

  // ── public ──
  async function openClaudePMTerminalPanel({ folderPath } = {}) {
    if (!folderPath) {
      if (typeof window.showToast === 'function') window.showToast('💻 폴더 경로 필요');
      return;
    }
    // mutex — 다른 패널 닫기
    try { window.closeAiPrompt?.(); } catch (_) {}
    try { window.closeClaudePMPanel?.(); } catch (_) {}

    _ensurePanelDOM();
    // 저장된 width 복원
    try {
      const w = parseInt(localStorage.getItem('claudePMTerminalWidth') || '480', 10);
      if (w > 0) _panelEl.style.width = w + 'px';
    } catch (_) {}
    _panelEl.style.display = 'flex';
    requestAnimationFrame(() => _panelEl.classList.add('cpmt-open'));

    const folderEl = _panelEl.querySelector('#cpmt-folder');
    if (folderEl) folderEl.textContent = folderPath;

    _currentFolder = folderPath;

    await _ensureTerm();

    // 기존 세션이 있고 같은 폴더면 재사용, 아니면 새로 시작
    if (_sessionId) {
      // 폴더 바뀌었으면 stop 후 새로
      await _stopSession();
      _term?.clear();
    }
    await _startSession(folderPath);

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
    // 세션은 유지하지 말고 종료 — 의도: 닫을 때 claude 프로세스 정리
    await _stopSession();
  }

  function _bindEsc() {
    if (_escHandler) return;
    _escHandler = (e) => {
      if (e.key !== 'Escape') return;
      // xterm focus 중이면 ESC 전달 (claude 내부에서 사용)
      if (_term && document.activeElement && _panelEl?.contains(document.activeElement)) return;
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

  window.openClaudePMTerminalPanel  = openClaudePMTerminalPanel;
  window.closeClaudePMTerminalPanel = closeClaudePMTerminalPanel;
})();
