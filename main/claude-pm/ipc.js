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
const { app, dialog, shell } = require('electron');
const { spawn } = require('child_process');

// ── userData 기반 PM basePath helper (lazy) ──
// app.getPath('userData')는 app.whenReady 이후에만 안전.
// 모듈 require 시점이 아니라 핸들러 실행 시점에 호출되도록 함수로 감쌈.
//
// 결정 (2026-05-22): PM 폴더를 Goditor 프로젝트 디렉터리 안으로 통합.
//   신규 경로: <userData>/projects/<projectId>/claude-pm/
//   legacy:    ~/Documents/claude-pm-projects/<projectId>/
function _getUserDataDir() {
  try {
    return app.getPath('userData');
  } catch (_) {
    // app.ready 전 호출 — 폴백 (실제론 IPC 호출 시점엔 ready 보장됨)
    return path.join(os.homedir(), 'Library', 'Application Support', 'Goya Design Editor');
  }
}

// 신규 PM 폴더 경로: <userData>/projects/<projectId>/claude-pm
function _defaultPmFolderPath(projectId) {
  return path.join(_getUserDataDir(), 'projects', projectId, 'claude-pm');
}

// legacy base — 옛 PM 폴더 부모 (~/Documents/claude-pm-projects)
function _legacyBasePath() {
  return path.join(os.homedir(), 'Documents', 'claude-pm-projects');
}

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

// ── 디렉터리 재귀 복사 (마이그레이션용, 덮어쓰기 방지) ──
// dst에 같은 파일이 이미 존재하면 skip (사용자 편집 보존).
function _copyDirSafe(src, dst) {
  const copied = [];
  const skipped = [];
  if (!fs.existsSync(src)) return { copied, skipped };
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const ent of entries) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) {
      const sub = _copyDirSafe(s, d);
      copied.push(...sub.copied);
      skipped.push(...sub.skipped);
    } else if (ent.isFile()) {
      if (fs.existsSync(d)) {
        skipped.push(ent.name);
      } else {
        try { fs.copyFileSync(s, d); copied.push(ent.name); } catch (_) {}
      }
    }
  }
  return { copied, skipped };
}

