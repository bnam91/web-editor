// main/claude-pm/ipc.js — Claude PM IPC 핸들러 모음
// feature/claude-pm — Phase 2 (IPC + UI 배선)
//
// 5개 IPC 채널을 한 곳에 모아 main.js 비대화를 막는다.
//   - claudePM:pickDirectory   : OS 경로 선택기
//   - claudePM:createFolder    : 폴더 + CLAUDE.md + .mcp.json 생성 (PM-B template-generator 위임)
//   - claudePM:openInFinder    : shell.openPath
//   - claudePM:spawnClaudeTerminal : 외부 Terminal.app에서 claude code 실행
//   - claudePM:pingMcp         : MCP 헬스체크 (9345 HTTP)
//
// PM-B(template-generator) / PM-C(mcp-server) 모듈은 require try/catch graceful fail.

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { dialog, shell } = require('electron');
const { spawn } = require('child_process');

let MCP_PORT = 9345; // EADDRINUSE fallback 시 main.js가 setActualMcpPort()로 갱신
function setActualMcpPort(p) {
  if (typeof p === 'number' && p > 0) MCP_PORT = p;
}
function _mcpHealthUrl() {
  return `http://localhost:${MCP_PORT}/health`;
}

// ── 경로 헬퍼 ────────────────────────────────
// '~/Documents/foo' → '/Users/.../Documents/foo'
function expandHome(p) {
  if (!p) return p;
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  if (p === '~') return os.homedir();
  return p;
}

function sanitizeFolderName(name) {
  const s = String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
  // Path traversal 방어: 비어있음 / 점 만으로 구성 / 슬래시 잔존 reject
  if (!s) return null;
  if (/^\.+$/.test(s)) return null;
  if (s.includes('/') || s.includes('\\')) return null;
  return s;
}

// projectId 검증 — 폴더 segment로 안전한지 (slash / dot-only / empty reject)
// Goditor projectId 형식: `proj_1779417058530` — 정상이면 통과
function sanitizeProjectId(pid) {
  const s = String(pid || '').trim();
  if (!s) return null;
  if (/^\.+$/.test(s)) return null;
  if (s.includes('/') || s.includes('\\')) return null;
  if (s.includes('\0')) return null;
  return s;
}

// ── PM-B / PM-C 동적 로드 (graceful fail) ──
// PM-B는 .mjs (ES module) — host가 CommonJS이므로 await import() 사용
// PM-C는 .js (CommonJS) — require로 OK
async function _tryImportTemplateGenerator() {
  try {
    const mod = await import('./template-generator.mjs');
    return mod;
  } catch (e) {
    return null;
  }
}
function _tryRequireMcpServer() {
  try {
    return require('./mcp-server');
  } catch (e) {
    return null;
  }
}

// ── 핸들러 ────────────────────────────────────

