// main/claude-pm/terminal.js — 내부 터미널 패널 PTY 백엔드
// feature/claude-pm — Phase 4 (node-pty 도입)
//
// 1순위: node-pty(진짜 PTY, raw TTY, SIGWINCH 지원)
// 2순위: child_process.spawn fallback (node-pty 모듈 require 실패 시 — 빌드 실패/ABI 불일치 등)
//
// IPC 채널:
//   claudePM:terminal:start  → { folderPath, cols?, rows? } → { ok, sessionId, backend }
//   claudePM:terminal:write  → { sessionId, data }          → { ok }
//   claudePM:terminal:resize → { sessionId, cols, rows }    → { ok }
//   claudePM:terminal:kill   → { sessionId }                → { ok }
//
// 이벤트 (mainWindow.webContents.send):
//   claudePM:terminal:data { sessionId, data }
//   claudePM:terminal:exit { sessionId, code, signal }

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { BrowserWindow } = require('electron');

// ── node-pty 로드 시도 (실패 시 child_process fallback) ───────────────────────
let pty = null;
let ptyLoadError = null;
try {
  // eslint-disable-next-line global-require
  pty = require('node-pty');
  if (!pty || typeof pty.spawn !== 'function') {
    ptyLoadError = 'node-pty exported invalid pty.spawn';
    pty = null;
  }
} catch (err) {
  ptyLoadError = err && err.message ? err.message : String(err);
  pty = null;
}

// sessionId → { proc, backend: 'pty'|'cp', folderPath, createdAt, listeners: [] }
const _sessions = new Map();

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  if (p === '~') return os.homedir();
  return p;
}

function _newSessionId() {
  return crypto.randomBytes(4).toString('hex');
}

function _resolveClaudeBin() {
  const candidates = [
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    path.join(os.homedir(), '.claude/local/claude'),
    path.join(os.homedir(), '.local/bin/claude'),
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch (_) {}
  }
  return 'claude';
}

function _resolveShell() {
  if (process.platform === 'win32') return process.env.COMSPEC || 'powershell.exe';
  return process.env.SHELL || '/bin/zsh';
}

function _broadcast(channel, payload) {
  const wins = BrowserWindow.getAllWindows();
  for (const w of wins) {
    try {
      if (!w.isDestroyed()) w.webContents.send(channel, payload);
    } catch (_) {}
  }
}

// shell-safe single-quote escape (POSIX): ' → '\''
function _shEscape(s) {
  if (s == null) return "''";
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}

