const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

// C4: 앱 이름 브랜딩 (macOS 상단 메뉴바 표시)
app.name = 'Goya Design Editor';
const fs = require('fs');
const os = require('os');

// .env 로드 (크리덴셜 환경변수)
function _loadEnvFile(p) {
  if (!fs.existsSync(p)) return;
  fs.readFileSync(p, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [k, ...v] = trimmed.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}
_loadEnvFile(path.join(__dirname, '.env'));
// 외부 자격증명 저장소(symlink로 관리되는 공유 시크릿) — GEMINI_API_KEY 등
_loadEnvFile('/Users/a1/github_cloud/module_api_key/.env');
const { spawn } = require('child_process');
const { getPublicIp, findUserByIp, registerLicense, removeIp, updateIpAlias, updateUserName, createLicenseKey, listLicenseKeys } = require('./services/licenseService');
const { fillSectionTexts: geminiFill } = require('./services/geminiService');
const { fillSectionTexts: openaiFill } = require('./services/openaiService');
const { fillSectionTexts: anthropicFill } = require('./services/anthropicService');
const { generateImage: aiGenerateImage } = require('./services/imageGenService');
const { registerClaudePMIPC, setActualMcpPort, syncClaudePmTitle } = require('./main/claude-pm/ipc');
const { registerTerminalIPC, killAllSessions: killAllTerminalSessions } = require('./main/claude-pm/terminal');
const { startMcpServer, stopMcpServer, setRendererInvoker: setMcpRendererInvoker } = require('./main/claude-pm/mcp-server');

/* ── 사용자별 Preferences (API 토큰 + 단축키) ──
   USER_DATA_DIR는 app.getPath('userData') 기반이라 app.whenReady 이후에 안전.
   하지만 라이선스 체크/IPC 등록은 app.whenReady 이전 동기 구간에서도 일어나므로
   USER_DATA_DIR는 lazy 평가 — getSettingsPath()로 한 번만 계산. */
let _SETTINGS_PATH_CACHE = null;
function getSettingsPath() {
  if (_SETTINGS_PATH_CACHE) return _SETTINGS_PATH_CACHE;
  _SETTINGS_PATH_CACHE = path.join(app.getPath('userData'), 'settings.json');
  return _SETTINGS_PATH_CACHE;
}
const DEFAULT_SETTINGS = {
  version: 1,
  apiKeys: { openai: '', gemini: '', anthropic: '' },
  shortcuts: {
    addGap:       'KeyG',
    addText:      'KeyT',
    addAsset:     'KeyA',
    addSection:   'KeyS',
    pinToggle:    'Backquote',
    groupBlocks:  'Meta+KeyG',
    ungroup:      'Meta+Shift+KeyG',
    wrapInFrame:  'Meta+Alt+KeyG',
  },
};
function readSettings() {
  try {
    const p = getSettingsPath();
    if (!fs.existsSync(p)) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return {
      ...DEFAULT_SETTINGS,
      ...raw,
      apiKeys:   { ...DEFAULT_SETTINGS.apiKeys,   ...(raw.apiKeys   || {}) },
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(raw.shortcuts || {}) },
    };
  } catch (_) {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}
function writeSettings(patch) {
  const cur = readSettings();
  const next = {
    ...cur,
    ...patch,
    apiKeys:   { ...cur.apiKeys,   ...(patch?.apiKeys   || {}) },
    shortcuts: { ...cur.shortcuts, ...(patch?.shortcuts || {}) },
  };
  fs.writeFileSync(getSettingsPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}
function getApiKey(provider) {
  const s = readSettings();
  if (s?.apiKeys?.[provider]) return s.apiKeys[provider];
  if (provider === 'openai')    return process.env.OPENAI_API_KEY_GODITOR || process.env.OPENAI_API_KEY || '';
  if (provider === 'gemini')    return process.env.GEMINI_API_KEY || '';
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY || '';
  return '';
}
async function testApiKey(provider, key) {
  try {
    if (!key) return { ok: false, error: 'API 키가 비어있습니다.' };
    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + key } });
      return { ok: r.status === 200, status: r.status, error: r.status === 200 ? null : `OpenAI key invalid (HTTP ${r.status})` };
    }
    if (provider === 'gemini') {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key));
      return { ok: r.status === 200, status: r.status, error: r.status === 200 ? null : `Gemini key invalid (HTTP ${r.status})` };
    }
    if (provider === 'anthropic') {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      });
      return { ok: r.status === 200, status: r.status, error: r.status === 200 ? null : `Anthropic key invalid (HTTP ${r.status})` };
    }
    return { ok: false, error: 'unknown provider' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function aiFillSectionTexts(payload) {
  const model = String(payload?.model || '').toLowerCase();
  // 사용자별 키 우선 — 비어 있으면 service 내부에서 process.env로 fallback
  const apiKeyOverride = (() => {
    if (model.startsWith('gpt-'))    return getApiKey('openai');
    if (model.startsWith('claude-')) return getApiKey('anthropic');
    return getApiKey('gemini');
  })();
  const enriched = { ...payload, apiKey: apiKeyOverride };
  if (model.startsWith('gpt-')) return openaiFill(enriched);
  if (model.startsWith('claude-')) return anthropicFill(enriched);
  return geminiFill(enriched);
}

let mainWindow;

/* ── Hot Reload (개발용) ── */
function watchFiles() {
  const watchTargets = [
    path.join(__dirname, 'index.html'),
    path.join(__dirname, 'js'),
    path.join(__dirname, 'css'),
    path.join(__dirname, 'presets'),
  ];

  let reloadTimer = null;

  function scheduleReload() {
    if (reloadTimer) clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.reload();
        console.log('[hot-reload] reloaded');
      }
    }, 300);
  }

  watchTargets.forEach(target => {
    if (!fs.existsSync(target)) return;
    fs.watch(target, { recursive: true }, (eventType, filename) => {
      if (filename) scheduleReload();
    });
  });
}

function getGitBranch() {
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse --abbrev-ref HEAD', { cwd: __dirname }).toString().trim();
  } catch { return null; }
}

