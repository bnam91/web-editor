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

/* PM 폴더 경로 — ★프로젝트 «뿌리»는 계정별로 움직인다(<userData>/accounts/<키>/projects).
   그래서 여기서 'projects' 를 직접 이어 붙이면 «두 번째 경로 조립기»가 되어 어긋난다.
   main.js 가 setPmProjectsRoot() 로 진짜 뿌리를 꽂아 준다. 안 꽂히면 옛 자리로 폴백. */
let _pmProjectsRoot = null;
function setPmProjectsRoot(fn) { _pmProjectsRoot = (typeof fn === 'function') ? fn : null; }
function _projectsRootPath() {
  /* ⛔조용히 «옛 공용 풀»로 폴백하지 않는다 — PM 폴더가 남의 계정 폴더 아래 생긴다.
     못 정하면 던진다. 부르는 쪽(handleEnsureClaudePMFolder 등)이 오류로 받는 게
     「엉뚱한 곳에 조용히 만들어졌다」보다 낫다. */
  if (_pmProjectsRoot) {
    const r = _pmProjectsRoot();   // ⛔삼키지 않는다
    if (r) return r;
    throw new Error('NO_PROJECTS_ROOT: PM 폴더의 프로젝트 뿌리를 못 정했다(주입 함수가 빈 값).');
  }
  throw new Error('NO_PROJECTS_ROOT: PM 폴더의 프로젝트 뿌리가 주입되지 않았다. 공용 폴더로 폴백하지 않는다.');
}
function _defaultPmFolderPath(projectId) {
  /* ★«현재 뿌리에 그 프로젝트가 있을 때»만 PM 폴더 경로를 준다.
     ⛔없는데도 주면 mkdir 이 «유령 폴더»를 만든다 — 계정이 바뀐 직후 옛 활성 id 로 실제로 그랬다.
       (2026-09-07 실측: 민수 것이던 id 의 claude-pm/ 이 철수 뿌리 아래 생겼다)
     ⇒ 활성 id 를 지우는 것이 1차 처방이고, 이건 «그래도 새면» 막는 2차다. */
  const root = _projectsRootPath();
  const projDir = path.join(root, projectId);
  if (!fs.existsSync(projDir)) {
    throw new Error(`NO_SUCH_PROJECT_IN_ROOT: ${projectId} 이(가) 현재 계정 뿌리에 없다 — PM 폴더를 만들지 않는다`);
  }
  return path.join(projDir, 'claude-pm');
}

// legacy base — 옛 PM 폴더 부모 (~/Documents/claude-pm-projects)
function _legacyBasePath() {
  return path.join(os.homedir(), 'Documents', 'claude-pm-projects');
}