async function handlePickDirectory(_e, { defaultPath } = {}) {
  try {
    const opts = {
      title: 'Claude PM 기본 경로 선택',
      properties: ['openDirectory', 'createDirectory'],
    };
    if (defaultPath) {
      const expanded = expandHome(defaultPath);
      if (fs.existsSync(expanded)) opts.defaultPath = expanded;
    }
    const result = await dialog.showOpenDialog(opts);
    if (result.canceled || !result.filePaths || !result.filePaths.length) {
      return { ok: false, canceled: true };
    }
    return { ok: true, path: result.filePaths[0] };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleCreateFolder(_e, { basePath, projectName, projectId } = {}) {
  try {
    if (!basePath || !projectName) {
      return { ok: false, error: 'basePath / projectName 누락' };
    }
    const safeName = sanitizeFolderName(projectName);
    if (!safeName) return { ok: false, error: '프로젝트명이 유효하지 않습니다.' };

    const expandedBase = path.resolve(expandHome(basePath));
    const folderPath = path.resolve(expandedBase, safeName);

    // Path traversal 2차 방어: 정규화 후 base 밖 탈출 reject
    if (!folderPath.startsWith(expandedBase + path.sep) && folderPath !== expandedBase) {
      return { ok: false, error: '경로가 base 밖으로 벗어납니다.' };
    }

    if (!fs.existsSync(expandedBase)) {
      fs.mkdirSync(expandedBase, { recursive: true });
    }
    if (fs.existsSync(folderPath)) {
      return { ok: false, error: '이미 같은 이름의 폴더가 존재합니다.', folderPath };
    }

    // PM-B template-generator (.mjs ES module) — 있으면 위임, 없으면 fallback
    // PM-B의 generateFolder는 basePath 자체를 폴더로 사용 → folderPath 그대로 전달
    const tg = await _tryImportTemplateGenerator();
    const generated = { claudeMd: false, mcpJson: false };

    if (tg && typeof tg.generateFolder === 'function') {
      try {
        const result = await tg.generateFolder({ basePath: folderPath, projectName: safeName, projectId });
        generated.claudeMd = true;
        generated.mcpJson = true;
        generated.viaTemplateGenerator = true;
        // PM-B가 반환한 실제 folderPath 우선 사용
        if (result?.folderPath) {
          return { ok: true, folderPath: result.folderPath, generated };
        }
      } catch (e) {
        return { ok: false, error: `template-generator 실패: ${e.message}`, folderPath };
      }
    } else {
      fs.mkdirSync(folderPath, { recursive: true });
      // Fallback — 최소한 .mcp.json은 만들어두자 (PM-C MCP 서버 인식용)
      try {
        const mcpJson = {
          mcpServers: {
            'goditor-pm': {
              type: 'http',
              url: `http://localhost:${MCP_PORT}`,
            },
          },
        };
        fs.writeFileSync(
          path.join(folderPath, '.mcp.json'),
          JSON.stringify(mcpJson, null, 2),
          'utf8'
        );
        generated.mcpJson = true;
        // CLAUDE.md placeholder
        fs.writeFileSync(
          path.join(folderPath, 'CLAUDE.md'),
          `# ${safeName}\n\n(Phase 2 placeholder — PM-B template-generator 미구현)\n`,
          'utf8'
        );
        generated.claudeMd = true;
        generated.viaFallback = true;
      } catch (e) {
        return { ok: false, error: `fallback 파일 생성 실패: ${e.message}`, folderPath };
      }
    }

    // PM-C MCP 서버는 app.whenReady 시점에 main.js에서 이미 시작됨.
    // 여기서는 시작하지 않음 (서버는 1회만 listen).

    return { ok: true, folderPath, generated };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleOpenInFinder(_e, { folderPath } = {}) {
  try {
    if (!folderPath) return { ok: false, error: 'folderPath 누락' };
    const expanded = expandHome(folderPath);
    if (!fs.existsSync(expanded)) {
      return { ok: false, error: '폴더가 존재하지 않습니다.' };
    }
    const err = await shell.openPath(expanded);
    if (err) return { ok: false, error: err };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleSpawnClaudeTerminal(_e, { folderPath } = {}) {
  try {
    if (!folderPath) return { ok: false, error: 'folderPath 누락' };
    const expanded = expandHome(folderPath);
    if (!fs.existsSync(expanded)) {
      return { ok: false, error: '폴더가 존재하지 않습니다.' };
    }

    // 외부 Terminal.app 우선 (xterm 임베드는 Phase 3)
    if (process.platform === 'darwin') {
      // osascript로 Terminal.app에 cd && claude 명령 전달
      const cmd = `cd "${expanded.replace(/"/g, '\\"')}" && claude`;
      const osa = `tell application "Terminal" to do script "${cmd.replace(/"/g, '\\"')}"`;
      const child = spawn('osascript', ['-e', osa], { detached: true, stdio: 'ignore' });
      child.unref();
      return { ok: true, mode: 'terminal.app' };
    }
    if (process.platform === 'win32') {
      const child = spawn('cmd', ['/c', 'start', 'cmd', '/k', `cd /d "${expanded}" && claude`], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return { ok: true, mode: 'cmd' };
    }
    // linux fallback — x-terminal-emulator
    const child = spawn('x-terminal-emulator', ['-e', `bash -c 'cd "${expanded}" && claude; exec bash'`], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return { ok: true, mode: 'linux-terminal' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── ensureFolder: 모든 Goditor 프로젝트가 PM 폴더를 항상 보유하도록 보장 ──
// 입력: {projectId, projectName, basePath?}
// 동작:
//   1. basePath 미지정 시 '~/Documents/claude-pm-projects/' 사용
//   2. sanitize(projectName) → 같은 이름 폴더 있고 그 안 project.meta.json의 id가 일치하면 재사용 (created:false)
//   3. 같은 이름이지만 id 불일치 → '__<projectId-short>' suffix 붙여 새 폴더
//   4. 폴더 없으면 generateFolder로 신규 생성 (PM-B 위임, projectId 전달)
//   5. return {ok, folderPath, created, reused}
// 호출 측은 결과를 localStorage에 캐싱 가능 (renderer가 책임).
// base 내 폴더들 scan → project.meta.json.id가 projectId와 일치하는 폴더 반환
// 사용자가 프로젝트명을 변경해도 같은 폴더를 reuse하기 위함 (이름과 무관하게 ID 기반)
function _findFolderByProjectId(base, projectId) {
  if (!fs.existsSync(base)) return null;
  let entries;
  try { entries = fs.readdirSync(base); } catch (_) { return null; }
  for (const name of entries) {
    if (name.startsWith('.')) continue;
    const dir = path.join(base, name);
    try {
      // lstatSync: symlink 자체로 인식 → isDirectory()=false → skip (symlink escape 방어)
      const st = fs.lstatSync(dir);
      if (!st.isDirectory()) continue;
      const metaP = path.join(dir, 'project.meta.json');
      if (!fs.existsSync(metaP)) continue;
      const m = JSON.parse(fs.readFileSync(metaP, 'utf8'));
      if (m && m.id === projectId) return dir;
    } catch (_) { /* skip */ }
  }
  return null;
}

// _repairFolder: meta/CLAUDE/NOTES/.mcp/archive 누락 보완 (이미 있는 파일 보존)
function _repairFolder(folder, projectId, safeName) {
  const repaired = [];
  const metaPath = path.join(folder, 'project.meta.json');
  const claudeP = path.join(folder, 'CLAUDE.md');
  const notesP = path.join(folder, 'NOTES.md');
  const mcpP = path.join(folder, '.mcp.json');
  const archP = path.join(folder, 'archive');
  try {
    if (!fs.existsSync(archP)) { fs.mkdirSync(archP, { recursive: true }); repaired.push('archive'); }
    let meta = null;
    if (fs.existsSync(metaPath)) { try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch (_) {} }
    const now = new Date().toISOString();
    if (!meta) {
      meta = { id: projectId, title: safeName, createdAt: now, updatedAt: now };
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
      repaired.push('project.meta.json');
    } else if (!meta.id) {
      meta.id = projectId; meta.updatedAt = now;
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n', 'utf8');
      repaired.push('project.meta.json(id-patch)');
    }
    if (!fs.existsSync(claudeP)) {
      fs.writeFileSync(claudeP, `# ${safeName}\n\n(auto-ensure: regenerated placeholder)\n`, 'utf8');
      repaired.push('CLAUDE.md');
    }
    if (!fs.existsSync(notesP)) {
      fs.writeFileSync(notesP, '# Notes\n\n## Preferences\n- \n\n## Constraints\n- \n\n## Decisions (원문)\n- \n\n## Feedback\n- \n', 'utf8');
      repaired.push('NOTES.md');
    }
    if (!fs.existsSync(mcpP)) {
      fs.writeFileSync(mcpP, JSON.stringify({ mcpServers: { 'goditor-pm': { type: 'http', url: `http://localhost:${MCP_PORT}` } } }, null, 2), 'utf8');
      repaired.push('.mcp.json');
    }
  } catch (_) {}
  return repaired;
}

// ── ensureFolder (A 패턴: 폴더명 = projectId, Goditor JSON 패턴 일관성) ──
// 흐름:
//   [1] <base>/<projectId> 폴더 있으면 reuse (또는 repair)
//   [2] 옛 이름 폴더 (legacy) → _findFolderByProjectId로 발견 시 reuse
//   [3] 둘 다 없으면 신규 <base>/<projectId> 생성
//
// 프로젝트명 변경되어도 폴더명은 그대로 (projectId 기반).
// 옛 이름 폴더(예: Untitled, 두장군)는 호환성 유지 — 자연 소멸 또는 수동 마이그레이션.
async function handleEnsureClaudePMFolder(_e, { projectId, projectName, basePath } = {}) {
  try {
    if (!projectId || !projectName) {
      return { ok: false, error: 'projectId / projectName 누락' };
    }
    const safePid = sanitizeProjectId(projectId);
    if (!safePid) return { ok: false, error: 'projectId 형식이 유효하지 않습니다.' };
    const safeName = sanitizeFolderName(projectName);
    if (!safeName) return { ok: false, error: '프로젝트명이 유효하지 않습니다.' };

    const base = basePath
      ? path.resolve(expandHome(basePath))
      : path.resolve(expandHome('~/Documents/claude-pm-projects'));

    if (!fs.existsSync(base)) {
      fs.mkdirSync(base, { recursive: true });
    }

    // [1] <base>/<projectId> 폴더 — sanitized id로 segment 안전
    const idFolder = path.resolve(base, safePid);
    if (!idFolder.startsWith(base + path.sep)) {
      return { ok: false, error: '경로가 base 밖으로 벗어납니다.' };
    }
    if (fs.existsSync(idFolder)) {
      const metaPath = path.join(idFolder, 'project.meta.json');
      let existingId = null;
      try {
        if (fs.existsSync(metaPath)) {
          existingId = JSON.parse(fs.readFileSync(metaPath, 'utf8'))?.id || null;
        }
      } catch (_) {}
      if (existingId === safePid) {
        return { ok: true, folderPath: idFolder, created: false, reused: true };
      }
      // truthy mismatch — 다른 프로젝트가 이 ID를 차지함. 안전을 위해 reject + 수동 정리 안내.
      if (existingId && existingId !== safePid) {
        return {
          ok: false,
          error: `폴더 ${safePid}의 meta가 다른 프로젝트(${existingId})에 속합니다. 수동 정리 필요.`,
          folderPath: idFolder,
          mismatchId: existingId,
        };
      }
      // meta 손상 또는 id 없음 → repair (사용자 편집 보존)
      const repaired = _repairFolder(idFolder, safePid, safeName);
      return { ok: true, folderPath: idFolder, created: false, repaired };
    }

    // [2] 옛 이름 폴더 (legacy migration) — base 안 projectId 매칭 폴더 찾기
    const legacy = _findFolderByProjectId(base, safePid);
    if (legacy) {
      return { ok: true, folderPath: legacy, created: false, reused: true, viaIdLookup: true, legacyName: true };
    }

    // [3] 신규 생성 — <base>/<projectId> 폴더 (Goditor JSON 패턴)
    const folderPath = idFolder;

    // 신규 생성
    const tg = await _tryImportTemplateGenerator();
    if (tg && typeof tg.generateFolder === 'function') {
      try {
        const result = await tg.generateFolder({ basePath: folderPath, projectName: safeName, projectId });
        return { ok: true, folderPath: result?.folderPath || folderPath, created: true };
      } catch (e) {
        return { ok: false, error: `template-generator 실패: ${e.message}`, folderPath };
      }
    }
    // Fallback (PM-B 미로드)
    try {
      fs.mkdirSync(folderPath, { recursive: true });
      fs.writeFileSync(
        path.join(folderPath, 'CLAUDE.md'),
        `# ${safeName}\n\n(auto-ensure fallback — PM-B 미로드)\n`,
        'utf8'
      );
      fs.writeFileSync(
        path.join(folderPath, 'project.meta.json'),
        JSON.stringify({ id: projectId, title: safeName, createdAt: new Date().toISOString() }, null, 2),
        'utf8'
      );
      fs.writeFileSync(
        path.join(folderPath, '.mcp.json'),
        JSON.stringify({
          mcpServers: { 'goditor-pm': { type: 'http', url: `http://localhost:${MCP_PORT}` } },
        }, null, 2),
        'utf8'
      );
      return { ok: true, folderPath, created: true, viaFallback: true };
    } catch (e) {
      return { ok: false, error: `fallback 생성 실패: ${e.message}`, folderPath };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handleSetActiveProject(_e, { projectId } = {}) {
  try {
    // main.js의 startMcpServer({onActiveProject: () => global.currentActiveProjectId})가 이걸 읽음
    global.currentActiveProjectId = projectId || null;
    return { ok: true, projectId: global.currentActiveProjectId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function handlePingMcp(_e) {
  try {
    // Node 18+ global fetch (Electron 26+에 포함됨). 짧은 timeout.
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    try {
      const r = await fetch(_mcpHealthUrl(), { signal: ctl.signal });
      clearTimeout(t);
      return { ok: true, connected: r.ok, status: r.status };
    } catch (e) {
      clearTimeout(t);
      return { ok: true, connected: false, error: e.message };
    }
  } catch (err) {
    return { ok: false, connected: false, error: err.message };
  }
}

// ── 등록 진입점 ──────────────────────────────
function registerClaudePMIPC(ipcMain) {
  ipcMain.handle('claudePM:pickDirectory', handlePickDirectory);
  ipcMain.handle('claudePM:createFolder', handleCreateFolder);
  ipcMain.handle('claudePM:openInFinder', handleOpenInFinder);
  ipcMain.handle('claudePM:spawnClaudeTerminal', handleSpawnClaudeTerminal);
  ipcMain.handle('claudePM:pingMcp', handlePingMcp);
  ipcMain.handle('claudePM:setActiveProject', handleSetActiveProject);
  ipcMain.handle('claudePM:ensureFolder', handleEnsureClaudePMFolder);
}

module.exports = {
  registerClaudePMIPC,
  setActualMcpPort,
  // 테스트/디버깅용 export
  _internal: {
    expandHome,
    sanitizeFolderName,
    get MCP_PORT() { return MCP_PORT; },
  },
};