function createWindow() {
  const isMac = process.platform === 'darwin';
  const gitBranch = getGitBranch();
  const windowTitle = gitBranch ? `GOYA DESIGN EDITOR [${gitBranch}]` : 'GOYA DESIGN EDITOR';
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: windowTitle,
    ...(isMac ? { titleBarStyle: 'hiddenInset' } : { titleBarStyle: 'default' }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // local-fonts 퍼미션 허용 (queryLocalFonts API)
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'local-fonts') {
      callback(true);
      return;
    }
    callback(false);
  });

  // 라이선스 체크 후 페이지 결정
  checkLicenseAndLoad();

  ipcMain.handle('get-version', () => app.getVersion());
  ipcMain.handle('app:git-branch', () => getGitBranch());
  ipcMain.handle('app:is-admin', () => process.argv.includes('admin'));
  ipcMain.handle('app:debug-port', () => {
    const a = process.argv.find(a => a.startsWith('--remote-debugging-port='));
    return a ? a.split('=')[1] : null;
  });

  // AI 섹션 텍스트 채우기 (Gemini)
  ipcMain.handle('ai:fillSectionTexts', (_e, payload) => aiFillSectionTexts(payload));

  // 사용자별 Preferences (settings.json: API 키 + 단축키)
  ipcMain.handle('settings:get',      () => readSettings());
  ipcMain.handle('settings:set',      (_e, patch) => writeSettings(patch || {}));
  ipcMain.handle('settings:test-key', (_e, provider, key) => testApiKey(provider, key));

  // Claude PM (feature/claude-pm Phase 2) — pickDirectory / createFolder / openInFinder / spawnClaudeTerminal / pingMcp
  registerClaudePMIPC(ipcMain);

  // Claude PM (Phase 3 F8) — 내부 터미널 패널 PTY 백엔드
  registerTerminalIPC(ipcMain);

  // Clipboard write — 렌더러의 navigator.clipboard 권한 거부 우회용 IPC 브리지
  ipcMain.handle('clipboard:writeText', (_e, text) => {
    try {
      require('electron').clipboard.writeText(String(text || ''));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // Clipboard image write — PNG dataURL을 nativeImage로 변환해 OS 클립보드에 기록
  ipcMain.handle('clipboard:writeImage', (_e, dataUrl) => {
    try {
      const { clipboard, nativeImage } = require('electron');
      const img = nativeImage.createFromDataURL(String(dataUrl || ''));
      if (img.isEmpty()) return { ok: false, error: 'empty image' };
      clipboard.writeImage(img);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // HTML <title>이 덮어씌우지 않도록 로드 완료 후 타이틀 강제 설정
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.setTitle(windowTitle);
  });

  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('fullscreen-change', true);
  });
  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('fullscreen-change', false);
  });

  // F12 → DevTools (dev 모드에서만)
  if (process.argv.includes('--enable-logging')) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12') {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools();
        }
      }
    });
  }
}

/* ── 라이선스 체크 + 초기 페이지 로드 ── */
async function checkLicenseAndLoad() {
  if (process.argv.includes('admin')) {
    mainWindow.loadFile('pages/projects.html');
    return;
  }
  try {
    const ip = await getPublicIp();
    if (ip) {
      const result = await findUserByIp(ip);
      if (result.found) {
        mainWindow.loadFile('pages/projects.html');
        return;
      }
    }
  } catch {}
  mainWindow.loadFile('pages/license.html');
}

/* ── IPC: License ── */
ipcMain.handle('license:get-ip', () => getPublicIp());

ipcMain.handle('license:find-by-ip', async () => {
  const ip = await getPublicIp();
  if (!ip) return { found: false };
  return findUserByIp(ip);
});

ipcMain.handle('license:register', (event, licenseKey, ip, userId) =>
  registerLicense(licenseKey, ip, userId)
);

ipcMain.handle('license:remove-ip', (event, licenseKey, ip) =>
  removeIp(licenseKey, ip)
);

ipcMain.handle('license:update-alias', (event, licenseKey, ip, alias) =>
  updateIpAlias(licenseKey, ip, alias)
);

ipcMain.handle('license:update-name', (event, licenseKey, userName) =>
  updateUserName(licenseKey, userName)
);

ipcMain.handle('license:create-key', (event, plan, memo) =>
  createLicenseKey(plan, memo)
);

ipcMain.handle('license:list-keys', () => listLicenseKeys());

ipcMain.handle('license:navigate-projects', () => {
  mainWindow.loadFile('pages/projects.html');
});

/* ── 사용자 데이터 경로 (자동업데이트 후에도 유지) ── */
const USER_DATA_DIR = app.getPath('userData');

// 구 경로 → 신 경로 파일 마이그레이션 (없는 파일만 복사)
function migrateFiles(oldDir, newDir) {
  if (!fs.existsSync(oldDir)) return;
  if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
  fs.readdirSync(oldDir).forEach(file => {
    const src = path.join(oldDir, file);
    const dst = path.join(newDir, file);
    if (fs.existsSync(dst)) return; // 이미 있으면 스킵
    if (fs.statSync(src).isDirectory()) {
      migrateFiles(src, dst);
    } else {
      fs.copyFileSync(src, dst);
    }
  });
}

/* ── IPC: Projects (파일 기반 저장소) ── */
const PROJECTS_DIR = path.join(USER_DATA_DIR, 'projects');
migrateFiles(path.join(__dirname, 'projects'), PROJECTS_DIR); // 구 경로 마이그레이션
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

// 번들 레이아웃 마이그레이션 모듈 (팀 1 결과물). 머지 전이라 없을 수 있어 lazy require.
// (read/write 경로 helper + startup migrateAll 제공)
function _getMigrator() {
  try { return require('./main/project-store/migrator'); }
  catch (_) { return null; }
}

// Atomic write: temp 파일 → rename으로 partial-write 위험 제거.
// 동일 파일시스템 가정(userData 안이라 OK).
function _atomicWriteFileSync(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, data, 'utf8');
  try {
    fs.renameSync(tmp, filePath);
  } catch (e) {
    try { fs.unlinkSync(tmp); } catch (_) {}
    throw e;
  }
}