// PowerShell single-quoted literal escape: ' → ''
function _psEscape(s) {
  if (s == null) return "''";
  return "'" + String(s).replace(/'/g, "''") + "'";
}

// cmd.exe double-quoted escape: " → "" , strip CR/LF, ban known meta if found
function _cmdEscape(s) {
  if (s == null) return '""';
  return '"' + String(s).replace(/["\r\n]/g, '') + '"';
}

function _baseEnv(cols, rows) {
  return {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    LANG: process.env.LANG || 'en_US.UTF-8',
    COLUMNS: String(cols || 80),
    LINES: String(rows || 24),
  };
}

// ── node-pty 기반 세션 시작 ──────────────────────────────────────────────────
function _startPtySession({ folderPath, cols, rows, sessionId }) {
  const claudeBin = _resolveClaudeBin();
  const shell = _resolveShell();
  const env = _baseEnv(cols, rows);

  let proc;
  if (process.platform === 'win32') {
    // PowerShell: cd 후 claude 실행. Set-Location -LiteralPath 로 와일드카드 회피, 작은따옴표 리터럴로 보간 차단.
    const psCmd = `Set-Location -LiteralPath ${_psEscape(folderPath)}; & ${_psEscape(claudeBin)}`;
    proc = pty.spawn(shell, ['-NoLogo', '-NoProfile', '-Command', psCmd], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: folderPath,
      env,
    });
  } else {
    // login shell + -c, 인자는 shell-escape
    // claude 실행. claude 종료 후에도 셸은 안 띄움 (exec 안 함 — claude만 끝나면 세션도 종료).
    const cmd = `cd ${_shEscape(folderPath)} && exec ${_shEscape(claudeBin)}`;
    proc = pty.spawn(shell, ['-l', '-c', cmd], {
      name: 'xterm-256color',
      cols: cols || 80,
      rows: rows || 24,
      cwd: folderPath,
      env,
    });
  }

  const onDataDisposable = proc.onData((data) => {
    _broadcast('claudePM:terminal:data', { sessionId, data: String(data) });
  });
  const onExitDisposable = proc.onExit(({ exitCode, signal }) => {
    _broadcast('claudePM:terminal:exit', { sessionId, code: exitCode, signal: signal || null });
    // listener 정리
    try { onDataDisposable && onDataDisposable.dispose && onDataDisposable.dispose(); } catch (_) {}
    try { onExitDisposable && onExitDisposable.dispose && onExitDisposable.dispose(); } catch (_) {}
    _sessions.delete(sessionId);
  });

  _sessions.set(sessionId, {
    proc,
    backend: 'pty',
    folderPath,
    createdAt: Date.now(),
    listeners: [onDataDisposable, onExitDisposable],
  });

  return { ok: true, sessionId, backend: 'pty', claudeBin };
}

// ── child_process fallback ───────────────────────────────────────────────────
function _startCpSession({ folderPath, cols, rows, sessionId }) {
  const claudeBin = _resolveClaudeBin();
  const shell = _resolveShell();
  const env = _baseEnv(cols, rows);

  let child;
  if (process.platform === 'win32') {
    // cmd.exe: 큰따옴표 escape + CR/LF strip. cwd 옵션이 이미 들어가므로 cd는 생략.
    child = spawn(shell, ['/c', `${_cmdEscape(claudeBin)}`], {
      cwd: folderPath, env, stdio: ['pipe', 'pipe', 'pipe'],
    });
  } else {
    const cmd = `cd ${_shEscape(folderPath)} && exec ${_shEscape(claudeBin)}`;
    child = spawn(shell, ['-lc', cmd], {
      cwd: folderPath, env, stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  const onStdout = (data) => _broadcast('claudePM:terminal:data', { sessionId, data: String(data) });
  const onStderr = (data) => _broadcast('claudePM:terminal:data', { sessionId, data: String(data) });
  const onError = (err) => _broadcast('claudePM:terminal:data', { sessionId, data: `\r\n[spawn error] ${err.message}\r\n` });
  const onExit = (code, signal) => {
    _broadcast('claudePM:terminal:exit', { sessionId, code, signal });
    try { child.stdout.off('data', onStdout); } catch (_) {}
    try { child.stderr.off('data', onStderr); } catch (_) {}
    try { child.off('error', onError); } catch (_) {}
    _sessions.delete(sessionId);
  };

  child.stdout.on('data', onStdout);
  child.stderr.on('data', onStderr);
  child.on('error', onError);
  child.on('exit', onExit);

  _sessions.set(sessionId, {
    proc: child,
    backend: 'cp',
    folderPath,
    createdAt: Date.now(),
    listeners: [],
  });

  return { ok: true, sessionId, backend: 'cp', claudeBin, ptyError: ptyLoadError };
}

// ── 공개 API ─────────────────────────────────────────────────────────────────
function startTerminalSession({ folderPath, cols, rows } = {}) {
  try {
    const expanded = expandHome(folderPath);
    if (!expanded || !fs.existsSync(expanded)) {
      return { ok: false, error: 'folderPath 미존재' };
    }
    const sessionId = _newSessionId();
    const args = { folderPath: expanded, cols, rows, sessionId };

    if (pty) {
      try {
        return _startPtySession(args);
      } catch (err) {
        // pty 런타임 에러 (ABI 불일치 등) → fallback
        ptyLoadError = `pty.spawn runtime: ${err.message}`;
        pty = null;
        // fallthrough
      }
    }
    return _startCpSession(args);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function writeToTerminal({ sessionId, data } = {}) {
  const s = _sessions.get(sessionId);
  if (!s) return { ok: false, error: 'session 없음' };
  try {
    if (s.backend === 'pty') {
      s.proc.write(String(data || ''));
    } else {
      s.proc.stdin.write(String(data || ''));
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function resizeTerminal({ sessionId, cols, rows } = {}) {
  const s = _sessions.get(sessionId);
  if (!s) return { ok: false, error: 'session 없음' };
  try {
    if (s.backend === 'pty' && typeof s.proc.resize === 'function') {
      s.proc.resize(Math.max(1, cols | 0) || 80, Math.max(1, rows | 0) || 24);
      return { ok: true };
    }
    // child_process: PTY 없음 → no-op
    return { ok: true, noop: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function killTerminal({ sessionId } = {}) {
  const s = _sessions.get(sessionId);
  if (!s) return { ok: false, error: 'session 없음' };
  try {
    if (s.backend === 'pty') {
      try { s.proc.kill('SIGTERM'); } catch (_) {}
    } else {
      try { s.proc.kill('SIGTERM'); } catch (_) {}
    }
    // SIGTERM 후 1초 안에 onExit이 _sessions에서 제거 안 했으면 SIGKILL + 강제 정리
    setTimeout(() => {
      if (!_sessions.has(sessionId)) return; // 이미 onExit이 정리 완료
      try {
        if (s.backend === 'pty') {
          s.proc.kill('SIGKILL');
        } else if (!s.proc.killed) {
          s.proc.kill('SIGKILL');
        }
      } catch (_) {}
      // 강제 종료 후에도 onExit이 안 오는 케이스 대비: listener dispose + 세션 제거
      setTimeout(() => {
        if (!_sessions.has(sessionId)) return;
        if (Array.isArray(s.listeners)) {
          for (const d of s.listeners) {
            try { d && d.dispose && d.dispose(); } catch (_) {}
          }
        }
        _broadcast('claudePM:terminal:exit', { sessionId, code: null, signal: 'SIGKILL' });
        _sessions.delete(sessionId);
      }, 500);
    }, 1000);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function killAllSessions() {
  for (const [id] of _sessions) {
    try { killTerminal({ sessionId: id }); } catch (_) {}
  }
  _sessions.clear();
}

function registerTerminalIPC(ipcMain) {
  ipcMain.handle('claudePM:terminal:start',  (_e, args) => startTerminalSession(args || {}));
  ipcMain.handle('claudePM:terminal:write',  (_e, args) => writeToTerminal(args || {}));
  ipcMain.handle('claudePM:terminal:resize', (_e, args) => resizeTerminal(args || {}));
  ipcMain.handle('claudePM:terminal:kill',   (_e, args) => killTerminal(args || {}));
}

module.exports = {
  registerTerminalIPC,
  startTerminalSession,
  writeToTerminal,
  resizeTerminal,
  killTerminal,
  killAllSessions,
  // 진단용
  _getBackendInfo: () => ({ ptyAvailable: !!pty, ptyLoadError, sessionCount: _sessions.size }),
};
