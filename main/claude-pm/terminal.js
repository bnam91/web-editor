// main/claude-pm/terminal.js — 내부 터미널 패널 PTY 백엔드
// feature/claude-pm — Phase 3 (F8: 내부 터미널 패널)
//
// child_process.spawn으로 셸을 띄우고 stdout/stderr를 webContents.send로 흘려보낸다.
// node-pty가 아니므로 raw mode / 컬러 ANSI는 제한적. claude code는 line-buffered로 동작 OK.
// Phase 4에서 node-pty 업그레이드 예정.
//
// IPC 채널:
//   claudePM:terminal:start  → { folderPath, cols?, rows? } → { ok, sessionId }
//   claudePM:terminal:write  → { sessionId, data }          → { ok }
//   claudePM:terminal:resize → { sessionId, cols, rows }    → { ok } (no-op for child_process)
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

// sessionId → { child, folderPath, createdAt }
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
  // claude 풀패스 — Mac에서 .zshrc/.bash_profile 안 거쳐도 잡히도록
  const candidates = [
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
    path.join(os.homedir(), '.claude/local/claude'),
    path.join(os.homedir(), '.local/bin/claude'),
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch (_) {}
  }
  return 'claude'; // PATH fallback
}

function _resolveShell() {
  if (process.platform === 'win32') return process.env.COMSPEC || 'cmd.exe';
  return process.env.SHELL || '/bin/zsh';
}

function _broadcast(channel, payload) {
  // 모든 BrowserWindow에 broadcast — main 윈도우 1개라 사실상 그쪽만
  const wins = BrowserWindow.getAllWindows();
  for (const w of wins) {
    try {
      if (!w.isDestroyed()) w.webContents.send(channel, payload);
    } catch (_) {}
  }
}

function startTerminalSession({ folderPath, cols, rows } = {}) {
  try {
    const expanded = expandHome(folderPath);
    if (!expanded || !fs.existsSync(expanded)) {
      return { ok: false, error: 'folderPath 미존재' };
    }

    const sessionId = _newSessionId();
    const claudeBin = _resolveClaudeBin();
    const shell = _resolveShell();

    // claude 실행. claude 없으면 셸로 fallback 가능하지만 일단 claude 직접.
    // child_process.spawn은 PTY가 아니므로 claude의 raw-mode TUI는 제한적이지만
    // line mode로 prompt/응답 동작은 가능.
    let child;
    if (process.platform === 'win32') {
      child = spawn(shell, ['/c', `cd /d "${expanded}" && "${claudeBin}"`], {
        cwd: expanded,
        env: { ...process.env, TERM: 'xterm-256color' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } else {
      // bash -lc로 로그인 셸 환경 끌어쓰기
      child = spawn(shell, ['-lc', `"${claudeBin}"`], {
        cwd: expanded,
        env: { ...process.env, TERM: 'xterm-256color', COLUMNS: String(cols || 80), LINES: String(rows || 24) },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (data) => {
      _broadcast('claudePM:terminal:data', { sessionId, data: String(data) });
    });
    child.stderr.on('data', (data) => {
      _broadcast('claudePM:terminal:data', { sessionId, data: String(data) });
    });
    child.on('error', (err) => {
      _broadcast('claudePM:terminal:data', { sessionId, data: `\r\n[spawn error] ${err.message}\r\n` });
    });
    child.on('exit', (code, signal) => {
      _broadcast('claudePM:terminal:exit', { sessionId, code, signal });
      _sessions.delete(sessionId);
    });

    _sessions.set(sessionId, { child, folderPath: expanded, createdAt: Date.now() });
    return { ok: true, sessionId, claudeBin };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function writeToTerminal({ sessionId, data } = {}) {
  const s = _sessions.get(sessionId);
  if (!s) return { ok: false, error: 'session 없음' };
  try {
    s.child.stdin.write(String(data || ''));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function resizeTerminal({ sessionId, cols, rows } = {}) {
  // child_process로는 진짜 resize 불가 — env COLUMNS/LINES만 갱신
  const s = _sessions.get(sessionId);
  if (!s) return { ok: false, error: 'session 없음' };
  // 일부 프로그램은 SIGWINCH를 기대하나 PTY 없으므로 no-op.
  return { ok: true, noop: true };
}

function killTerminal({ sessionId } = {}) {
  const s = _sessions.get(sessionId);
  if (!s) return { ok: false, error: 'session 없음' };
  try {
    s.child.kill('SIGTERM');
    // 0.5초 안에 안 죽으면 SIGKILL
    setTimeout(() => {
      try { if (!s.child.killed) s.child.kill('SIGKILL'); } catch (_) {}
    }, 500);
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
};