// proj.json 경로 dual-resolve: 신 우선 → flat fallback.
// migrator 모듈이 있으면 그쪽 사용, 없으면 동일 로직 인라인.
function _resolveProjectJsonPath(id) {
  const m = _getMigrator();
  if (m && typeof m.resolveProjectJsonPath === 'function') {
    return m.resolveProjectJsonPath(PROJECTS_DIR, id);
  }
  const newP = path.join(PROJECTS_DIR, id, 'proj.json');
  if (fs.existsSync(newP)) return newP;
  const flat = path.join(PROJECTS_DIR, `${id}.json`);
  if (fs.existsSync(flat)) return flat;
  return null;
}
function _resolveMetaJsonPath(id) {
  const m = _getMigrator();
  if (m && typeof m.resolveMetaJsonPath === 'function') {
    return m.resolveMetaJsonPath(PROJECTS_DIR, id);
  }
  const newP = path.join(PROJECTS_DIR, id, 'proj_meta.json');
  if (fs.existsSync(newP)) return newP;
  const flat = path.join(PROJECTS_DIR, `${id}_meta.json`);
  if (fs.existsSync(flat)) return flat;
  return null;
}
function _resolveBackupJsonPath(id) {
  const m = _getMigrator();
  if (m && typeof m.resolveBackupJsonPath === 'function') {
    return m.resolveBackupJsonPath(PROJECTS_DIR, id);
  }
  const newP = path.join(PROJECTS_DIR, id, 'proj_backup.json');
  if (fs.existsSync(newP)) return newP;
  const flat = path.join(PROJECTS_DIR, `${id}_backup.json`);
  if (fs.existsSync(flat)) return flat;
  return null;
}
// 항상 신 레이아웃 경로 — write 전용. migrator 없으면 인라인 계산.
function _ensureNewLayoutPaths(id) {
  const m = _getMigrator();
  if (m && typeof m.ensureNewLayoutPaths === 'function') {
    return m.ensureNewLayoutPaths(PROJECTS_DIR, id);
  }
  const dir = path.join(PROJECTS_DIR, id);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  return {
    dir,
    proj:    path.join(dir, 'proj.json'),
    backup:  path.join(dir, 'proj_backup.json'),
    meta:    path.join(dir, 'proj_meta.json'),
    history: path.join(dir, 'proj_history'),
  };
}

/* ── IPC: AI Image Gen ──
   이미지는 projects/<id>/images/aig_xxx.png로 디스크 분리 저장 (프로젝트 JSON에 base64 금지).
   blobPath는 프로젝트 폴더 상대경로. */
function _getProjectImagesDir(projectId) {
  return path.join(PROJECTS_DIR, projectId, 'images');
}

function _getProjectAssetsDir(projectId) {
  return path.join(PROJECTS_DIR, projectId, 'assets');
}

/* ── IPC: Assets (사용자 자산 트리 — 이미지 디스크 저장) ──
   blobPath는 'assets/ast_xxx.png' 형식. path traversal 가드 적용. */