// ── ensureFolder (신 패턴: <userData>/projects/<projectId>/claude-pm/) ──
// 흐름:
//   [0] basePath 명시 → 사용자 override 그대로 사용 (이전 호환)
//   [1] 신규 경로 <userData>/projects/<projectId>/claude-pm 있으면 reuse (또는 repair)
//   [2] legacy 경로 (~/Documents/claude-pm-projects/<projectId> 또는 옛 이름 폴더) 발견 시
//       → 신규 경로로 자동 copy migration + flag 반환 (legacy는 보존)
//   [3] 둘 다 없으면 신규 <userData>/projects/<projectId>/claude-pm 생성
//
// 프로젝트명 변경되어도 폴더 위치는 그대로 (projectId 기반).
async function handleEnsureClaudePMFolder(_e, { projectId, projectName, basePath } = {}) {
  try {
    if (!projectId || !projectName) {
      return { ok: false, error: 'projectId / projectName 누락' };
    }
    const safePid = sanitizeProjectId(projectId);
    if (!safePid) return { ok: false, error: 'projectId 형식이 유효하지 않습니다.' };
    const safeName = sanitizeFolderName(projectName);
    if (!safeName) return { ok: false, error: '프로젝트명이 유효하지 않습니다.' };

    // [0] basePath override (사용자가 모달에서 직접 지정한 경우)
    //     basePath 자체를 PM 폴더로 사용 (예전 호환). projectId segment 안 붙임.
    if (basePath) {
      const overrideFolder = path.resolve(expandHome(basePath));
      // 부모 보장
      try { fs.mkdirSync(path.dirname(overrideFolder), { recursive: true }); } catch (_) {}
      if (fs.existsSync(overrideFolder)) {
        const metaPath = path.join(overrideFolder, 'project.meta.json');
        let existingId = null;
        try {
          if (fs.existsSync(metaPath)) {
            existingId = JSON.parse(fs.readFileSync(metaPath, 'utf8'))?.id || null;
          }
        } catch (_) {}
        if (existingId && existingId !== safePid) {
          return {
            ok: false,
            error: `폴더 meta가 다른 프로젝트(${existingId})에 속합니다. 수동 정리 필요.`,
            folderPath: overrideFolder,
            mismatchId: existingId,
          };
        }
        if (existingId === safePid) {
          return { ok: true, folderPath: overrideFolder, created: false, reused: true, viaOverride: true };
        }
        const repaired = _repairFolder(overrideFolder, safePid, safeName);
        return { ok: true, folderPath: overrideFolder, created: false, repaired, viaOverride: true };
      }
      // 신규 생성 (override)
      return await _generateNewPmFolder(overrideFolder, safePid, safeName, projectId, { viaOverride: true });
    }

    // [1] 신규 경로 — <userData>/projects/<projectId>/claude-pm
    const newFolder = _defaultPmFolderPath(safePid);
    // 부모 디렉터리(<userData>/projects/<projectId>)는 Goditor가 관리하지만 없을 수도 있으니 보장
    try { fs.mkdirSync(path.dirname(newFolder), { recursive: true }); } catch (_) {}

    if (fs.existsSync(newFolder)) {
      const metaPath = path.join(newFolder, 'project.meta.json');
      let existingId = null;
      try {
        if (fs.existsSync(metaPath)) {
          existingId = JSON.parse(fs.readFileSync(metaPath, 'utf8'))?.id || null;
        }
      } catch (_) {}
      if (existingId === safePid) {
        return { ok: true, folderPath: newFolder, created: false, reused: true };
      }
      if (existingId && existingId !== safePid) {
        return {
          ok: false,
          error: `폴더 meta가 다른 프로젝트(${existingId})에 속합니다. 수동 정리 필요.`,
          folderPath: newFolder,
          mismatchId: existingId,
        };
      }
      const repaired = _repairFolder(newFolder, safePid, safeName);
      return { ok: true, folderPath: newFolder, created: false, repaired };
    }

    // [2] legacy 경로 자동 마이그레이션
    //     a) ~/Documents/claude-pm-projects/<projectId>/ (A 패턴, 폴더명=ID)
    //     b) ~/Documents/claude-pm-projects/<옛 이름>/ (project.meta.json id 매칭)
    const legacyBase = _legacyBasePath();
    let legacySrc = null;
    if (fs.existsSync(legacyBase)) {
      const candidateById = path.join(legacyBase, safePid);
      // lstatSync로 symlink escape 방어 (codex 리뷰 반영, _findFolderByProjectId와 일관)
      let isDirRegular = false;
      try {
        const st = fs.lstatSync(candidateById);
        isDirRegular = st.isDirectory();
      } catch (_) {}
      if (isDirRegular) {
        // meta id 일치 또는 meta 없으면 폴더명 매칭으로 채택
        const metaP = path.join(candidateById, 'project.meta.json');
        let okMatch = true;
        try {
          if (fs.existsSync(metaP)) {
            const eid = JSON.parse(fs.readFileSync(metaP, 'utf8'))?.id;
            if (eid && eid !== safePid) okMatch = false;
          }
        } catch (_) {}
        if (okMatch) legacySrc = candidateById;
      }
      if (!legacySrc) {
        legacySrc = _findFolderByProjectId(legacyBase, safePid);
      }
    }

    if (legacySrc) {
      // copy → 신규 위치. 사용자 편집 보존(이미 있는 파일은 skip).
      try { fs.mkdirSync(newFolder, { recursive: true }); } catch (_) {}
      const { copied, skipped } = _copyDirSafe(legacySrc, newFolder);
      // 신규 위치 meta.id 보강
      const repaired = _repairFolder(newFolder, safePid, safeName);
      return {
        ok: true,
        folderPath: newFolder,
        created: false,
        reused: true,
        migrated: true,
        migratedFrom: legacySrc,
        migrationCopied: copied,
        migrationSkipped: skipped,
        repaired,
      };
    }

    // [3] 신규 생성
    return await _generateNewPmFolder(newFolder, safePid, safeName, projectId);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// 신규 PM 폴더 생성 헬퍼 (template-generator 우선, fallback 포함)
async function _generateNewPmFolder(folderPath, safePid, safeName, projectId, extra = {}) {
  const tg = await _tryImportTemplateGenerator();
  if (tg && typeof tg.generateFolder === 'function') {
    try {
      const result = await tg.generateFolder({ basePath: folderPath, projectName: safeName, projectId });
      return { ok: true, folderPath: result?.folderPath || folderPath, created: true, ...extra };
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
    return { ok: true, folderPath, created: true, viaFallback: true, ...extra };
  } catch (e) {
    return { ok: false, error: `fallback 생성 실패: ${e.message}`, folderPath };
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