// 메인 스토어(<projectsDir>/<id>.json `name`)와 claude-pm/project.meta.json `title` 동기화.
// 폴더가 없으면(=PM 폴더 미생성 프로젝트) silent skip. title 변경 없으면 noop.
async function syncClaudePmTitle(projectsDir, projectId, name) {
  const pid = sanitizeProjectId(projectId);
  if (!projectsDir || !pid || !name) return false;
  const folder = path.join(projectsDir, pid, 'claude-pm');
  const metaPath = path.join(folder, 'project.meta.json');
  if (!fs.existsSync(metaPath)) return false;
  try {
    const current = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (current && current.title === name) return false;
    const tg = await _tryImportTemplateGenerator();
    if (tg && typeof tg.updateMeta === 'function') {
      await tg.updateMeta(folder, { title: name });
      return true;
    }
    // template-generator 로드 실패 fallback — title 필드만 패치 (CLAUDE.md 재생성 X)
    const next = current && typeof current === 'object' ? current : {};
    next.title = name;
    next.updatedAt = new Date().toISOString();
    fs.writeFileSync(metaPath, JSON.stringify(next, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.warn('[syncClaudePmTitle] 실패:', e.message);
    return false;
  }
}

/* ★317 ㉠ 초기값은 «없음» — 시작이 실패해도 9345 가 남으면 뱃지가 안 붙은 주소를 보여 주고 ping 이 그 포트로 나간다.
     성공했을 때만 채운다. (㉡ 은 «200 이어도 누구냐»를 본다 · 이 줄은 «잴 포트가 있나»를 본다 — 다른 칸이다)
   ★창이 서버보다 먼저 뜬다(createWindow → startMcpServer) ⇒ 「아직」과 「실패」를 _mcpOutcome 으로 가른다. */
let MCP_PORT = null;
const MCP_DEFAULT_PORT = 9345; // .mcp.json 에 적을 자리 전용 — «지금 붙었다»는 뜻이 아니다
const MCP_OUTCOME_WAIT_MS = 10000;
let _mcpFailure = null;
let _mcpSettle;
const _mcpOutcome = new Promise((resolve) => { _mcpSettle = resolve; });
function setActualMcpPort(p) {
  if (typeof p === 'number' && p > 0) { MCP_PORT = p; _mcpFailure = null; _mcpSettle(); }
}
// startMcpServer 뒤 배선이 던져도 서버는 듣는 중이다 — 포트가 있으면 실패로 안 적는다
function setMcpStartFailed(reason) {
  if (MCP_PORT != null) return;
  _mcpFailure = String(reason || '알 수 없는 오류');
  _mcpSettle();
}
function _mcpNoServer() {
  return { failed: _mcpFailure != null, error: _mcpFailure || 'MCP 서버 시작 전' };
}
function _mcpConfigUrl() {
  return `http://localhost:${MCP_PORT == null ? MCP_DEFAULT_PORT : MCP_PORT}`;
}
function _mcpHealthUrl() {
  return `http://localhost:${MCP_PORT}/health`;
}
// renderer 표시용 MCP 엔드포인트 — 목표 문구가 127.0.0.1 표기를 명시.
// health는 localhost지만 동일 루프백이라 기능 무관.
function _mcpUrl() {
  return MCP_PORT == null ? null : `http://127.0.0.1:${MCP_PORT}/mcp`;
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
// 기존 폴더 재사용 시 CLAUDE.md를 현재 템플릿으로 재생성 (도구 목록 등 최신화).
// graceful: 실패해도 ensure 흐름을 깨지 않음. meta 보존(updatedAt 미변경).
async function _refreshClaudeMdSafe(folder) {
  try {
    const tg = await _tryImportTemplateGenerator();
    if (tg && typeof tg.refreshClaudeMd === 'function') {
      await tg.refreshClaudeMd(folder);
      return true;
    }
  } catch (_) {}
  return false;
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
              url: _mcpConfigUrl(),
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
/* ★NEWPROJ-FREEZE-DOCUMENTS-TCC-01 — 옛 PM 폴더(~/Documents/claude-pm-projects) 찾기.
   맥 «문서 폴더 접근»(TCC) 확인창이 뜨면 그 경로의 sync fs 가 «메인 스레드째» 붙잡혀 앱 전체가 멈췄다
   (새 프로젝트 만들 때 6분+ · HOME 을 바꾸면 즉시 통과 · v0.9.10 에도 같은 코드).
   ⇒ 옛 경로는 ★비동기(fs.promises — libuv 스레드)로만 훑는다 · LEGACY_PROBE_MS 안에 못 끝나면 이관을 건너뛰고
     새로 만든다(실패해도 계속) · 한 번 막히면 이 세션엔 다시 안 훑는다(붙잡힌 스레드를 더 쌓지 않게).
   찾는 순서는 옛 sync 판과 같다: ⒜ <base>/<projectId> 폴더(meta id 가 다르면 버림) ⒝ base 의 폴더들 중 meta.id 일치.
   lstat → symlink 는 폴더로 안 친다(symlink escape 방어 · 옛 판과 같음). */
const LEGACY_PROBE_MS = 1500;
let _legacyBlocked = false;
async function _findLegacySrcAsync(base, projectId, { fsp = fs.promises, ms = LEGACY_PROBE_MS } = {}) {
  if (_legacyBlocked) return null;
  const probe = (async () => {
    try { await fsp.access(base); } catch (_) { return null; }
    const byId = path.join(base, projectId);
    try {
      if ((await fsp.lstat(byId)).isDirectory()) {
        let ok = true;
        try {
          const eid = JSON.parse(await fsp.readFile(path.join(byId, 'project.meta.json'), 'utf8'))?.id;
          if (eid && eid !== projectId) ok = false;
        } catch (_) { /* meta 없음·깨짐 = 폴더명 매칭으로 채택(옛 판과 같음) */ }
        if (ok) return byId;
      }
    } catch (_) {}
    let names;
    try { names = await fsp.readdir(base); } catch (_) { return null; }
    for (const name of names) {
      if (name.startsWith('.')) continue;
      const dir = path.join(base, name);
      try {
        if (!(await fsp.lstat(dir)).isDirectory()) continue;
        const m = JSON.parse(await fsp.readFile(path.join(dir, 'project.meta.json'), 'utf8'));
        if (m && m.id === projectId) return dir;
      } catch (_) { /* skip */ }
    }
    return null;
  })();
  let timer;
  const timeout = new Promise((r) => { timer = setTimeout(() => { _legacyBlocked = true; r(null); }, ms); });
  try { return await Promise.race([probe, timeout]); } finally { clearTimeout(timer); }
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
      fs.writeFileSync(mcpP, JSON.stringify({ mcpServers: { 'goditor-pm': { type: 'http', url: _mcpConfigUrl() } } }, null, 2), 'utf8');
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
          await _refreshClaudeMdSafe(overrideFolder);
          return { ok: true, folderPath: overrideFolder, created: false, reused: true, viaOverride: true };
        }
        const repaired = _repairFolder(overrideFolder, safePid, safeName);
        await _refreshClaudeMdSafe(overrideFolder);
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
        await _refreshClaudeMdSafe(newFolder);
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
      await _refreshClaudeMdSafe(newFolder);
      return { ok: true, folderPath: newFolder, created: false, repaired };
    }

    // [2] legacy 경로 자동 마이그레이션
    //     a) ~/Documents/claude-pm-projects/<projectId>/ (A 패턴, 폴더명=ID)
    //     b) ~/Documents/claude-pm-projects/<옛 이름>/ (project.meta.json id 매칭)
    const legacySrc = await _findLegacySrcAsync(_legacyBasePath(), safePid);

    if (legacySrc) {
      // copy → 신규 위치. 사용자 편집 보존(이미 있는 파일은 skip).
      try { fs.mkdirSync(newFolder, { recursive: true }); } catch (_) {}
      const { copied, skipped } = _copyDirSafe(legacySrc, newFolder);
      // 신규 위치 meta.id 보강
      const repaired = _repairFolder(newFolder, safePid, safeName);
      await _refreshClaudeMdSafe(newFolder);
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
        mcpServers: { 'goditor-pm': { type: 'http', url: _mcpConfigUrl() } },
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

/* ★317 — 200 은 «누가 듣고 있다» 일 뿐 «내 서버다» 가 아니다. 신원을 본다: name 이 내 서버 이름이고,
   내 토큰 파일이 있으면 /health 의 tokenFile 도 그것이어야 한다(같은 앱의 다른 인스턴스는 경로가 다르다). */
function _isOwnMcpHealth(body) {
  if (!body || typeof body !== 'object') return false;
  const m = require('./mcp-server');
  if (body.name !== m.SERVER_NAME) return false;
  const mine = m.getTokenFilePath && m.getTokenFilePath();
  return !mine || body.tokenFile === mine;
}

async function handlePingMcp(_e) {
  if (MCP_PORT == null) return { ok: true, connected: false, ..._mcpNoServer() };
  try {
    // Node 18+ global fetch (Electron 26+에 포함됨). 짧은 timeout.
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    try {
      const r = await fetch(_mcpHealthUrl(), { signal: ctl.signal });
      const body = r.ok ? await r.json().catch(() => null) : null;
      clearTimeout(t);
      return { ok: true, connected: r.ok && _isOwnMcpHealth(body), status: r.status };
    } catch (e) {
      clearTimeout(t);
      return { ok: true, connected: false, error: e.message };
    }
  } catch (err) {
    return { ok: false, connected: false, error: err.message };
  }
}

// 현재 MCP 연결정보 노출.
// MCP_PORT는 setActualMcpPort로 EADDRINUSE fallback 반영된 실제 포트.
// Unit B-2 — 「환경설정 → 개발자」 탭이 한 번에 쓰도록 토큰 파일/브리지 경로도 같이 준다.
//   ⛔토큰 «값»은 여기 안 넣는다 — 값은 app:mcp-token 한 곳에서만 나간다.
async function handleGetMcpInfo() {
  await Promise.race([_mcpOutcome, new Promise((r) => setTimeout(r, MCP_OUTCOME_WAIT_MS))]);
  if (MCP_PORT == null) return { ok: false, port: null, url: null, ..._mcpNoServer() };
  let tokenFile = null, bridgePath = null, bridgeError = null;
  try {
    const m = require('./mcp-server');
    tokenFile = (m.getTokenFilePath && m.getTokenFilePath()) || null;
    bridgePath = (m.getBridgePath && m.getBridgePath()) || null;
    // 복사 실패를 조용히 넘기면 화면의 연결 안내가 거짓이 된다 — 사유를 그대로 올린다.
    bridgeError = (m.getBridgeError && m.getBridgeError()) || null;
  } catch (_) {}
  return { ok: true, port: MCP_PORT, url: _mcpUrl(), tokenFile, bridgePath, bridgeError };
}

// ── 등록 진입점 ──────────────────────────────
// GAP-010: spawnClaudeTerminal(외부 터미널서 셸 실행)·디렉터리/파인더 조작은 강력 권한 →
// isAllowed(=isAdminAuthorized) 게이팅. pingMcp/setActiveProject/ensureFolder는 MCP 연동용
// 비위험 기능이라 무게이팅 유지(고객 자동화 흐름 보존).
function registerClaudePMIPC(ipcMain, isAllowed) {
  const guard = fn => (e, ...a) => {
    if (typeof isAllowed === 'function' && !isAllowed(e)) {
      return { ok: false, error: 'FORBIDDEN', code: 'ADMIN_REQUIRED', message: '이 기능은 관리자 권한 전용입니다.' };
    }
    return fn(e, ...a);
  };
  ipcMain.handle('claudePM:pickDirectory', guard(handlePickDirectory));
  ipcMain.handle('claudePM:createFolder', guard(handleCreateFolder));
  ipcMain.handle('claudePM:openInFinder', guard(handleOpenInFinder));
  ipcMain.handle('claudePM:spawnClaudeTerminal', guard(handleSpawnClaudeTerminal));
  ipcMain.handle('claudePM:pingMcp', handlePingMcp);
  ipcMain.handle('claudePM:getMcpInfo', handleGetMcpInfo);
  ipcMain.handle('claudePM:setActiveProject', handleSetActiveProject);
  ipcMain.handle('claudePM:ensureFolder', handleEnsureClaudePMFolder);
}

module.exports = {
  registerClaudePMIPC,
  setActualMcpPort,
  setMcpStartFailed,
  setPmProjectsRoot,
  syncClaudePmTitle,
  // MCP create_project(main.js _createProjectImpl)가 갤러리와 동일하게 PM 폴더를 보장할 때 직접 호출.
  handleEnsureClaudePMFolder,
  // 테스트/디버깅용 export
  _internal: {
    expandHome,
    sanitizeFolderName,
    /* ⚠️검사 전용 — 「주입이 없으면 던지나」는 이 함수를 직접 흔들어야 잰다.
       IPC 경유로는 못 닿아서(핸들러가 오류를 감싼다) 검사가 장식이 된다. */
    _projectsRootPath,
    _findLegacySrcAsync,
    _resetLegacyBlocked: () => { _legacyBlocked = false; },
    get MCP_PORT() { return MCP_PORT; },
    handlePingMcp,
    handleGetMcpInfo,
    _mcpConfigUrl,
  },
};