ipcMain.handle('assets:saveFile', (_e, { projectId, b64, mime, originalName } = {}) => {
  if (!projectId) return { ok: false, error: 'projectId 필수' };
  if (!b64) return { ok: false, error: 'b64 필수' };
  try {
    const id = 'ast_' + Math.random().toString(36).slice(2, 8);
    let ext = 'png';
    if (mime === 'image/jpeg' || mime === 'image/jpg') ext = 'jpg';
    else if (mime === 'image/svg+xml') ext = 'svg';
    else if (mime === 'image/webp') ext = 'webp';
    else if (mime === 'image/gif') ext = 'gif';
    const dir = _getProjectAssetsDir(projectId);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${id}.${ext}`;
    fs.writeFileSync(path.join(dir, filename), Buffer.from(b64, 'base64'));
    return { ok: true, id, blobPath: `assets/${filename}`, mime: mime || 'image/png', originalName: originalName || filename };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('assets:readFile', (_e, { projectId, blobPath } = {}) => {
  if (!projectId || !blobPath) return { ok: false, error: 'projectId, blobPath 필수' };
  try {
    const safeRoot = path.join(PROJECTS_DIR, projectId, 'assets');
    const full = path.join(PROJECTS_DIR, projectId, blobPath);
    if (!full.startsWith(safeRoot)) return { ok: false, error: 'path traversal' };
    if (!fs.existsSync(full)) return { ok: false, error: 'not_found' };
    const buf = fs.readFileSync(full);
    let mime = 'image/png';
    if (full.endsWith('.jpg') || full.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (full.endsWith('.svg')) mime = 'image/svg+xml';
    else if (full.endsWith('.webp')) mime = 'image/webp';
    else if (full.endsWith('.gif')) mime = 'image/gif';
    return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('assets:deleteFile', (_e, { projectId, blobPath } = {}) => {
  if (!projectId || !blobPath) return { ok: false, error: 'projectId, blobPath 필수' };
  try {
    const safeRoot = path.join(PROJECTS_DIR, projectId, 'assets');
    const full = path.join(PROJECTS_DIR, projectId, blobPath);
    if (!full.startsWith(safeRoot)) return { ok: false, error: 'path traversal' };
    if (fs.existsSync(full)) fs.unlinkSync(full);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('ai:generateImage', (_e, payload) => {
  const model = String(payload?.model || 'gemini-2.5-flash-image').toLowerCase();
  const needOpenAI = payload?.outpaint || model.startsWith('gpt-');
  const apiKeyOverride = needOpenAI ? getApiKey('openai') : getApiKey('gemini');
  return aiGenerateImage({ ...payload, apiKey: apiKeyOverride });
});

ipcMain.handle('ai:saveImage', (_e, { projectId, b64, mime } = {}) => {
  if (!projectId) return { ok: false, error: 'projectId 필수' };
  if (!b64) return { ok: false, error: 'b64 필수' };
  try {
    const id = 'aig_' + Math.random().toString(36).slice(2, 8);
    const ext = (mime === 'image/jpeg' || mime === 'image/jpg') ? 'jpg' : 'png';
    const dir = _getProjectImagesDir(projectId);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${id}.${ext}`;
    fs.writeFileSync(path.join(dir, filename), Buffer.from(b64, 'base64'));
    return { ok: true, id, blobPath: `images/${filename}`, mime: mime || 'image/png' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('ai:readImage', (_e, { projectId, blobPath } = {}) => {
  if (!projectId || !blobPath) return { ok: false, error: 'projectId, blobPath 필수' };
  try {
    const full = path.join(PROJECTS_DIR, projectId, blobPath);
    if (!full.startsWith(path.join(PROJECTS_DIR, projectId))) return { ok: false, error: 'path traversal' };
    if (!fs.existsSync(full)) return { ok: false, error: 'not_found' };
    const buf = fs.readFileSync(full);
    const mime = full.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('ai:deleteImage', (_e, { projectId, blobPath } = {}) => {
  if (!projectId || !blobPath) return { ok: false, error: 'projectId, blobPath 필수' };
  try {
    const full = path.join(PROJECTS_DIR, projectId, blobPath);
    if (!full.startsWith(path.join(PROJECTS_DIR, projectId))) return { ok: false, error: 'path traversal' };
    if (fs.existsSync(full)) fs.unlinkSync(full);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('projects:list', () => {
  // 번들 레이아웃: PROJECTS_DIR 안의 proj_<id>/proj.json + 아직 마이그 안 된 flat proj_<id>.json 둘 다 인식.
  // 중복 ID는 신 위치 우선.
  const seen = new Set();
  const items = [];

  let entries = [];
  try { entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true }); }
  catch { entries = []; }

  // 1) 신 레이아웃 우선: proj_<id>/proj.json
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (!/^proj_\d+$/.test(ent.name)) continue;
    const projPath = path.join(PROJECTS_DIR, ent.name, 'proj.json');
    if (!fs.existsSync(projPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(projPath, 'utf8'));
      if (!data.id || data.id === 'undefined' || seen.has(data.id)) continue;
      let thumbnail = data.thumbnail || null;
      const metaPath = _resolveMetaJsonPath(data.id);
      if (metaPath && fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          if (meta.thumbnail) thumbnail = meta.thumbnail;
        } catch {}
      }
      seen.add(data.id);
      items.push({ id: data.id, name: data.name, type: data.type || null, createdAt: data.createdAt, updatedAt: data.updatedAt, thumbnail });
    } catch {}
  }

  // 2) flat fallback: proj_<id>.json (마이그레이션 안 된 케이스). 같은 ID는 1)에서 이미 등록됐으면 skip.
  for (const ent of entries) {
    if (!ent.isFile()) continue;
    if (!/^proj_\d+\.json$/.test(ent.name)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, ent.name), 'utf8'));
      if (!data.id || data.id === 'undefined' || seen.has(data.id)) continue;
      let thumbnail = data.thumbnail || null;
      const metaPath = _resolveMetaJsonPath(data.id);
      if (metaPath && fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          if (meta.thumbnail) thumbnail = meta.thumbnail;
        } catch {}
      }
      seen.add(data.id);
      items.push({ id: data.id, name: data.name, type: data.type || null, createdAt: data.createdAt, updatedAt: data.updatedAt, thumbnail });
    } catch {}
  }

  items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return items;
});

ipcMain.handle('projects:load', (event, id) => {
  const filePath = _resolveProjectJsonPath(id);
  if (!filePath) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
});

// 섹션 수 합산 헬퍼 — 모든 페이지의 canvas HTML에서 section-block 카운트
function _countSections(proj) {
  if (!proj) return 0;
  if (proj.version === 2 && Array.isArray(proj.pages)) {
    return proj.pages.reduce((sum, p) => sum + ((p.canvas || '').match(/section-block/g)?.length || 0), 0);
  }
  // v1 호환
  const c = proj.canvas || proj.snapshot?.canvas || '';
  return (c.match(/section-block/g)?.length || 0);
}

ipcMain.handle('projects:save', async (event, project) => {
  // write는 항상 신 위치. read(백업 직전 상태)는 dual fallback.
  const paths = _ensureNewLayoutPaths(project.id);
  const filePath = paths.proj;

  // 백업 만들 때는 마이그레이션 안 된 케이스도 대비 — 직전 버전이 flat에만 있을 수 있음.
  const prevPath = _resolveProjectJsonPath(project.id);

  if (prevPath && fs.existsSync(prevPath)) {
    try {
      // 롤링 백업: 정상 저장 전 직전 버전 보존 — 신 위치에만 작성
      try { fs.copyFileSync(prevPath, paths.backup); } catch (_) {}

      // 다중 백업: 시간 기반 5개 슬롯 — 신 위치 디렉터리 안 history/
      try {
        const histDir = paths.history;
        if (!fs.existsSync(histDir)) fs.mkdirSync(histDir, { recursive: true });
        const slots = fs.readdirSync(histDir).filter(f => f.endsWith('.json')).sort();
        const now = Date.now();
        const lastSlotTs = slots.length > 0
          ? parseInt(slots[slots.length - 1].replace('.json','')) || 0
          : 0;
        // 직전 슬롯과 10분 이상 차이날 때만 새 스냅샷 추가 (저장 폭주 방지)
        if (now - lastSlotTs > 10 * 60 * 1000) {
          const newSlot = path.join(histDir, `${now}.json`);
          fs.copyFileSync(prevPath, newSlot);
          // 5개 초과 시 가장 오래된 슬롯 제거
          const refreshed = fs.readdirSync(histDir).filter(f => f.endsWith('.json')).sort();
          while (refreshed.length > 5) {
            const oldest = refreshed.shift();
            try { fs.unlinkSync(path.join(histDir, oldest)); } catch {}
          }
        }
      } catch (e) {
        console.warn('[projects:save] 다중 백업 슬롯 갱신 실패:', e.message);
      }
    } catch {}
  }

  _atomicWriteFileSync(filePath, JSON.stringify(project, null, 2));
  // claude-pm/project.meta.json title 동기화 (PM 폴더 있을 때만, best-effort)
  try { await syncClaudePmTitle(PROJECTS_DIR, project.id, project.name); } catch {}
  return { ok: true };
});

// BUG-44: 새로고침/탭 닫기 시 동기 저장 — beforeunload는 async를 await할 수 없어
// 1.5초 debounce가 끝나기 전 새로고침 시 이미지·텍스트 변경분이 파일에 누락되던 문제 해결
// 페이지/섹션 감소 차단 가드는 제거 (정당한 삭제도 막혔던 부작용) — 백업만 유지
ipcMain.on('projects:save-sync', (event, project) => {
  try {
    if (!project || !project.id) { event.returnValue = { ok: false, reason: 'invalid' }; return; }
    // write는 항상 신 위치. 직전 버전 backup용 read는 dual fallback.
    const paths = _ensureNewLayoutPaths(project.id);
    const prevPath = _resolveProjectJsonPath(project.id);
    if (prevPath && fs.existsSync(prevPath)) {
      // 롤링 백업 (다중 백업 슬롯은 sync 경로에서 생략 — 새로고침 빈도가 높아 슬롯 폭주 우려)
      try { fs.copyFileSync(prevPath, paths.backup); } catch {}
    }
    _atomicWriteFileSync(paths.proj, JSON.stringify(project, null, 2));
    // claude-pm title 동기화 — sync 경로에서는 fire-and-forget (returnValue를 막지 않음)
    Promise.resolve()
      .then(() => syncClaudePmTitle(PROJECTS_DIR, project.id, project.name))
      .catch(() => {});
    event.returnValue = { ok: true };
  } catch (e) {
    console.error('[projects:save-sync] 저장 실패:', e);
    event.returnValue = { ok: false, reason: 'exception', message: e.message };
  }
});

ipcMain.handle('projects:delete', (event, id) => {
  // projectId sanitize — path traversal 방어 (slash/dot-only/empty reject)
  const safeId = String(id || '').trim();
  if (!safeId || safeId.includes('/') || safeId.includes('\\') || /^\.+$/.test(safeId)) {
    return false;
  }
  // 번들 레이아웃: proj_<id>/ 디렉터리 한 방 삭제 (proj.json/proj_backup.json/proj_meta.json/proj_history/claude-pm/assets/images 포함)
  // path.resolve로 base 밖 탈출 2차 방어
  const projectsBase = path.resolve(PROJECTS_DIR);
  const dirPath = path.resolve(PROJECTS_DIR, safeId);
  let dirOk = true;
  if (dirPath.startsWith(projectsBase + path.sep) && fs.existsSync(dirPath)) {
    try { fs.rmSync(dirPath, { recursive: true, force: true }); }
    catch (e) {
      // partial delete — 호출측에 false 반환해 알림 (codex Medium fix)
      console.error('[projects:delete] dir 삭제 실패:', e.message, 'path:', dirPath);
      dirOk = false;
    }
  }
  // 마이그레이션 안 된 flat 잔재 best-effort cleanup
  // (proj_<id>.json / proj_<id>_meta.json / proj_<id>_backup.json / proj_<id>_history/)
  const flatCandidates = [
    path.join(PROJECTS_DIR, `${safeId}.json`),
    path.join(PROJECTS_DIR, `${safeId}_meta.json`),
    path.join(PROJECTS_DIR, `${safeId}_backup.json`),
  ];
  for (const p of flatCandidates) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
  }
  const flatHist = path.join(PROJECTS_DIR, `${safeId}_history`);
  if (flatHist.startsWith(projectsBase + path.sep)) {
    try { if (fs.existsSync(flatHist)) fs.rmSync(flatHist, { recursive: true, force: true }); } catch (_) {}
  }
  return dirOk;
});

ipcMain.handle('projects:duplicate', async (_e, { sourceProjectId, newName } = {}) => {
  try {
    if (!sourceProjectId || typeof sourceProjectId !== 'string')
      return { ok: false, error: 'sourceProjectId 필수', code: 'invalid' };
    if (!/^proj_\d+$/.test(sourceProjectId))
      return { ok: false, error: 'proj_* 만 복제 가능', code: 'not_proj' };
    // source dual-read — 신 위치 우선, flat fallback
    const srcJsonPath = _resolveProjectJsonPath(sourceProjectId);
    if (!srcJsonPath || !fs.existsSync(srcJsonPath))
      return { ok: false, error: '원본 프로젝트 없음', code: 'no_source' };

    // 새 ID — 동일 ms 빠른 연속 호출 방어. 신/구 둘 다 충돌 체크.
    let newId, t = Date.now();
    do { newId = `proj_${t}`; t++; }
    while (
      fs.existsSync(path.join(PROJECTS_DIR, newId)) ||              // 신 디렉터리
      fs.existsSync(path.join(PROJECTS_DIR, `${newId}.json`))        // flat 잔재
    );

    // JSON 복사 + 메타 갱신
    const src = JSON.parse(fs.readFileSync(srcJsonPath, 'utf8'));
    const dup = JSON.parse(JSON.stringify(src));
    const now = new Date().toISOString();
    const baseName = (newName && String(newName).trim()) || `${src.name || '이름 없음'} (사본)`;
    dup.id = newId; dup.name = baseName; dup.createdAt = now; dup.updatedAt = now;

    if (dup.branches && typeof dup.branches === 'object') {
      Object.values(dup.branches).forEach(b => {
        if (b && typeof b === 'object') { b.createdAt = Date.now(); b.updatedAt = Date.now(); }
      });
    }

    // blobPath 재매핑 — 절대경로/원본 ID 포함 케이스 방어
    const oldIdRe = new RegExp(`(["/])${sourceProjectId}/`, 'g');
    function rewriteBlobIfNeeded(s) {
      if (typeof s !== 'string') return s;
      if (/^(images|assets)\//.test(s)) return s;
      if (s.includes(`/${sourceProjectId}/`)) return s.replace(oldIdRe, `$1${newId}/`);
      return s;
    }
    function walkRewrite(obj) {
      if (!obj || typeof obj !== 'object') return;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (k === 'blobPath') obj[k] = rewriteBlobIfNeeded(v);
        else if (Array.isArray(v)) v.forEach(walkRewrite);
        else if (v && typeof v === 'object') walkRewrite(v);
      }
    }
    walkRewrite(dup);

    // 자산 폴더 복사 — tmp → rename으로 원자성
    // source 디렉터리는 항상 PROJECTS_DIR/<sourceProjectId>/ (claude-pm/images/assets 등은 이미 신 레이아웃)
    const srcDir = path.join(PROJECTS_DIR, sourceProjectId);
    const dstDir = path.join(PROJECTS_DIR, newId);
    const tmpDir = path.join(PROJECTS_DIR, `.${newId}.tmp`);
    if (fs.existsSync(srcDir)) {
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
        for (const sub of ['images', 'assets']) {
          const s = path.join(srcDir, sub);
          if (!fs.existsSync(s)) continue;
          fs.cpSync(s, path.join(tmpDir, sub), { recursive: true });
        }
        fs.renameSync(tmpDir, dstDir);
      } catch (e) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        const code = (e && e.code === 'ENOSPC') ? 'disk_full' : 'io';
        return { ok: false, error: `자산 폴더 복사 실패: ${e.message}`, code };
      }
    }

    // 신 레이아웃 경로 보장 (assets/images 복사가 없었던 경우에도 폴더 생성)
    const targetPaths = _ensureNewLayoutPaths(newId);

    // proj.json 쓰기 (atomic). 실패 시 dstDir 롤백.
    try {
      _atomicWriteFileSync(targetPaths.proj, JSON.stringify(dup, null, 2));
    } catch (e) {
      try { fs.rmSync(dstDir, { recursive: true, force: true }); } catch {}
      return { ok: false, error: `JSON 쓰기 실패: ${e.message}`, code: 'io' };
    }

    // meta 복사 (thumbnail 보존) — source dual-read, target은 신 위치 atomic
    const srcMeta = _resolveMetaJsonPath(sourceProjectId);
    if (srcMeta && fs.existsSync(srcMeta)) {
      try {
        const meta = JSON.parse(fs.readFileSync(srcMeta, 'utf8'));
        meta.id = newId; meta.name = baseName; meta.updatedAt = now;
        _atomicWriteFileSync(targetPaths.meta, JSON.stringify(meta, null, 2));
      } catch (e) { console.warn('[projects:duplicate] meta 복사 실패:', e.message); }
    }

    return { ok: true, newProjectId: newId, newName: baseName };
  } catch (e) {
    console.error('[projects:duplicate] 예외:', e);
    return { ok: false, error: e.message || '알 수 없는 오류', code: 'io' };
  }
});

/* ── IPC: Projects Meta (branches/commits/thumbnail 분리 저장) ── */
ipcMain.handle('projects:save-meta', (event, projectId, metaData) => {
  // write는 항상 신 위치 — proj_<id>/proj_meta.json
  const paths = _ensureNewLayoutPaths(projectId);
  _atomicWriteFileSync(paths.meta, JSON.stringify(metaData, null, 2));
  return { ok: true };
});

ipcMain.handle('projects:load-meta', (event, projectId) => {
  // read는 dual fallback — 신 우선, flat fallback
  const filePath = _resolveMetaJsonPath(projectId);
  if (!filePath) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
});

/* ── IPC: Intake (design-bot pipeline) ── */
const INTAKE_DIR = path.join(os.homedir(), 'Documents', 'design-bot-builder');
if (!fs.existsSync(INTAKE_DIR)) fs.mkdirSync(INTAKE_DIR, { recursive: true });

ipcMain.handle('intake:save', (event, data) => {
  if (!data || typeof data !== 'object') throw new Error('invalid data');
  const safeProduct = (data.product_name || 'unknown').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `intake_${safeProduct}_${dateStr}.json`;
  const filePath = path.join(INTAKE_DIR, filename);
  const payload = { ...data, ts: new Date().toISOString(), saved_to: filePath };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
  return { ok: true, filename, filePath };
});

ipcMain.handle('intake:load', (event, filename) => {
  try {
    const filePath = path.join(INTAKE_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return null; }
});

ipcMain.handle('intake:list', () => {
  try {
    if (!fs.existsSync(INTAKE_DIR)) return [];
    return fs.readdirSync(INTAKE_DIR)
      .filter(f => f.startsWith('intake_') && f.endsWith('.json'))
      .map(f => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(INTAKE_DIR, f), 'utf8'));
          return { filename: f, product_name: data.product_name, volume: data.volume, ts: data.ts };
        } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.ts) - new Date(a.ts));
  } catch { return []; }
});

/* ── IPC: Presets ── */
ipcMain.handle('fullscreen:get', () => mainWindow?.isFullScreen() ?? false);

// presets: 기본값은 앱 번들에서 userData로 초기 복사, 이후 userData만 사용
const PRESETS_DIR = path.join(USER_DATA_DIR, 'presets');
migrateFiles(path.join(__dirname, 'presets'), PRESETS_DIR); // 번들 기본값 + 구 경로 마이그레이션
if (!fs.existsSync(PRESETS_DIR)) fs.mkdirSync(PRESETS_DIR, { recursive: true });

ipcMain.handle('presets:read-all', () => {
  return fs.readdirSync(PRESETS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, f), 'utf8')));
});

ipcMain.handle('presets:save', (event, preset) => {
  const filePath = path.join(PRESETS_DIR, `${preset.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(preset, null, 2));
  return true;
});

ipcMain.handle('presets:delete', (event, presetId) => {
  const filePath = path.join(PRESETS_DIR, `${presetId}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
});

/* ── IPC: Figma Upload ── */
let _figmaUploadProc = null;

ipcMain.handle('figma:upload', (event, { channel, designJSON }) => {
  return new Promise((resolve) => {
    const tmpPath = path.join(os.tmpdir(), `sangpe_export_${Date.now()}.json`);
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(designJSON, null, 2), 'utf8');
    } catch (err) {
      return resolve({ success: false, logs: '파일 쓰기 실패: ' + err.message });
    }

    const scriptPath = path.join(__dirname, 'figma-renderer', 'sangpe_to_figma.mjs');
    const child = spawn('node', [scriptPath, channel, tmpPath], { encoding: 'utf-8' });
    _figmaUploadProc = child;

    let stdout = '', stderr = '';
    child.stdout?.on('data', d => { stdout += d; });
    child.stderr?.on('data', d => { stderr += d; });

    const cleanup = () => {
      _figmaUploadProc = null;
      try { fs.unlinkSync(tmpPath); } catch {}
    };

    const timer = setTimeout(() => {
      child.kill();
      cleanup();
      resolve({ success: false, logs: '❌ 타임아웃 (120초 초과)' });
    }, 120000);

    child.on('close', (code) => {
      clearTimeout(timer);
      cleanup();
      const logs = stdout + stderr;
      resolve({ success: code === 0, logs });
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      cleanup();
      resolve({ success: false, logs: '❌ 실행 오류: ' + err.message });
    });
  });
});

ipcMain.handle('figma:cancel-upload', () => {
  if (_figmaUploadProc) {
    _figmaUploadProc.kill();
    _figmaUploadProc = null;
    return true;
  }
  return false;
});

/* ── IPC: Figma Bridge (socket.js WebSocket 서버) ── */
const net = require('net');
let figmaBridgeProc = null;

async function checkPort3055() {
  // net.createServer 방식은 IPv6 wildcard와 충돌 시 오탐 발생
  // TCP connect 방식으로 실제 포트 활성화 여부 확인
  return new Promise(resolve => {
    const s = net.createConnection(3055, '127.0.0.1');
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
    s.setTimeout(500, () => { s.destroy(); resolve(false); });
  });
}

ipcMain.handle('figma-bridge-status', async () => checkPort3055());

function resolveBunPath() {
  const isWin = process.platform === 'win32';
  const exe = isWin ? 'bun.exe' : 'bun';
  const candidates = isWin
    ? [
        path.join(os.homedir(), '.bun', 'bin', exe),
        path.join(process.env.LOCALAPPDATA || '', 'Programs', 'bun', exe),
      ]
    : [
        path.join(os.homedir(), '.bun', 'bin', exe),
        '/opt/homebrew/bin/bun',
        '/usr/local/bin/bun',
      ];
  for (const p of candidates) {
    if (p && fs.existsSync(p)) return p;
  }
  return exe;
}

ipcMain.handle('figma-bridge-start', async () => {
  if (figmaBridgeProc) return { ok: true, msg: '이미 실행 중' };
  const bunPath = resolveBunPath();
  const installHint = 'Bun 런타임이 필요합니다. docs/BUN_SETUP.md 가이드를 참고해 설치해주세요.';
  try {
    figmaBridgeProc = spawn(bunPath, ['figma-plugin/socket.js'], {
      cwd: __dirname,
      detached: false,
      stdio: 'ignore',
      shell: process.platform === 'win32',
    });
  } catch (err) {
    return { ok: false, msg: `${installHint}\n(${err.message})`, needsBun: true };
  }
  let spawnFailed = false;
  figmaBridgeProc.on('error', (err) => {
    console.error('[figma-bridge] spawn error:', err.message);
    spawnFailed = true;
    figmaBridgeProc = null;
  });
  figmaBridgeProc.on('exit', () => { figmaBridgeProc = null; });
  await new Promise(r => setTimeout(r, 1500));
  if (spawnFailed) return { ok: false, msg: installHint, needsBun: true };
  return { ok: true };
});

ipcMain.handle('figma-bridge-stop', async () => {
  if (figmaBridgeProc) { figmaBridgeProc.kill(); figmaBridgeProc = null; }
  return { ok: true };
});

/* ── IPC: Node Map (섹션 ↔ Figma 노드 ID 매핑) ── */
const NODE_MAP_PATH = path.join(__dirname, 'figma-renderer', 'node_map.json');

ipcMain.handle('figma:read-node-map', () => {
  try {
    if (!fs.existsSync(NODE_MAP_PATH)) return {};
    return JSON.parse(fs.readFileSync(NODE_MAP_PATH, 'utf8'));
  } catch {
    return {};
  }
});

ipcMain.handle('figma:write-node-map', (event, nodeMap) => {
  try {
    fs.writeFileSync(NODE_MAP_PATH, JSON.stringify(nodeMap, null, 2), 'utf8');
    return true;
  } catch (err) {
    return false;
  }
});

/* ── IPC: Templates ── */
const TEMPLATES_DIR        = path.join(USER_DATA_DIR, 'templates');
const TEMPLATES_CANVAS_DIR = path.join(TEMPLATES_DIR, 'canvas');
const TEMPLATES_INDEX_FILE = path.join(TEMPLATES_DIR, 'index.json');
migrateFiles(path.join(__dirname, 'templates'), TEMPLATES_DIR); // 구 경로 마이그레이션
if (!fs.existsSync(TEMPLATES_CANVAS_DIR)) fs.mkdirSync(TEMPLATES_CANVAS_DIR, { recursive: true });

ipcMain.handle('templates:load-index', () => {
  // 구버전 templates.json → 분리 구조로 자동 마이그레이션
  const oldFile = path.join(TEMPLATES_DIR, 'templates.json');
  if (fs.existsSync(oldFile)) {
    try {
      const old = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
      const index = old.map(({ canvas, ...meta }) => {
        if (canvas) fs.writeFileSync(path.join(TEMPLATES_CANVAS_DIR, `${meta.id}.html`), canvas, 'utf8');
        return meta;
      });
      fs.writeFileSync(TEMPLATES_INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
      fs.unlinkSync(oldFile);
      return index;
    } catch { return []; }
  }
  if (!fs.existsSync(TEMPLATES_INDEX_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(TEMPLATES_INDEX_FILE, 'utf8')); } catch { return []; }
});

ipcMain.handle('templates:save-index', (event, index) => {
  fs.writeFileSync(TEMPLATES_INDEX_FILE, JSON.stringify(index, null, 2), 'utf8');
  return true;
});

ipcMain.handle('templates:load-canvas', (event, id) => {
  const filePath = path.join(TEMPLATES_CANVAS_DIR, `${id}.html`);
  if (!fs.existsSync(filePath)) return null;
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
});

ipcMain.handle('templates:save-canvas', (event, id, html) => {
  fs.writeFileSync(path.join(TEMPLATES_CANVAS_DIR, `${id}.html`), html, 'utf8');
  return true;
});

ipcMain.handle('templates:delete-canvas', (event, id) => {
  const filePath = path.join(TEMPLATES_CANVAS_DIR, `${id}.html`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
});

/* ── IPC: Section Screenshot (html2canvas flex 버그 우회) ── */
// webContents.capturePage + 윈도우 임시 리사이즈로 섹션 전체 캡처
ipcMain.handle('capture-section', async (event, { width, height }) => {
  // setContentSize 호출 없음 — 창 크기 변경이 layout reflow를 유발해 좌표가 어긋남
  // 렌더러가 청크 단위로 clone.style.top을 이동시켜 전체 섹션을 캡처함
  const cw = Math.ceil(width);
  const ch = Math.ceil(height);
  const img = await mainWindow.webContents.capturePage({ x: 0, y: 0, width: cw, height: ch });
  return img.toPNG().toString('base64');
});

/* ── IPC: Section Screenshot (CDP — captureBeyondViewport) ──
   기존 capture-section의 청크 캡쳐 동기화 버그(P1) 우회용.
   Page.captureScreenshot + captureBeyondViewport:true로 viewport 밖 영역까지
   한 번에 캡쳐 → clone.style.top 이동/청크 합성 불필요. */
ipcMain.handle('capture-section-cdp', async (event, { x = 0, y = 0, width, height } = {}) => {
  const dbg = mainWindow.webContents.debugger;
  if (!dbg.isAttached()) dbg.attach('1.3');
  // CDP clip.scale은 device pixel ratio가 아니라 **page zoom factor**. 항상 1로 고정.
  // x/y는 페이지 좌표계 — clone이 off-screen(top:-99999px)이어도 그 좌표로 캡쳐 가능
  // (captureBeyondViewport:true가 viewport 밖 + 음수 좌표 영역 모두 허용).
  const res = await dbg.sendCommand('Page.captureScreenshot', {
    format: 'png',
    clip: {
      x: Math.round(x),
      y: Math.round(y),
      width:  Math.ceil(width),
      height: Math.ceil(height),
      scale:  1,
    },
    captureBeyondViewport: true,
    fromSurface: true,
  });
  return res.data; // base64 PNG
});

/* ── IPC: Navigation (추후 구현) ── */
// ipcMain.handle('navigate', (event, page) => {
//   const pages = {
//     login:    'pages/login.html',
//     projects: 'pages/projects.html',
//     editor:   'index.html',
//   };
//   if (pages[page]) mainWindow.loadFile(pages[page]);
// });

/* ── 자동업데이트 ── */
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] 새 버전 발견:', info.version);
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '업데이트 준비 완료',
      message: `새 버전 (v${info.version})이 다운로드됐습니다.\n지금 재시작해서 적용할까요?`,
      buttons: ['재시작', '나중에'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[updater] 오류:', err.message);
  });

  autoUpdater.checkForUpdatesAndNotify();
}

/* ── App lifecycle ── */
app.whenReady().then(async () => {
  // 프로젝트 데이터 번들 레이아웃 마이그레이션 (flat → proj_<id>/ 디렉터리)
  // copy-then-verify 패턴이라 실패해도 flat 원본 보존 → 앱 시작 차단 X.
  // 머지 전이라 migrator 모듈이 없을 수 있어 best-effort.
  try {
    const migrator = _getMigrator();
    if (migrator && typeof migrator.migrateAll === 'function') {
      const result = await migrator.migrateAll(PROJECTS_DIR, {
        log: (lvl, msg) => console.log(`[migrator:${lvl}] ${msg}`),
      });
      console.log(
        `[migrator] migrated=${(result?.migrated || []).length},`,
        `skipped=${(result?.skipped || []).length},`,
        `failed=${(result?.failed || []).length}`
      );
    } else {
      console.log('[migrator] module not present — dual-read fallback active');
    }
  } catch (e) {
    console.error('[migrator] startup migration failed:', e);
    // 실패해도 앱은 계속 — IPC 핸들러의 flat fallback이 read 경로 보장
  }

  createWindow();
  watchFiles();
  // 개발 모드에서는 자동업데이트 스킵
  if (!process.argv.includes('--enable-logging')) {
    setupAutoUpdater();
  }
  // Claude PM MCP 서버 (포트 9345, port-status 표 9345+ 신규 자유)
  try {
    const { port: actualPort } = await startMcpServer({
      port: 9345,
      onActiveProject: () => global.currentActiveProjectId || null,
    });
    // EADDRINUSE fallback이 일어나도 ipc 핸들러가 올바른 포트로 ping
    setActualMcpPort(actualPort);
    // Phase 2 — renderer write bridge 주입 (mcp add_text_block 도구가 사용)
    setMcpRendererInvoker({ addTextBlock: _invokeRendererAddBlock });
  } catch (e) {
    console.warn('[claudePM MCP] start failed:', e.message);
  }
});

// ─── Phase 2 — renderer 측 write helper ────────────────────────────────────
// PM Claude의 MCP add_text_block 호출이 main을 거쳐 renderer의 window.addTextBlock을 호출.
// Codex 2차 리뷰 반영:
//   (1) 가드 + 호출을 *단일 atomic IIFE*로 합침 — 두 executeJavaScript 사이 race 차단
//   (2) _autoSaveInFlight 가드 제거 — save-load.js의 _isSavingToFile는 module-local이라 가드 작동 안 함.
//       active editing + recent key 두 가드로 충분
async function _invokeRendererAddBlock({ type = 'body', content = '', sectionId } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  // type/content/sectionId는 mcp-server에서 whitelist+길이 검증 후 들어옴. JSON.stringify로 escape.
  const safeType = JSON.stringify(String(type));
  const safeContent = JSON.stringify(String(content));
  const safeSectionId = sectionId ? JSON.stringify(String(sectionId)) : 'null';
  // 단일 atomic IIFE — 가드 + 섹션 보장 + addTextBlock + before/after 측정 + return
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic, renderer 한 frame 안에서 평가) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable ||
        ae.tagName === 'INPUT' ||
        ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const lastKey = window._lastUserKeydown || 0;
      const recentKey = (Date.now() - lastKey) < 1500;
      if (userEditing || recentKey) {
        return {
          ok: false,
          code: 'USER_BUSY',
          message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.',
          retryAfter: 2000,
          detail: { userEditing, recentKey }
        };
      }
      // ── 실제 호출 ──
      if (typeof window.addTextBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addTextBlock not found' };
      }
      const sid = ${safeSectionId};
      if (sid && typeof window.selectSection === 'function') {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (target) { try { window.selectSection(target); } catch (_) {} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const before = document.querySelectorAll('.text-block').length;
      window.addTextBlock(${safeType}, { content: ${safeContent} });
      const blocks = document.querySelectorAll('.text-block');
      const after = blocks.length;
      if (after <= before) {
        return { ok: false, code: 'NO_SECTION', message: '활성 섹션이 없어 블록을 추가하지 못했습니다.' };
      }
      const newBlock = blocks[blocks.length - 1];
      return {
        ok: true,
        blockId: newBlock?.id || null,
        pageId: window.activePageId || null,
        beforeCount: before,
        afterCount: after,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addTextBlock call failed: ' + e.message);
  }
}

/* ── 종료 전 강제 저장 ── */
app.on('before-quit', (event) => {
  // Claude PM MCP 서버 정리 (sync close, 폴백)
  try { stopMcpServer(); } catch (_) {}
  // Claude PM 내부 터미널 세션 모두 종료
  try { killAllTerminalSessions(); } catch (_) {}

  const win = BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) return; // 창 없으면 바로 종료
  event.preventDefault();
  win.webContents.send('force-save-before-quit');
  // 렌더러가 'quit-ready'를 보내면 실제 종료
  ipcMain.once('quit-ready', () => app.exit(0));
  // 3초 안에 응답 없으면 강제 종료 (데이터 손실 방어보다 행 방지 우선)
  setTimeout(() => app.exit(0), 3000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
