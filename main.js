const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
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
// 외부 자격증명 저장소(로컬 공유 시크릿) — GEMINI_API_KEY 등. iCloud dataless(EDEADLK) 회피 위해 ~/.config/secrets 로 일원화
_loadEnvFile(path.join(os.homedir(), '.config/secrets/.env'));
const { spawn } = require('child_process');
const { getPublicIp, findUserByIp, registerLicense, removeIp, updateIpAlias, updateUserName, createLicenseKey, listLicenseKeys } = require('./services/licenseService');
const { fillSectionTexts: geminiFill } = require('./services/geminiService');
const { fillSectionTexts: openaiFill } = require('./services/openaiService');
const { fillSectionTexts: anthropicFill } = require('./services/anthropicService');
const { generateImage: aiGenerateImage } = require('./services/imageGenService');
const { registerClaudePMIPC, setActualMcpPort, syncClaudePmTitle } = require('./main/claude-pm/ipc');
const { registerTerminalIPC, killAllSessions: killAllTerminalSessions } = require('./main/claude-pm/terminal');
const { startMcpServer, stopMcpServer, setRendererInvoker: setMcpRendererInvoker, setIconifyApi: setMcpIconifyApi } = require('./main/claude-pm/mcp-server');

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
  easterEggs: {
    fkeyHotkeys:      true,
    jokerBlock:       true,
    highlightBMode:   true,
    penMode:          true,
    hideGapLayers:    true,
    freeLayoutAnalyze: true,
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
      easterEggs: { ...DEFAULT_SETTINGS.easterEggs, ...(raw.easterEggs || {}) },
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
    easterEggs: { ...cur.easterEggs, ...(patch?.easterEggs || {}) },
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
    icon: path.join(__dirname, 'build/icon.png'),
    ...(isMac ? { titleBarStyle: 'hiddenInset' } : { titleBarStyle: 'default' }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // 다운로드(섹션 내보내기 등)는 다이얼로그 없이 Downloads에 바로 저장.
  // 핸들러가 없으면 Electron 기본 저장 다이얼로그에 의존 — 창이 가려진/숨겨진
  // 상태에서는 다이얼로그가 못 떠서 다운로드가 조용히 유실된다.
  mainWindow.webContents.session.on('will-download', (event, item) => {
    const dir = app.getPath('downloads');
    const base = item.getFilename() || 'export';
    let dest = path.join(dir, base);
    for (let n = 1; fs.existsSync(dest); n++) {
      const ext = path.extname(base);
      dest = path.join(dir, `${path.basename(base, ext)} (${n})${ext}`);
    }
    item.setSavePath(dest);
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

/* ── IPC: SVG Presets (사용자 자산 — 모든 프로젝트 공유) ── */
const SVG_PRESETS_DIR = path.join(USER_DATA_DIR, 'svg-presets');
if (!fs.existsSync(SVG_PRESETS_DIR)) fs.mkdirSync(SVG_PRESETS_DIR, { recursive: true });

ipcMain.handle('svgPresets:list', () => {
  try {
    const cats = fs.readdirSync(SVG_PRESETS_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const dir = path.join(SVG_PRESETS_DIR, d.name);
        const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.svg'));
        return {
          name: d.name,
          items: files.map(f => ({ name: f.replace(/\.svg$/i, ''), file: f })),
        };
      });
    return { ok: true, categories: cats };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('svgPresets:read', (_e, { category, file } = {}) => {
  try {
    if (!category || !file) return { ok: false, error: '카테고리/파일 필수' };
    // path traversal 방어
    if (/[/\\.]\./.test(category) || /[/\\.]\./.test(file) || /[\/\\]/.test(file)) {
      return { ok: false, error: '잘못된 경로' };
    }
    const fp = path.join(SVG_PRESETS_DIR, category, file);
    if (!fp.startsWith(SVG_PRESETS_DIR + path.sep)) return { ok: false, error: '디렉토리 이탈' };
    if (!fs.existsSync(fp)) return { ok: false, error: '파일 없음' };
    const svg = fs.readFileSync(fp, 'utf8');
    return { ok: true, svg };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('svgPresets:save', (_e, { category, name, svg } = {}) => {
  try {
    if (!category || !name || !svg) return { ok: false, error: '카테고리/이름/SVG 필수' };
    if (typeof svg !== 'string' || !svg.trim().startsWith('<')) return { ok: false, error: 'SVG 형식 아님' };
    // 안전 검증 — 스크립트/이벤트 핸들러 차단
    if (/<script\b/i.test(svg) || /on\w+\s*=/i.test(svg) || /javascript:/i.test(svg)) {
      return { ok: false, error: 'SVG에 스크립트 포함됨 (안전상 거부)' };
    }
    const safeCat = String(category).replace(/[\/\\]/g, '').replace(/^\./, '');
    const safeName = String(name).replace(/[\/\\:]/g, '').replace(/\.svg$/i, '').replace(/^\./, '');
    if (!safeCat || !safeName) return { ok: false, error: '잘못된 이름' };
    const catDir = path.join(SVG_PRESETS_DIR, safeCat);
    if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, { recursive: true });
    const fp = path.join(catDir, `${safeName}.svg`);
    fs.writeFileSync(fp, svg);
    return { ok: true, category: safeCat, file: `${safeName}.svg` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('svgPresets:createCategory', (_e, { name } = {}) => {
  try {
    if (!name || typeof name !== 'string') return { ok: false, error: '이름 필수' };
    const safe = name.trim().replace(/[\/\\:]/g, '').replace(/^\./, '');
    if (!safe) return { ok: false, error: '잘못된 이름' };
    const dir = path.join(SVG_PRESETS_DIR, safe);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return { ok: true, name: safe };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('svgPresets:delete', (_e, { category, file } = {}) => {
  try {
    if (!category || !file) return { ok: false, error: '카테고리/파일 필수' };
    if (/[\/\\]/.test(category) || /[\/\\]/.test(file)) return { ok: false, error: '잘못된 경로' };
    const fp = path.join(SVG_PRESETS_DIR, category, file);
    if (!fp.startsWith(SVG_PRESETS_DIR + path.sep)) return { ok: false, error: '디렉토리 이탈' };
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

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
      items.push({ id: data.id, name: data.name, type: data.type || null, createdAt: data.createdAt, updatedAt: data.updatedAt, thumbnail, marketRef: data.marketRef || null });
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
      items.push({ id: data.id, name: data.name, type: data.type || null, createdAt: data.createdAt, updatedAt: data.updatedAt, thumbnail, marketRef: data.marketRef || null });
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

// BUG-NAME-LOSS: 큰 프로젝트 load race에서 tab.name='Untitled' 상태로 save 들어와 진짜 이름이 'Untitled'로 덮어쓰이는 회귀 방어.
// prev.name이 'Untitled' 아닌 유의미한 이름인데 incoming.name이 비거나 'Untitled'이면 prev.name 유지.
// (사용자가 의도적으로 'Untitled'로 rename하는 케이스는 거의 없음 — rename UI는 빈 input만 'Untitled' 폴백)
function _guardProjectName(incomingProject, prevPath) {
  try {
    if (!prevPath || !fs.existsSync(prevPath)) return incomingProject;
    const prev = JSON.parse(fs.readFileSync(prevPath, 'utf8'));
    const prevName = prev && prev.name;
    const incomingName = incomingProject && incomingProject.name;
    const incomingFalsyOrDefault = !incomingName || incomingName === 'Untitled';
    const prevMeaningful = prevName && prevName !== 'Untitled';
    let guarded = incomingProject;
    if (incomingFalsyOrDefault && prevMeaningful) {
      console.warn(`[projects:save] name guard: '${incomingName}' → '${prevName}' 복원 (id=${incomingProject.id})`);
      guarded = { ...incomingProject, name: prevName };
    }
    // DATA-LOSS guard (H3): beforeunload sync 경로는 createdAt/type 없는 snapshot을 보내 verbatim write 시
    // 이 메타가 매 새로고침마다 소실됐다. 기존 파일에 있고 incoming에 없으면 보존한다.
    if (prev && (prev.createdAt != null || prev.type != null)) {
      const patch = {};
      if (prev.createdAt != null && guarded.createdAt == null) patch.createdAt = prev.createdAt;
      if (prev.type != null && guarded.type == null) patch.type = prev.type;
      if (Object.keys(patch).length) guarded = { ...guarded, ...patch };
    }
    return guarded;
  } catch (_) {}
  return incomingProject;
}

ipcMain.handle('projects:save', async (event, project) => {
  // write는 항상 신 위치. read(백업 직전 상태)는 dual fallback.
  const paths = _ensureNewLayoutPaths(project.id);
  const filePath = paths.proj;

  // 백업 만들 때는 마이그레이션 안 된 케이스도 대비 — 직전 버전이 flat에만 있을 수 있음.
  const prevPath = _resolveProjectJsonPath(project.id);
  project = _guardProjectName(project, prevPath);

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
    project = _guardProjectName(project, prevPath);
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
  // H2: 다중 writer(branch/commit/thumbnail/colorVars) lost update 방지.
  // 기존엔 verbatim 덮어쓰기라, 동시 writer가 각자 stale base를 읽어 마지막 writer가
  // 다른 필드를 되돌렸다. 핸들러에서 동기 read-merge-write 하면(Node 단일스레드라 핸들러 간
  // 동기 구간이 인터리브되지 않음) 서로 다른 top-level 필드가 모두 보존된다.
  let merged = metaData;
  try {
    if (fs.existsSync(paths.meta)) {
      const cur = JSON.parse(fs.readFileSync(paths.meta, 'utf8'));
      if (cur && typeof cur === 'object') merged = { ...cur, ...metaData };
    }
  } catch (_) { /* 손상 파일이면 incoming으로 신규 작성 */ }
  _atomicWriteFileSync(paths.meta, JSON.stringify(merged, null, 2));
  return { ok: true };
});

ipcMain.handle('projects:load-meta', (event, projectId) => {
  // read는 dual fallback — 신 우선, flat fallback
  const filePath = _resolveMetaJsonPath(projectId);
  if (!filePath) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
});

/* ── IPC: Marketplace (bnam91/goditor-market) ──────────────────────────────
   현재 프로젝트를 bnam91 깃 레포에 push / 마켓 목록 list / 선택 프로젝트 pull.
   gh CLI(인증됨) + git CLI 사용. 로컬 캐시: userData/goditor-market.
   레포 구조: market/<account>/<projectId>.json (payload: {id,name,account,updatedAt,data}) + 루트 index.json. */
const MARKET_SLUG = 'bnam91/goditor-market';
function _marketDir() { return path.join(app.getPath('userData'), 'goditor-market'); }
function _execFileP(cmd, args, opts = {}) {
  const { execFile } = require('child_process');
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 64 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
      if (err) reject(new Error(((stderr || '') + (err.message || '')).toString().trim()));
      else resolve((stdout || '').toString());
    });
  });
}
async function _ensureMarketRepo() {
  const dir = _marketDir();
  if (!fs.existsSync(path.join(dir, '.git'))) {
    try { await _execFileP('gh', ['repo', 'view', MARKET_SLUG]); }
    catch { await _execFileP('gh', ['repo', 'create', MARKET_SLUG, '--public', '-d', 'goditor 프로젝트 마켓플레이스']); }
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    try {
      await _execFileP('gh', ['repo', 'clone', MARKET_SLUG, dir]);
    } catch (e) {
      // 빈 레포 등 clone 실패 → 수동 init
      fs.mkdirSync(dir, { recursive: true });
      await _execFileP('git', ['-C', dir, 'init']);
      await _execFileP('git', ['-C', dir, 'remote', 'add', 'origin', `https://github.com/${MARKET_SLUG}.git`]).catch(() => {});
    }
    await _execFileP('git', ['-C', dir, 'branch', '-M', 'main']).catch(() => {});
    if (!fs.existsSync(path.join(dir, 'index.json'))) fs.writeFileSync(path.join(dir, 'index.json'), '[]');
  } else {
    await _execFileP('git', ['-C', dir, 'pull', '--ff-only']).catch(() => {});
  }
  // 큰 프로젝트(이미지 data URL 인라인 → 수십 MB) push 시 HTTP 400/RPC failed 방지.
  await _execFileP('git', ['-C', dir, 'config', 'http.postBuffer', '524288000']).catch(() => {});
  await _execFileP('git', ['-C', dir, 'config', 'http.version', 'HTTP/1.1']).catch(() => {});
  return dir;
}
function _rebuildMarketIndex(dir) {
  const root = path.join(dir, 'market');
  const idx = [];
  if (fs.existsSync(root)) {
    for (const account of fs.readdirSync(root)) {
      const adir = path.join(root, account);
      try { if (!fs.statSync(adir).isDirectory()) continue; } catch { continue; }
      for (const f of fs.readdirSync(adir)) {
        if (!f.endsWith('.json')) continue;
        try {
          const o = JSON.parse(fs.readFileSync(path.join(adir, f), 'utf-8'));
          idx.push({ account, id: o.id, name: o.name || o.id, updatedAt: o.updatedAt || null, version: o.version || null });
        } catch {}
      }
    }
  }
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(idx, null, 2));
  return idx;
}
const _safe = s => String(s || '').replace(/[^\w.-]/g, '_');
// ── Phase 0: 자산 blob 분리 ── 인라인 data:image base64를 market/_blobs/<sha256>.b64로 분리(dedup),
//    JSON엔 goditor-blob:<sha256> 참조만 남김. (단일 json 94.5MB→GitHub 100MB 한도 회피 + 중복 자산 1회 저장)
const _crypto = require('crypto');
const _BLOB_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;
const _MAX_BYTES = 95 * 1024 * 1024;   // GitHub 100MB 하드리밋 안전 마진
const _BLOB_MIN = 2048;                // 이보다 작은 자산은 분리 안 함(토큰이 더 커서 역효과 + blob 클러터 방지)
function _blobsDir(dir) { return path.join(dir, 'market', '_blobs'); }
function _extractBlobs(jsonStr, dir) {
  const bdir = _blobsDir(dir); fs.mkdirSync(bdir, { recursive: true });
  let maxBlob = 0, count = 0;
  const data = String(jsonStr).replace(_BLOB_RE, (m) => {
    if (Buffer.byteLength(m) < _BLOB_MIN) return m;   // 작은 자산은 인라인 유지
    const h = _crypto.createHash('sha256').update(m).digest('hex');
    const fp = path.join(bdir, h + '.b64');
    if (!fs.existsSync(fp)) fs.writeFileSync(fp, m);   // dedup: 동일 자산은 1회만
    const b = Buffer.byteLength(m); if (b > maxBlob) maxBlob = b; count++;
    return 'goditor-blob:' + h;
  });
  return { data, maxBlob, count };
}
function _inlineBlobs(jsonStr, dir) {
  const bdir = _blobsDir(dir);
  return String(jsonStr).replace(/goditor-blob:([a-f0-9]{64})/g, (m, h) => {
    try { return fs.readFileSync(path.join(bdir, h + '.b64'), 'utf-8'); } catch { return m; }  // 누락 시 토큰 유지(깨짐 가시화)
  });
}
// Phase 2: blob 분리된(=data URL 비결정성 제거된) 데이터 해시. push 시 1회 박제 → 가짜충돌 방지.
function _versionHash(deinlined) { return _crypto.createHash('sha256').update(String(deinlined)).digest('hex').slice(0, 16); }
ipcMain.handle('market:push', async (_e, { account, id, name, data, scratch, updatedAt } = {}) => {
  try {
    if (!account || !id || !data) return { ok: false, message: 'account/id/data 필요' };
    const dir = await _ensureMarketRepo();
    const acc = _safe(account), pid = _safe(id);
    const adir = path.join(dir, 'market', acc);
    fs.mkdirSync(adir, { recursive: true });
    // Phase 0: 인라인 자산 분리(프로젝트 데이터 + Phase1 스크래치) + 용량 가드
    const { data: deinlined, maxBlob: mb1, count: c1 } = _extractBlobs(data, dir);
    const scratchStr = JSON.stringify(scratch || []);
    const { data: deScratch, maxBlob: mb2, count: c2 } = _extractBlobs(scratchStr, dir);
    const maxBlob = Math.max(mb1, mb2);
    if (maxBlob > _MAX_BYTES) return { ok: false, message: `단일 자산 ${Math.round(maxBlob / 1048576)}MB — GitHub 100MB 한도 초과 위험. 자산 용량을 줄이세요.` };
    if (Buffer.byteLength(deinlined) + Buffer.byteLength(deScratch) > _MAX_BYTES) return { ok: false, message: `프로젝트 JSON ${Math.round((Buffer.byteLength(deinlined) + Buffer.byteLength(deScratch)) / 1048576)}MB — 한도 초과` };
    // Phase 2: 분리된 데이터(+스크래치)로 version 해시 박제
    const version = _versionHash(deinlined + '|' + deScratch);
    const payload = { id: pid, name: name || pid, account: acc, updatedAt: updatedAt || new Date().toISOString(), version, blobCount: c1 + c2, data: deinlined, scratch: deScratch };
    fs.writeFileSync(path.join(adir, `${pid}.json`), JSON.stringify(payload));
    _rebuildMarketIndex(dir);
    await _execFileP('git', ['-C', dir, 'add', '-A']);
    await _execFileP('git', ['-C', dir, 'commit', '-m', `market: ${acc}/${name || pid}`]).catch(() => {});
    await _execFileP('git', ['-C', dir, 'push', '-u', 'origin', 'main']);
    return { ok: true, account: acc, id: pid };
  } catch (e) { return { ok: false, message: e.message }; }
});
ipcMain.handle('market:list', async () => {
  try { const dir = await _ensureMarketRepo(); return { ok: true, items: _rebuildMarketIndex(dir) }; }
  catch (e) { return { ok: false, message: e.message }; }
});
ipcMain.handle('market:pull', async (_e, { account, id } = {}) => {
  try {
    const dir = await _ensureMarketRepo();
    const f = path.join(dir, 'market', _safe(account), `${_safe(id)}.json`);
    if (!fs.existsSync(f)) return { ok: false, message: '프로젝트 없음' };
    const proj = JSON.parse(fs.readFileSync(f, 'utf-8'));
    proj.data = _inlineBlobs(proj.data, dir);   // Phase 0: blob 참조 → data URL 복원
    if (proj.scratch) proj.scratch = _inlineBlobs(proj.scratch, dir);   // Phase 1: 스크래치 blob 복원
    return { ok: true, project: proj };
  } catch (e) { return { ok: false, message: e.message }; }
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
      resolve({ success: false, logs: '❌ 타임아웃 (3600초 초과)' });
    }, 3600000);

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
    // Phase 2/3 — renderer write bridge 주입
    setMcpRendererInvoker({
      addTextBlock: _invokeRendererAddBlock,
      editTextBlock: _invokeRendererEditBlock,
      addSection: _invokeRendererAddSection,
      addAssetBlock: _invokeRendererAddAssetBlock,
      buildBasicSection: _invokeRendererBuildBasicSection,
      getCanvasState: _invokeRendererGetCanvasState,
      listScratchItems: _invokeRendererListScratchItems,
      readScratchItem: _invokeRendererReadScratchItem,
      addGapBlock: _invokeRendererAddGapBlock,
      deleteSection: _invokeRendererDeleteSection,
      deleteBlock: _invokeRendererDeleteBlock,
      moveSection: _invokeRendererMoveSection,
      insertGapAfterBlock: _invokeRendererInsertGapAfterBlock,
      updateSection: _invokeRendererUpdateSection,
      addTableBlock: _invokeRendererAddTableBlock,
      addCardBlock: _invokeRendererAddCardBlock,
      updateCardBlock: _invokeRendererUpdateCardBlock,
      addChecklistItem: _invokeRendererAddChecklistItem,
      setSectionMemo: _invokeRendererSetSectionMemo,
      getSectionMemo: _invokeRendererGetSectionMemo,
      updateChecklistItem: _invokeRendererUpdateChecklistItem,
      addMockupBlock: _invokeRendererAddMockupBlock,
      updateMockupBlock: _invokeRendererUpdateMockupBlock,
      addBanner02Block: _invokeRendererAddBanner02Block,
      updateBanner02Block: _invokeRendererUpdateBanner02Block,
      updateFrameBlock: _invokeRendererUpdateFrameBlock,
      addIconifyBlock: _invokeRendererAddIconifyBlock,
      addComparisonBlock: _invokeRendererAddComparisonBlock,
      updateComparisonBlock: _invokeRendererUpdateComparisonBlock,
      addStepBlock: _invokeRendererAddStepBlock,
      updateStepBlock: _invokeRendererUpdateStepBlock,
      // ── 17-block batch (auto-appended) ──
      addLaurelBlock: _invokeRendererAddLaurelBlock,
      updateLaurelBlock: _invokeRendererUpdateLaurelBlock,
      addCanvasBlock: _invokeRendererAddCanvasBlock,
      updateCanvasBlock: _invokeRendererUpdateCanvasBlock,
      addChatBlock: _invokeRendererAddChatBlock,
      updateChatBlock: _invokeRendererUpdateChatBlock,
      addGradientBlock: _invokeRendererAddGradientBlock,
      updateGradientBlock: _invokeRendererUpdateGradientBlock,
      updateIconifyBlock: _invokeRendererUpdateIconifyBlock,
      addStickerBlock: _invokeRendererAddStickerBlock,
      updateStickerBlock: _invokeRendererUpdateStickerBlock,
      addVectorBlock: _invokeRendererAddVectorBlock,
      updateVectorBlock: _invokeRendererUpdateVectorBlock,
      addDividerBlock: _invokeRendererAddDividerBlock,
      updateDividerBlock: _invokeRendererUpdateDividerBlock,
      updateAssetBlock: _invokeRendererUpdateAssetBlock,
      updateTableBlock: _invokeRendererUpdateTableBlock,
      addIconCircleBlock: _invokeRendererAddIconCircleBlock,
      updateIconCircleBlock: _invokeRendererUpdateIconCircleBlock,
      addGraphBlock: _invokeRendererAddGraphBlock,
      updateGraphBlock: _invokeRendererUpdateGraphBlock,
      updateGapBlock: _invokeRendererUpdateGapBlock,
      addSpeechBubbleBlock: _invokeRendererAddSpeechBubbleBlock,
      updateSpeechBubbleBlock: _invokeRendererUpdateSpeechBubbleBlock,
      addLabelGroupBlock: _invokeRendererAddLabelGroupBlock,
      updateLabelGroupBlock: _invokeRendererUpdateLabelGroupBlock,
      addShapeBlock: _invokeRendererAddShapeBlock,
      updateShapeBlock: _invokeRendererUpdateShapeBlock,
      addIconTextBlock: _invokeRendererAddIconTextBlock,
      updateIconTextBlock: _invokeRendererUpdateIconTextBlock,
      // ── [APIMCP P1] 누락 add/update 도구 신설 ──
      addFrameBlock: _invokeRendererAddFrameBlock,
      addLinerBlock: _invokeRendererAddLinerBlock,
      updateLinerBlock: _invokeRendererUpdateLinerBlock,
      addBannerBlock: _invokeRendererAddBannerBlock,
    });
    // iconify search/svg fetch는 main에서 직접 (renderer CSP/외부 fetch 우회 + SSRF 가드)
    if (typeof setMcpIconifyApi === 'function') {
      setMcpIconifyApi({ search: _doIconifySearch, fetchSvg: _fetchIconifySvg });
    }
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
async function _invokeRendererAddBlock({ type = 'body', content = '', sectionId, align } = {}) {
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
  const safeAlign = align ? JSON.stringify(String(align)) : 'null';
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
      const _opts = { content: ${safeContent} };
      const _al = ${safeAlign};
      if (_al) _opts.align = _al;
      window.addTextBlock(${safeType}, _opts);
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

// ─── add_checklist_item — 체크리스트 항목(=핀) 추가 ─────────────────────────
async function _invokeRendererAddChecklistItem({ text, x, y, sectionId, done = false, urgent = false } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED' };
  const safeArgs = JSON.stringify({ text: String(text||''), x, y, sectionId, done: !!done, urgent: !!urgent });
  return await mainWindow.webContents.executeJavaScript(
    `(() => { try {
      if (typeof window.addChecklistItem !== 'function') return { ok:false, code:'API_MISSING' };
      const id = window.addChecklistItem(${safeArgs});
      return { ok:true, itemId: id };
    } catch(e) { return { ok:false, code:'EXCEPTION', message:e.message }; } })()`,
    true
  );
}

// ─── add_table_block — 표 블록 추가 (headers + rows 데이터 직접 주입) ────────
async function _invokeRendererAddTableBlock({ sectionId, headers, rows, showHeader = true, cellAlign = 'center' } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED' };
  const safeSid = sectionId ? JSON.stringify(String(sectionId)) : 'null';
  const safeHeaders = JSON.stringify(Array.isArray(headers) ? headers.map(h => String(h)) : null);
  const safeRows = JSON.stringify(Array.isArray(rows) ? rows.map(r => (Array.isArray(r) ? r.map(c => String(c)) : [String(r)])) : null);
  const safeAlign = JSON.stringify(['left','center','right'].includes(cellAlign) ? cellAlign : 'center');
  const sh = showHeader === false ? 'false' : 'true';
  return await mainWindow.webContents.executeJavaScript(
    `(() => { try {
      if (typeof window.addTableBlock !== 'function') return { ok:false, code:'API_MISSING' };
      const sid = ${safeSid};
      if (sid) {
        const sec = document.getElementById(sid);
        if (!sec) return { ok:false, code:'NOT_FOUND', message:'section not found: '+sid };
        if (typeof window.selectSection === 'function') window.selectSection(sec);
      }
      const beforeIds = new Set([...document.querySelectorAll('.table-block')].map(b => b.id));
      window.addTableBlock({ showHeader: ${sh}, cellAlign: ${safeAlign}, headers: ${safeHeaders}, rows: ${safeRows} });
      const newTb = [...document.querySelectorAll('.table-block')].find(b => !beforeIds.has(b.id));
      return { ok: true, tableBlockId: newTb?.id || null, rowCount: newTb?.querySelectorAll('tbody tr').length || 0 };
    } catch(e) { return { ok:false, code:'EXCEPTION', message:e.message }; } })()`,
    true
  );
}

// ─── add_card_block — 카드 블록(들) 추가 (cards 배열 직접 주입) ────────────
// 2026-06-08: PM이 card-block을 직접 생성 못 하던 한계 해결. 1 row + N cards.
// shared props(bgColor/radius/textAlign/titleSize/descSize)는 모든 카드에 동일 적용.
// 개별 카드 필드(title/desc/imgSrc/bg)는 cards[i]에서 지정.
// [APIMCP P0] card-block(cdb_) → canvas-block(cvb_, cardMode='simple') 재배선.
// window.addCardBlock은 더 이상 존재하지 않음 (card→canvas 전환, NewGrid seal 2026-06-08).
// add_card_block은 canvas simple-card 그리드(gridCols=N, cards[])로 위임 → cvb_ 블록 1개 생성.
// shared 옵션(bgColor/radius/textAlign/titleSize/descSize)을 canvas 필드로 매핑.
async function _invokeRendererAddCardBlock({ sectionId, cards, bgColor, radius, textAlign, titleSize, descSize } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태' };
  const list = Array.isArray(cards) ? cards : [];
  const n = Math.max(1, Math.min(8, list.length || 1));
  // cards → canvas simple-card 항목 매핑 (title/desc/imgSrc + cellBg = shared bgColor).
  const canvasCards = list.map(c => {
    const o = {};
    if (c && c.title  != null) o.title  = String(c.title);
    if (c && c.desc   != null) o.desc   = String(c.desc);
    if (c && c.imgSrc != null) o.imgSrc = String(c.imgSrc);
    if (bgColor != null) o.cellBg = String(bgColor);
    return o;
  });
  const opts = {
    cardMode: 'simple',
    gridCols: n,
    gridRows: 1,
    cards: canvasCards.length ? canvasCards : [{}],
  };
  if (radius    != null) opts.radius     = parseInt(radius);
  if (textAlign != null) opts.textAlign  = String(textAlign);
  if (titleSize != null) opts.titleSize  = parseInt(titleSize);
  if (descSize  != null) opts.descSize   = parseInt(descSize);
  if (bgColor   != null) opts.textBg     = String(bgColor);
  // canvas 경로로 위임 — 단일 cvb_ 블록(simple card grid) 생성.
  const res = await _invokeRendererAddCanvasBlock({ sectionId, ...opts });
  // 하위호환 응답 형태 유지 (cardBlockIds → cvb_ id 1개).
  if (res && res.ok && res.blockId) {
    return { ok: true, blockId: res.blockId, cardBlockIds: [res.blockId], count: 1, deprecated: 'card-block→canvas-block(cvb_) 위임' };
  }
  return res;
}

// [APIMCP P0] update_card_block → update_canvas_block 위임.
// window.updateCardBlock 미존재 (card→canvas 전환). cvb_ 단일카드 블록의 첫 카드(index 0)를
// patchCards로 갱신. cdb_ id는 더 이상 생성되지 않으므로 cvb_ 만 허용.
async function _invokeRendererUpdateCardBlock({ blockId, title, desc, imgSrc, bgColor, radius, textAlign, titleSize, descSize } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태' };
  const id = String(blockId || '');
  if (!id.startsWith('cvb_')) {
    return { ok: false, code: 'DEPRECATED', message: 'card-block(cdb_)은 canvas-block(cvb_)으로 통합됨. cvb_ id를 전달하거나 update_canvas_block을 사용하세요.' };
  }
  // 카드 항목 patch (index 0) + 블록 공통 필드를 canvas partial로 매핑.
  const card = {};
  if (title  !== undefined) card.title  = String(title);
  if (desc   !== undefined) card.desc   = String(desc);
  if (imgSrc !== undefined) card.imgSrc = imgSrc == null ? '' : String(imgSrc);
  if (bgColor !== undefined) card.cellBg = String(bgColor);
  const partial = {};
  if (Object.keys(card).length) partial.patchCards = [{ index: 0, ...card }];
  if (bgColor   !== undefined) partial.textBg    = String(bgColor);
  if (radius    !== undefined) partial.radius    = parseInt(radius);
  if (textAlign !== undefined) partial.textAlign = String(textAlign);
  if (titleSize !== undefined) partial.titleSize = parseInt(titleSize);
  if (descSize  !== undefined) partial.descSize  = parseInt(descSize);
  if (Object.keys(partial).length === 0) {
    return { ok: false, code: 'INVALID', message: 'no fields to update' };
  }
  return await _invokeRendererUpdateCanvasBlock({ blockId: id, partial });
}

// ─── update_section — 섹션 속성 (배경 등) 변경 ──────────────────────────────
async function _invokeRendererUpdateSection({ sectionId, bg } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED' };
  const safeSid = JSON.stringify(String(sectionId || ''));
  const safeBg  = bg !== undefined ? JSON.stringify(String(bg)) : 'null';
  return await mainWindow.webContents.executeJavaScript(
    `(() => { try {
      const sid = ${safeSid};
      const sec = document.getElementById(sid);
      if (!sec || !sec.classList.contains('section-block')) return { ok:false, code:'NOT_FOUND', message:'section not found: '+sid };
      const applied = {};
      const bgv = ${safeBg};
      if (bgv !== null) {
        if (typeof window.setSectionBg !== 'function') return { ok:false, code:'API_MISSING' };
        window.setSectionBg(sec, bgv);
        applied.bg = bgv;
      }
      return { ok:true, sectionId: sid, applied };
    } catch(e) { return { ok:false, code:'EXCEPTION', message:e.message }; } })()`,
    true
  );
}

// ─── delete_section / delete_block / move_section / insert_gap_after_block ──
async function _invokeRendererDeleteSection({ sectionId } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED' };
  const safe = JSON.stringify(String(sectionId || ''));
  return await mainWindow.webContents.executeJavaScript(
    `(() => { try {
      const ok = typeof window.deleteSection === 'function' && window.deleteSection(${safe});
      if (!ok) return { ok:false, code:'DELETE_FAILED', message:'섹션을 삭제할 수 없습니다 (없거나 마지막 섹션)' };
      return { ok:true, sectionId: ${safe}, remaining: document.querySelectorAll('.section-block').length };
    } catch(e) { return { ok:false, code:'EXCEPTION', message:e.message }; } })()`,
    true
  );
}

async function _invokeRendererDeleteBlock({ blockId } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED' };
  const safe = JSON.stringify(String(blockId || ''));
  return await mainWindow.webContents.executeJavaScript(
    `(() => { try {
      const el = document.getElementById(${safe});
      if (!el) return { ok:false, code:'NOT_FOUND', message:'block not found: '+${safe} };
      if (el.classList.contains('section-block')) return { ok:false, code:'IS_SECTION', message:'section은 delete_section 사용' };
      const ok = typeof window.deleteBlock === 'function' && window.deleteBlock(${safe});
      return { ok: !!ok, blockId: ${safe} };
    } catch(e) { return { ok:false, code:'EXCEPTION', message:e.message }; } })()`,
    true
  );
}

async function _invokeRendererMoveSection({ sectionId, beforeId, afterId } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED' };
  const safeSid = JSON.stringify(String(sectionId || ''));
  const safeB   = beforeId ? JSON.stringify(String(beforeId)) : 'null';
  const safeA   = afterId  ? JSON.stringify(String(afterId))  : 'null';
  return await mainWindow.webContents.executeJavaScript(
    `(() => { try {
      const sid = ${safeSid}, bId = ${safeB}, aId = ${safeA};
      const sec = document.getElementById(sid);
      if (!sec) return { ok:false, code:'NOT_FOUND', message:'section not found: '+sid };
      if (bId && !document.getElementById(bId)) return { ok:false, code:'NOT_FOUND', message:'beforeId not found' };
      if (aId && !document.getElementById(aId)) return { ok:false, code:'NOT_FOUND', message:'afterId not found' };
      const ok = window.moveSection(sid, { beforeId: bId, afterId: aId });
      return { ok: !!ok, sectionId: sid, beforeId: bId, afterId: aId };
    } catch(e) { return { ok:false, code:'EXCEPTION', message:e.message }; } })()`,
    true
  );
}

async function _invokeRendererInsertGapAfterBlock({ blockId, height = 40 } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED' };
  const h = Math.max(4, Math.min(800, parseInt(height) || 40));
  const safe = JSON.stringify(String(blockId || ''));
  return await mainWindow.webContents.executeJavaScript(
    `(() => { try {
      const el = document.getElementById(${safe});
      if (!el) return { ok:false, code:'NOT_FOUND', message:'block not found: '+${safe} };
      const gapId = window.insertGapAfterBlock(${safe}, ${h});
      return gapId ? { ok:true, gapBlockId: gapId, afterBlockId: ${safe}, height: ${h} }
                   : { ok:false, code:'INSERT_FAILED' };
    } catch(e) { return { ok:false, code:'EXCEPTION', message:e.message }; } })()`,
    true
  );
}

// ─── add_gap_block — 갭(spacer) 블록 추가 ────────────────────────────────────
async function _invokeRendererAddGapBlock({ height = 40, sectionId } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태' };
  const h = Math.max(4, Math.min(800, parseInt(height) || 40));
  const safeSid = sectionId ? JSON.stringify(String(sectionId)) : 'null';
  const atomicJs = `(async () => {
    try {
      if (typeof window.addGapBlock !== 'function') return { ok:false, code:'API_MISSING', message:'window.addGapBlock not found' };
      const targetSid = ${safeSid};
      if (targetSid) {
        const sec = document.getElementById(targetSid);
        if (sec && typeof window.selectSection === 'function') window.selectSection(sec);
        else if (!sec) return { ok:false, code:'SECTION_NOT_FOUND', message: 'section id not in DOM: ' + targetSid };
      }
      const before = document.querySelectorAll('.gap-block').length;
      window.addGapBlock(${h});
      const after = document.querySelectorAll('.gap-block').length;
      const allGaps = document.querySelectorAll('.gap-block');
      const last = allGaps[allGaps.length - 1];
      return { ok: true, height: ${h}, gapBlockId: last?.id || null, beforeCount: before, afterCount: after };
    } catch (e) { return { ok:false, code:'EXCEPTION', message: e.message }; }
  })()`;
  return await mainWindow.webContents.executeJavaScript(atomicJs, true);
}

// ─── 스크래치 아이템 조회 (renderer IndexedDB 메모리 접근) ───────────────────
async function _invokeRendererListScratchItems() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  return await mainWindow.webContents.executeJavaScript(
    '(typeof window._getScratchItemsForMCP === "function") ? window._getScratchItemsForMCP() : []',
    true
  );
}

async function _invokeRendererReadScratchItem(id, opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  // opts는 renderer에서 truncate 결정 → IPC payload 폭발 방지 (Codex #1)
  const safeId   = JSON.stringify(String(id || ''));
  const safeOpts = JSON.stringify({
    includeSrc:    !!opts.includeSrc,
    truncateSrcTo: Number.isFinite(opts.truncateSrcTo) ? opts.truncateSrcTo : 200,
  });
  return await mainWindow.webContents.executeJavaScript(
    `(typeof window._getScratchItemByIdForMCP === "function") ? window._getScratchItemByIdForMCP(${safeId}, ${safeOpts}) : null`,
    true
  );
}

// ─── update_block — 기존 텍스트 블록 수정 helper ─────────────────────────────
// add_text_block과 동일 패턴: 단일 atomic IIFE (동시수정 가드 + window.editTextBlock 호출).
async function _invokeRendererEditBlock({ blockId, content, color, fontSize, fontWeight, align } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  // blockId/필드는 mcp-server에서 검증 후 들어옴. JSON.stringify로 전부 escape.
  const safeBlockId = JSON.stringify(String(blockId));
  const safeContent = content !== undefined && content !== null ? JSON.stringify(String(content)) : 'null';
  const safeColor = color !== undefined && color !== null ? JSON.stringify(String(color)) : 'null';
  const safeFontSize = fontSize !== undefined && fontSize !== null ? JSON.stringify(fontSize) : 'null';
  const safeFontWeight = fontWeight !== undefined && fontWeight !== null ? JSON.stringify(String(fontWeight)) : 'null';
  const safeAlign = align !== undefined && align !== null ? JSON.stringify(String(align)) : 'null';
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic, renderer 한 frame 안에서 평가) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.editTextBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.editTextBlock not found' };
      }
      const _opts = {};
      const _content = ${safeContent};
      const _color = ${safeColor};
      const _fontSize = ${safeFontSize};
      const _fontWeight = ${safeFontWeight};
      const _align = ${safeAlign};
      if (_content !== null) _opts.content = _content;
      if (_color !== null) _opts.color = _color;
      if (_fontSize !== null) _opts.fontSize = _fontSize;
      if (_fontWeight !== null) _opts.fontWeight = _fontWeight;
      if (_align !== null) _opts.align = _align;
      return window.editTextBlock(${safeBlockId}, _opts);
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('editTextBlock call failed: ' + e.message);
  }
}

// ─── Phase 3 MVP — renderer 측 섹션 추가 helper ──────────────────────────────
// add_text_block과 동일 패턴: 단일 atomic IIFE (동시수정 가드 + window.addSection 호출).
async function _invokeRendererAddSection({ empty = false, bg, beforeId, afterId, sourceScratchIds } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const skipDefault = empty ? 'true' : 'false';
  const safeBg = bg ? JSON.stringify(String(bg)) : 'null';
  const safeBefore = beforeId ? JSON.stringify(String(beforeId)) : 'null';
  const safeAfter  = afterId  ? JSON.stringify(String(afterId))  : 'null';
  // sourceScratchIds — array of sp_xxx (이미 mcp-server에서 형식 검증)
  const safeScratch = Array.isArray(sourceScratchIds)
    ? JSON.stringify(sourceScratchIds.map(s => String(s)))
    : 'null';
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addSection !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addSection not found' };
      }
      const beforeIds = new Set([...document.querySelectorAll('.section-block')].map(s => s.id));
      const before = beforeIds.size;
      const opts = {};
      if (${skipDefault}) opts.skipDefaultBlock = true;
      const bgv = ${safeBg};
      if (bgv) opts.bg = bgv;
      const bId = ${safeBefore};
      const aId = ${safeAfter};
      if (bId) {
        if (!document.getElementById(bId)) return { ok:false, code:'NOT_FOUND', message:'beforeId not found: '+bId };
        opts.beforeId = bId;
      }
      if (aId) {
        if (!document.getElementById(aId)) return { ok:false, code:'NOT_FOUND', message:'afterId not found: '+aId };
        opts.afterId = aId;
      }
      const sScratch = ${safeScratch};
      if (Array.isArray(sScratch) && sScratch.length) opts.sourceScratchIds = sScratch;
      window.addSection(opts);
      const allSecs = [...document.querySelectorAll('.section-block')];
      const after = allSecs.length;
      if (after <= before) {
        return { ok: false, code: 'NO_ADD', message: '섹션이 추가되지 않았습니다.' };
      }
      const newSec = allSecs.find(s => !beforeIds.has(s.id));
      return { ok: true, sectionId: newSec?.id || null, sectionName: newSec?.dataset?.name || null, beforeCount: before, afterCount: after };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addSection call failed: ' + e.message);
  }
}

// ─── Phase 3 MVP — renderer 측 에셋(비율 프리셋) row 추가 helper ──────────────
// window.addPresetRow(preset) 호출. img1/img2/img3/text-img.
async function _invokeRendererAddAssetBlock({ preset = 'img1', sectionId, scratchId } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safePreset = JSON.stringify(String(preset));
  const safeSectionId = sectionId ? JSON.stringify(String(sectionId)) : 'null';
  const safeScratch   = scratchId ? JSON.stringify(String(scratchId)) : 'null';
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000 };
      }
      if (typeof window.addPresetRow !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addPresetRow not found' };
      }
      // 지정 섹션 타게팅 (add_text_block과 동일 패턴). 지정했는데 없으면 무음 폴백 대신 NOT_FOUND.
      const sid = ${safeSectionId};
      if (sid && typeof window.selectSection === 'function') {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) {
          return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        }
        try { window.selectSection(target); } catch (_) {}
      }
      // 활성 섹션 없으면 첫 섹션 자동 선택
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const before = document.querySelectorAll('.asset-block').length;
      const beforeIds = new Set([...document.querySelectorAll('.asset-block')].map(b => b.id));
      const scId = ${safeScratch};
      if (scId && typeof window.addAssetBlock === 'function') {
        // scratchId 전달 — renderer가 자체 IndexedDB에서 src 꺼내 박음 (IPC payload 폭발 회피)
        window.addAssetBlock(${safePreset}, { scratchId: scId });
      } else {
        window.addPresetRow(${safePreset});
      }
      const after = document.querySelectorAll('.asset-block').length;
      if (after <= before) {
        return { ok: false, code: 'NO_ADD', message: '에셋이 추가되지 않았습니다 (활성 섹션 확인).' };
      }
      const newAssets = [...document.querySelectorAll('.asset-block')].filter(b => !beforeIds.has(b.id));
      const lastNew = newAssets[newAssets.length - 1];
      return { ok: true, preset: ${safePreset}, assetBefore: before, assetAfter: after, assetBlockId: lastNew?.id || null, hasImage: !!(lastNew?.querySelector('.asset-img')?.src || lastNew?.dataset?.imgSrc) };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addPresetRow call failed: ' + e.message);
  }
}

// ─── Phase 3 MVP — 기본 섹션 한 번에 조립 ────────────────────────────────────
// 빈 섹션 → (label) → 메인카피(h1,100px) → 본문(body,30px) → 에셋(preset). 갭 100/50/30.
// insertAfterSelected의 하단갭-직전 누적 삽입 특성 + 각 함수의 selectSection(sec) 재선택 →
// 순차 호출이 위→아래 순서대로 쌓임.
async function _invokeRendererBuildBasicSection({ mainCopy = '', body = '', label = null, assetPreset = 'img1', align = 'center', sourceScratchIds } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const sMain = JSON.stringify(String(mainCopy));
  const sBody = JSON.stringify(String(body || ''));
  const sLabel = label ? JSON.stringify(String(label)) : 'null';
  const sPreset = JSON.stringify(String(assetPreset));
  const sAlign = JSON.stringify(['left', 'center', 'right'].includes(align) ? align : 'center');
  // sourceScratchIds — addSection 호출 시점에 dataset.memo에 자동 기록.
  // mcp-server에서 형식 검증 끝났으므로 여기선 stringify만.
  const sScratch = Array.isArray(sourceScratchIds)
    ? JSON.stringify(sourceScratchIds.map(s => String(s)))
    : 'null';
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000 };
      }
      for (const fn of ['addSection','addTextBlock','addGapBlock','addPresetRow']) {
        if (typeof window[fn] !== 'function') return { ok: false, code: 'API_MISSING', message: fn + ' not found' };
      }
      const secBefore = document.querySelectorAll('.section-block').length;
      const al = ${sAlign};
      // 1) 빈 섹션 (위아래 갭 100) — sourceScratchIds가 있으면 addSection이 dataset.memo에 자동 기록
      const _sScratch = ${sScratch};
      const _addOpts = { skipDefaultBlock: true, paddingY: 100 };
      if (Array.isArray(_sScratch) && _sScratch.length) _addOpts.sourceScratchIds = _sScratch;
      window.addSection(_addOpts);
      // 2) 라벨 (옵션) → 갭50
      const label = ${sLabel};
      if (label) {
        window.addTextBlock('label', { content: label, align: al });
        window.addGapBlock(50);
      }
      // 3) 메인카피 h1 (100px) → 갭30
      window.addTextBlock('h1', { content: ${sMain}, fontSize: 100, align: al });
      window.addGapBlock(30);
      // 4) 본문 body (30px) → 갭50
      const bodyText = ${sBody};
      if (bodyText) {
        window.addTextBlock('body', { content: bodyText, fontSize: 30, align: al });
        window.addGapBlock(50);
      }
      // 5) 에셋 (비율 프리셋)
      window.addPresetRow(${sPreset});

      const secAfter = document.querySelectorAll('.section-block').length;
      const newSec = document.querySelectorAll('.section-block')[secAfter - 1];
      return {
        ok: true,
        sectionId: newSec?.id || null,
        sectionName: newSec?.dataset?.name || null,
        blocksInSection: newSec ? newSec.querySelectorAll('.text-block, .asset-block').length : 0,
        secBefore, secAfter,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('buildBasicSection call failed: ' + e.message);
  }
}

// ─── PM get_canvas_state — renderer 측 READ-ONLY 캔버스 조회 helper ────────────
// 변경(mutation) 없음 → USER_BUSY 가드 불필요. null/destroyed 가드만 유지.
// (최소화 창도 읽기는 안전하므로 isMinimized 차단 안 함.)
async function _invokeRendererGetCanvasState({ sectionId } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  const safeSectionId = sectionId ? JSON.stringify(String(sectionId)) : 'null';
  const atomicJs = `(() => {
    try {
      if (typeof window.getCanvasState !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.getCanvasState not found' };
      }
      const sid = ${safeSectionId};
      return window.getCanvasState(sid);
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('getCanvasState call failed: ' + e.message);
  }
}

// ─── set_section_memo — 섹션 dataset.memo 갱신 ───────────────────────────────
// 메모는 attribute 저장이라 XSS 안전. textarea 사용자 동시 편집 race 방지 위해
// active editing 가드 적용 (사용자가 메모 textarea에 입력 중이면 USER_BUSY).
async function _invokeRendererSetSectionMemo({ sectionId, memo } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSid = JSON.stringify(String(sectionId || ''));
  const safeMemo = JSON.stringify(String(memo == null ? '' : memo));
  const atomicJs = `(() => {
    try {
      // 사용자가 동일 섹션 memo textarea 편집 중이면 race 방지 (보너스: 다른 곳 입력은 차단 안 함)
      const ae = document.activeElement;
      if (ae && ae.id === 'sec-memo') {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 메모를 편집 중입니다.', retryAfter: 2000 };
      }
      if (typeof window.setSectionMemo !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.setSectionMemo not found' };
      }
      const result = window.setSectionMemo(${safeSid}, ${safeMemo});
      // prop 패널이 열려 있고 같은 섹션이면 textarea도 즉시 동기화
      if (result && result.ok) {
        const memoEl = document.getElementById('sec-memo');
        const sec = document.getElementById(${safeSid});
        if (memoEl && sec && sec.classList.contains('selected')) {
          memoEl.value = sec.dataset.memo || '';
          const counter = document.getElementById('sec-memo-counter');
          if (counter && typeof window.SECTION_MEMO_MAX_LEN === 'number') {
            counter.textContent = [...memoEl.value].length + ' / ' + window.SECTION_MEMO_MAX_LEN;
          }
        }
      }
      return result;
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('setSectionMemo call failed: ' + e.message);
  }
}

// ─── get_section_memo — 섹션 dataset.memo 조회 (read-only, USER_BUSY 가드 불필요) ──
async function _invokeRendererGetSectionMemo({ sectionId } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  const safeSid = JSON.stringify(String(sectionId || ''));
  const atomicJs = `(() => {
    try {
      if (typeof window.getSectionMemo !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.getSectionMemo not found' };
      }
      return window.getSectionMemo(${safeSid});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('getSectionMemo call failed: ' + e.message);
  }
}

// ─── update_checklist_item — 체크리스트 항목 부분 갱신 (text/done/urgent) ────
// USER_BUSY 가드: 사용자가 체크리스트 인라인 편집 중이면 (.ck-inline-input 등) MCP write 차단.
// renderChecklistPanel()이 input을 unmount하면서 blur save가 stale closure로 덮는 race 방지 (Codex 리뷰 #1).
async function _invokeRendererUpdateChecklistItem({ id, text, done, urgent, x, y } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const args = { id: String(id || '') };
  if (text   !== undefined) args.text = String(text);
  if (done   !== undefined) args.done = !!done;
  if (urgent !== undefined) args.urgent = !!urgent;
  if (x      !== undefined) args.x = (typeof x === 'number') ? x : null;
  if (y      !== undefined) args.y = (typeof y === 'number') ? y : null;
  const safeArgs = JSON.stringify(args);
  return await mainWindow.webContents.executeJavaScript(
    `(() => { try {
      if (typeof window.updateChecklistItem !== 'function') return { ok:false, code:'API_MISSING' };
      // 체크리스트 인라인 편집 race 가드 (Codex #1): focus가 ck-inline-input / ck-pin-popup-text 안이면 거부
      const ae = document.activeElement;
      if (ae && (ae.classList?.contains('ck-inline-input')
                || ae.classList?.contains('ck-pin-popup-text')
                || (ae.closest && ae.closest('.ck-item, .todo-pin-popup, .ck-inline-input')))) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 체크리스트를 편집 중입니다.', retryAfter: 2000 };
      }
      return window.updateChecklistItem(${safeArgs});
    } catch(e) { return { ok:false, code:'EXCEPTION', message:e.message }; } })()`,
    true
  );
}

// ─── add_mockup_block — 휴대폰/태블릿/PC 목업 블록 추가 ─────────────────────
// add_asset_block과 동일 패턴: 단일 atomic IIFE (USER_BUSY 가드 + window.addMockupBlock 호출).
// imgSrc는 dataURL 가능 — main↔renderer IPC payload 한도 고려해 mcp-server에서 길이 제한.
async function _invokeRendererAddMockupBlock({ deviceKey, width, sectionId, imgSrc, shadow } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  // 모든 인자 stringify로 escape (이미지 URL '/'/" 안전)
  const args = { deviceKey: String(deviceKey || '') };
  if (width !== undefined && width !== null) args.width = parseInt(width);
  if (sectionId) args.sectionId = String(sectionId);
  if (imgSrc !== undefined && imgSrc !== null) args.imgSrc = String(imgSrc);
  if (shadow !== undefined && shadow !== null) args.shadow = String(shadow);
  const safeArgs = JSON.stringify(args);

  const atomicJs = `(() => {
    try {
      // USER_BUSY 가드 — 다른 write tool과 동일.
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000 };
      }
      if (typeof window.addMockupBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addMockupBlock not found' };
      }
      return window.addMockupBlock(${safeArgs});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;

  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addMockupBlock call failed: ' + e.message);
  }
}

// ─── update_mockup_block — 기존 목업 블록 부분 수정 ─────────────────────────
async function _invokeRendererUpdateMockupBlock({ blockId, deviceKey, width, imgSrc, shadow } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const args = { blockId: String(blockId || '') };
  if (deviceKey !== undefined && deviceKey !== null) args.deviceKey = String(deviceKey);
  if (width     !== undefined && width     !== null) args.width = parseInt(width);
  if (imgSrc    !== undefined && imgSrc    !== null) args.imgSrc = String(imgSrc);
  if (shadow    !== undefined && shadow    !== null) args.shadow = String(shadow);
  const safeArgs = JSON.stringify(args);
  const safeBlockId = JSON.stringify(args.blockId);

  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000 };
      }
      if (typeof window.updateMockupBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateMockupBlock not found' };
      }
      const args = ${safeArgs};
      return window.updateMockupBlock(${safeBlockId}, args);
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;

  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateMockupBlock call failed: ' + e.message);
  }
}

// ─── add_banner02_block — banner02 블록 추가 (data 옵션 풀세트) ──────────────
// add_text_block과 동일 패턴: 단일 atomic IIFE (동시수정 가드 + window.addBanner02Block).
// mcp-server에서 type/length 검증 후 들어옴. 여기선 JSON.stringify로 전부 escape.
async function _invokeRendererAddBanner02Block(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  // opts에서 sectionId 분리해서 dataOpts만 makeBanner02Block에 전달 (sectionId는 selectSection용)
  const dataOpts = { ...opts };
  delete dataOpts.sectionId;
  const safeData = JSON.stringify(dataOpts);
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addBanner02Block !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addBanner02Block not found' };
      }
      // 지정 섹션 타게팅 (add_asset_block 패턴)
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.banner02-block')].map(b => b.id));
      const result = window.addBanner02Block(${safeData});
      const blocks = [...document.querySelectorAll('.banner02-block')];
      const newBlock = (result && result.block) || blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'banner02-block이 추가되지 않았습니다.' };
      }
      return {
        ok: true,
        blockId: newBlock.id,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addBanner02Block call failed: ' + e.message);
  }
}

// ─── update_banner02_block — 기존 banner02 블록 부분 수정 ────────────────────
// 텍스트(label/title/sub)·색상·이미지·레이아웃 partial update. editTextBlock 패턴 미러.
async function _invokeRendererUpdateBanner02Block({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  // partial은 mcp-server에서 검증 후 들어옴. JSON.stringify로 escape.
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateBanner02Block !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateBanner02Block not found' };
      }
      return window.updateBanner02Block(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateBanner02Block call failed: ' + e.message);
  }
}

async function _invokeRendererUpdateFrameBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  // partial은 mcp-server에서 검증 후 들어옴. JSON.stringify로 escape.
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) — banner02 패턴 미러 ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateFrameBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateFrameBlock not found' };
      }
      return window.updateFrameBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateFrameBlock call failed: ' + e.message);
  }
}

// ─── iconify: search + svg fetch (main 측에서 직접, renderer CSP/외부 fetch 우회 + SSRF 가드) ──
// prefix/name 화이트리스트는 mcp-server.js에서 strict 검증 후 들어옴.
// 여기선 URL 조립 시 한 번 더 sanity check.
const _ICONIFY_API_BASE = 'https://api.iconify.design';
const _ICONIFY_PREFIX_RE = /^[a-z0-9-]{2,32}$/;
const _ICONIFY_NAME_RE   = /^[a-z0-9-]{1,80}$/;
const _ICONIFY_TIMEOUT_MS = 8000;

// Codex Medium 픽스: parse 콜백을 받아 body 읽기까지 같은 AbortController로 보호.
// 기존엔 fetch resolve 직후 clearTimeout — 본문 stall 시 무한 대기 가능했음.
async function _fetchWithTimeout(url, parse, ms = _ICONIFY_TIMEOUT_MS) {
  const ctl = new AbortController();
  const tid = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, redirect: 'error' });
    if (!res.ok) return { ok: false, status: res.status, body: null };
    const body = parse ? await parse(res) : null;
    return { ok: true, status: res.status, body };
  } finally {
    clearTimeout(tid);
  }
}

async function _doIconifySearch({ query, prefix, limit = 10 } = {}) {
  if (typeof query !== 'string' || !query.trim()) {
    return { ok: false, code: 'INVALID', message: 'query required' };
  }
  const q = query.trim().slice(0, 100);
  const lim = Math.max(1, Math.min(30, parseInt(limit, 10) || 10));
  let url = `${_ICONIFY_API_BASE}/search?query=${encodeURIComponent(q)}&limit=${lim}`;
  if (prefix) {
    if (!_ICONIFY_PREFIX_RE.test(prefix)) {
      return { ok: false, code: 'INVALID', message: `invalid prefix: ${prefix}` };
    }
    url += `&prefix=${encodeURIComponent(prefix)}`;
  }
  try {
    const r = await _fetchWithTimeout(url, res => res.json());
    if (!r.ok) return { ok: false, code: 'HTTP_ERROR', message: `iconify search HTTP ${r.status}` };
    const data = r.body || {};
    const icons = Array.isArray(data.icons) ? data.icons : [];
    const out = icons.map((full) => {
      const idx = full.indexOf(':');
      if (idx < 0) return null;
      return { fullName: full, prefix: full.slice(0, idx), name: full.slice(idx + 1) };
    }).filter(Boolean);
    return { ok: true, total: data.total || out.length, query: q, prefix: prefix || null, icons: out };
  } catch (e) {
    return { ok: false, code: 'NETWORK_ERROR', message: e.message || String(e) };
  }
}

async function _fetchIconifySvg({ prefix, name, color } = {}) {
  if (!_ICONIFY_PREFIX_RE.test(prefix || '')) {
    return { ok: false, code: 'INVALID', message: `invalid prefix: ${prefix}` };
  }
  if (!_ICONIFY_NAME_RE.test(name || '')) {
    return { ok: false, code: 'INVALID', message: `invalid name: ${name}` };
  }
  let url = `${_ICONIFY_API_BASE}/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`;
  if (color) url += `?color=${encodeURIComponent(color)}`;
  try {
    const r = await _fetchWithTimeout(url, res => res.text());
    if (!r.ok) return { ok: false, code: 'HTTP_ERROR', message: `iconify svg HTTP ${r.status}` };
    const svg = r.body || '';
    // 정합성 + XSS 추가 가드: iconify 공식 응답은 정제됨이지만 방어적으로 한 번 더 거름.
    if (!svg || svg.length > 200000) return { ok: false, code: 'INVALID_SVG', message: 'empty or too large svg' };
    if (!/^\s*<svg\b/i.test(svg)) return { ok: false, code: 'INVALID_SVG', message: 'not an svg' };
    if (/<script\b|on\w+\s*=|javascript:/i.test(svg)) {
      return { ok: false, code: 'UNSAFE_SVG', message: 'svg contains script/event handler' };
    }
    return { ok: true, svg };
  } catch (e) {
    return { ok: false, code: 'NETWORK_ERROR', message: e.message || String(e) };
  }
}

// add_iconify_block renderer bridge: main에서 svg fetch 후 renderer에 atomic 삽입.
// banner02/mockup 패턴 미러 (USER_BUSY 가드 + before/after diff로 새 blockId 추출).
async function _invokeRendererAddIconifyBlock({ sectionId, name, svg, size = 96 } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = sectionId ? JSON.stringify(String(sectionId)) : 'null';
  const safeName = JSON.stringify(String(name || ''));
  const safeSvg  = JSON.stringify(String(svg  || ''));
  const safeSize = Number.isFinite(size) ? Math.max(16, Math.min(512, parseInt(size, 10))) : 96;
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addIconifyBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addIconifyBlock not found' };
      }
      // 지정 섹션 타게팅
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.icon-block')].map(b => b.id));
      const result = window.addIconifyBlock(${safeName}, ${safeSvg}, ${safeSize});
      const blocks = [...document.querySelectorAll('.icon-block')];
      const newBlock = (result && result.block) || blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'icon-block이 추가되지 않았습니다.' };
      }
      const sec = (typeof window.getSelectedSection === 'function') ? window.getSelectedSection() : null;
      return {
        ok: true,
        blockId: newBlock.id,
        sectionId: sec ? sec.id : null,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addIconifyBlock call failed: ' + e.message);
  }
}

// ─── add_comparison_block — comparison(N칼럼 비교) 블록 추가 ──────────────────
// banner02 패턴 미러: USER_BUSY 가드 + before/after .comparison-block diff로 blockId 추출.
async function _invokeRendererAddComparisonBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  const dataOpts = { ...opts };
  delete dataOpts.sectionId;
  const safeData = JSON.stringify(dataOpts);
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addComparisonBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addComparisonBlock not found' };
      }
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.comparison-block')].map(b => b.id));
      const result = window.addComparisonBlock(${safeData});
      const blocks = [...document.querySelectorAll('.comparison-block')];
      const newBlock = (result && result.block) || blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'comparison-block이 추가되지 않았습니다.' };
      }
      const sec = (typeof window.getSelectedSection === 'function') ? window.getSelectedSection() : null;
      return {
        ok: true,
        blockId: newBlock.id,
        sectionId: sec ? sec.id : null,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addComparisonBlock call failed: ' + e.message);
  }
}

// ─── update_comparison_block — 기존 comparison 블록 부분 수정 ────────────────
async function _invokeRendererUpdateComparisonBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateComparisonBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateComparisonBlock not found' };
      }
      return window.updateComparisonBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateComparisonBlock call failed: ' + e.message);
  }
}

// ─── add_step_block — 단계 표시 블록 추가 (banner02 패턴 미러) ────────────────
async function _invokeRendererAddStepBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  const dataOpts = { ...opts };
  delete dataOpts.sectionId;
  const safeData = JSON.stringify(dataOpts);
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addStepBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addStepBlock not found' };
      }
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.step-block')].map(b => b.id));
      const result = window.addStepBlock(${safeData});
      const blocks = [...document.querySelectorAll('.step-block')];
      const newBlock = (result && result.block) || blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'step-block이 추가되지 않았습니다.' };
      }
      const sec = (typeof window.getSelectedSection === 'function') ? window.getSelectedSection() : null;
      return {
        ok: true,
        blockId: newBlock.id,
        sectionId: sec ? sec.id : null,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addStepBlock call failed: ' + e.message);
  }
}

// ─── update_step_block — 기존 step-block 부분 수정 (banner02 패턴 미러) ───────
async function _invokeRendererUpdateStepBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateStepBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateStepBlock not found' };
      }
      return window.updateStepBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateStepBlock call failed: ' + e.message);
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// 17-BLOCK BATCH (auto-appended): primary 7 + secondary 10 renderer invokers
// ═══════════════════════════════════════════════════════════════════════════
// ─── primary_laurel.json ─── auto-appended (17-block batch) ─────────────────────
// ─── add_laurel_block — laurel(월계수) 블록 추가 (data 옵션 풀세트) ──────────
// add_banner02_block과 동일 패턴: 단일 atomic IIFE (동시수정 가드 + window.addLaurelBlock).
async function _invokeRendererAddLaurelBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  const dataOpts = { ...opts };
  delete dataOpts.sectionId;
  const safeData = JSON.stringify(dataOpts);
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addLaurelBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addLaurelBlock not found' };
      }
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.laurel-block')].map(b => b.id));
      window.addLaurelBlock(${safeData});
      const blocks = [...document.querySelectorAll('.laurel-block')];
      const newBlock = blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'laurel-block이 추가되지 않았습니다.' };
      }
      return {
        ok: true,
        blockId: newBlock.id,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addLaurelBlock call failed: ' + e.message);
  }
}

// ─── update_laurel_block — 기존 laurel 블록 부분 수정 ────────────────────────
async function _invokeRendererUpdateLaurelBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateLaurelBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateLaurelBlock not found' };
      }
      return window.updateLaurelBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateLaurelBlock call failed: ' + e.message);
  }
}

// 그리고 main.js의 setRendererInvoker({...}) 호출 객체 (라인 ~1246-1248 근처)에 두 메서드 등록:
//   addLaurelBlock:    _invokeRendererAddLaurelBlock,
//   updateLaurelBlock: _invokeRendererUpdateLaurelBlock,

// ─── primary_canvas.json ─── auto-appended (17-block batch) ─────────────────────
// ─── add_canvas_block — canvas 블록 추가 (data 옵션 풀세트) ─────────────────
// _invokeRendererAddBanner02Block 패턴 미러: 단일 atomic IIFE (동시수정 가드 + window.addCanvasBlock).
async function _invokeRendererAddCanvasBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  const dataOpts = { ...opts };
  delete dataOpts.sectionId;
  const safeData = JSON.stringify(dataOpts);
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addCanvasBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addCanvasBlock not found' };
      }
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.canvas-block')].map(b => b.id));
      const result = window.addCanvasBlock(${safeData});
      const blocks = [...document.querySelectorAll('.canvas-block')];
      const newBlock = (result && result.block) || blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'canvas-block이 추가되지 않았습니다.' };
      }
      return {
        ok: true,
        blockId: newBlock.id,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addCanvasBlock call failed: ' + e.message);
  }
}

// ─── update_canvas_block — canvas 블록 부분 수정 ─────────────────────────────
// _invokeRendererUpdateBanner02Block 패턴 미러.
async function _invokeRendererUpdateCanvasBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateCanvasBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateCanvasBlock not found' };
      }
      return window.updateCanvasBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateCanvasBlock call failed: ' + e.message);
  }
}

// ─── [APIMCP P1] add_frame_block — frame-block(ss_) 컨테이너 추가 ─────────────
// window.addFrameBlock({fullWidth, bg, radius}) 위임. add 후 update_frame_block(ss_, partial)로 수정.
async function _invokeRendererAddFrameBlock({ sectionId, fullWidth, bg, radius } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  const safeSid = sectionId ? JSON.stringify(String(sectionId)) : 'null';
  const opts = {};
  if (fullWidth === true) opts.fullWidth = true;
  if (bg != null) opts.bg = String(bg);
  if (radius != null) opts.radius = parseInt(radius);
  const safeOpts = JSON.stringify(opts);
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addFrameBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addFrameBlock not found' };
      }
      const sid = ${safeSid};
      if (sid) {
        const sec = document.getElementById(sid);
        if (!sec) return { ok:false, code:'NOT_FOUND', message:'section not found: ' + sid };
        if (typeof window.selectSection === 'function') window.selectSection(sec);
      }
      const beforeIds = new Set([...document.querySelectorAll('.frame-block')].map(b => b.id));
      window.addFrameBlock(${safeOpts});
      const blocks = [...document.querySelectorAll('.frame-block')];
      const newBlock = blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) return { ok: false, code: 'NO_ADD', message: 'frame-block이 추가되지 않았습니다.' };
      if (typeof window.triggerAutoSave === 'function') window.triggerAutoSave();
      return { ok: true, blockId: newBlock.id, pageId: window.activePageId || null };
    } catch(e) { return { ok:false, code:'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addFrameBlock call failed: ' + e.message);
  }
}

// ─── [APIMCP P1] add_liner_block — liner-block(lnr_, 곡선/원형 텍스트) 추가 ───
// window.addLinerBlock(preset) 위임 + 생성 직후 text/fontSize/curvature/letterSpacing/startAngle를
// 미러(.tb-liner)에 반영하고 window.applyLiner/applyLinerText로 SVG 재렌더.
async function _invokeRendererAddLinerBlock({ sectionId, preset, text, fontSize, curvature, letterSpacing, startAngle } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  const safeSid    = sectionId ? JSON.stringify(String(sectionId)) : 'null';
  const safePreset = JSON.stringify(preset || 'arc-up');
  const cfg = {};
  if (curvature     != null) cfg.curvature     = Number(curvature);
  if (letterSpacing != null) cfg.letterSpacing = Number(letterSpacing);
  if (startAngle    != null) cfg.startAngle    = Number(startAngle);
  const safeCfg      = JSON.stringify(cfg);
  const safeText     = text     != null ? JSON.stringify(String(text)) : 'null';
  const safeFontSize = fontSize != null ? JSON.stringify(parseInt(fontSize)) : 'null';
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addLinerBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addLinerBlock not found' };
      }
      const sid = ${safeSid};
      if (sid) {
        const sec = document.getElementById(sid);
        if (!sec) return { ok:false, code:'NOT_FOUND', message:'section not found: ' + sid };
        if (typeof window.selectSection === 'function') window.selectSection(sec);
      }
      const beforeIds = new Set([...document.querySelectorAll('.liner-block')].map(b => b.id));
      window.addLinerBlock(${safePreset});
      const blocks = [...document.querySelectorAll('.liner-block')];
      const block = blocks.find(b => !beforeIds.has(b.id));
      if (!block) return { ok: false, code: 'NO_ADD', message: 'liner-block이 추가되지 않았습니다.' };
      // 텍스트/폰트크기 — 미러(.tb-liner)가 SSOT.
      const mirror = block.querySelector('.tb-liner');
      const _text = ${safeText};
      const _fs   = ${safeFontSize};
      if (mirror) {
        if (_text !== null) {
          mirror.textContent = _text;
          mirror.dataset.isPlaceholder = 'false';
        }
        if (_fs !== null) mirror.style.fontSize = _fs + 'px';
      }
      // curvature/letterSpacing/startAngle + 텍스트 재렌더.
      const _cfg = Object.assign({ preset: ${safePreset} }, ${safeCfg});
      if (typeof window.applyLiner === 'function') window.applyLiner(block, _cfg);
      if (typeof window.applyLinerText === 'function') window.applyLinerText(block);
      if (typeof window.triggerAutoSave === 'function') window.triggerAutoSave();
      return { ok: true, blockId: block.id, pageId: window.activePageId || null };
    } catch(e) { return { ok:false, code:'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addLinerBlock call failed: ' + e.message);
  }
}

// ─── [APIMCP P1] update_liner_block — liner-block(lnr_) 부분 수정 ─────────────
// window.updateLinerBlock 미존재 → 미러(.tb-liner) 텍스트/폰트 직접 set + window.applyLiner로 재렌더.
async function _invokeRendererUpdateLinerBlock({ blockId, preset, text, fontSize, curvature, letterSpacing, startAngle } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  const safeId = JSON.stringify(String(blockId || ''));
  const cfg = {};
  if (preset        != null) cfg.preset        = String(preset);
  if (curvature     != null) cfg.curvature     = Number(curvature);
  if (letterSpacing != null) cfg.letterSpacing = Number(letterSpacing);
  if (startAngle    != null) cfg.startAngle    = Number(startAngle);
  const safeCfg      = JSON.stringify(cfg);
  const safeText     = text     != null ? JSON.stringify(String(text)) : 'null';
  const safeFontSize = fontSize != null ? JSON.stringify(parseInt(fontSize)) : 'null';
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.applyLiner !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.applyLiner not found' };
      }
      const block = document.getElementById(${safeId});
      if (!block || !block.classList.contains('liner-block')) {
        return { ok: false, code: 'NOT_FOUND', message: 'liner-block not found: ' + ${safeId} };
      }
      if (typeof window.pushHistory === 'function') window.pushHistory();
      const mirror = block.querySelector('.tb-liner');
      const _text = ${safeText};
      const _fs   = ${safeFontSize};
      const applied = {};
      if (mirror) {
        if (_text !== null) { mirror.textContent = _text; mirror.dataset.isPlaceholder = 'false'; applied.text = _text; }
        if (_fs !== null)   { mirror.style.fontSize = _fs + 'px'; applied.fontSize = _fs; }
      }
      // 기존 dataset.liner 위에 cfg 머지 (preset 없으면 기존 유지).
      let prev = {};
      try { prev = JSON.parse(block.dataset.liner || '{}'); } catch(_) {}
      const _cfg = Object.assign({}, prev, ${safeCfg});
      Object.assign(applied, ${safeCfg});
      window.applyLiner(block, _cfg);
      if (typeof window.applyLinerText === 'function') window.applyLinerText(block);
      if (typeof window.triggerAutoSave === 'function') window.triggerAutoSave();
      return { ok: true, blockId: block.id, applied };
    } catch(e) { return { ok:false, code:'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateLinerBlock call failed: ' + e.message);
  }
}

// ─── [APIMCP P1] add_banner_block — banner(frame_8|wide_4x1) 프리셋 외곽 추가 ─
// window.addBannerBlock(presetKey) 위임. 생성 결과는 frame-block(ss_, bannerPreset set).
async function _invokeRendererAddBannerBlock({ sectionId, preset } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  const safeSid    = sectionId ? JSON.stringify(String(sectionId)) : 'null';
  const safePreset = JSON.stringify(preset || 'frame_8');
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addBannerBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addBannerBlock not found' };
      }
      if (!window.BANNER_PRESETS || !window.BANNER_PRESETS[${safePreset}]) {
        return { ok: false, code: 'INVALID', message: 'unknown banner preset: ' + ${safePreset} };
      }
      const sid = ${safeSid};
      if (sid) {
        const sec = document.getElementById(sid);
        if (!sec) return { ok:false, code:'NOT_FOUND', message:'section not found: ' + sid };
        if (typeof window.selectSection === 'function') window.selectSection(sec);
      }
      const beforeIds = new Set([...document.querySelectorAll('.frame-block')].map(b => b.id));
      window.addBannerBlock(${safePreset});
      const blocks = [...document.querySelectorAll('.frame-block')];
      const newBlock = blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) return { ok: false, code: 'NO_ADD', message: 'banner(frame-block)이 추가되지 않았습니다.' };
      return { ok: true, blockId: newBlock.id, preset: ${safePreset}, pageId: window.activePageId || null };
    } catch(e) { return { ok:false, code:'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addBannerBlock call failed: ' + e.message);
  }
}

// setRendererInvoker bridge에 추가 (main.js ~line 1247 인근 addBanner02Block 라인 뒤):
//   addCanvasBlock: _invokeRendererAddCanvasBlock,
//   updateCanvasBlock: _invokeRendererUpdateCanvasBlock,

// ─── primary_chat.json ─── auto-appended (17-block batch) ─────────────────────
// (registration leaked into source removed — keys already added to setMcpRendererInvoker above)
// ─── _invokeRendererAddChatBlock — main.js에 신규 추가 (banner02 동일 패턴) ──
async function _invokeRendererAddChatBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  const dataOpts = { ...opts };
  delete dataOpts.sectionId;
  const safeData = JSON.stringify(dataOpts);
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addChatBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addChatBlock not found' };
      }
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.chat-block')].map(b => b.id));
      window.addChatBlock(${safeData});
      const blocks = [...document.querySelectorAll('.chat-block')];
      const newBlock = blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'chat-block이 추가되지 않았습니다.' };
      }
      return {
        ok: true,
        blockId: newBlock.id,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addChatBlock call failed: ' + e.message);
  }
}

// ─── _invokeRendererUpdateChatBlock — main.js에 신규 추가 ──────────────────
async function _invokeRendererUpdateChatBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateChatBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateChatBlock not found' };
      }
      return window.updateChatBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateChatBlock call failed: ' + e.message);
  }
}

// ─── primary_gradient.json ─── auto-appended (17-block batch) ─────────────────────
// ─── add_gradient_block — gradient 오버레이 추가 ────────────────────────────
// banner02 패턴 미러: 단일 atomic IIFE (동시수정 가드 + window.addGradientBlock).
async function _invokeRendererAddGradientBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  const dataOpts = { ...opts };
  delete dataOpts.sectionId;
  const safeData = JSON.stringify(dataOpts);
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addGradientBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addGradientBlock not found' };
      }
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.gradient-block')].map(b => b.id));
      const result = window.addGradientBlock(${safeData});
      const blocks = [...document.querySelectorAll('.gradient-block')];
      const newBlock = (result && result.id ? result : null) || blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'gradient-block이 추가되지 않았습니다.' };
      }
      return {
        ok: true,
        blockId: newBlock.id,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addGradientBlock call failed: ' + e.message);
  }
}

// ─── update_gradient_block — gradient 블록 부분 수정 ────────────────────────
async function _invokeRendererUpdateGradientBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateGradientBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateGradientBlock not found' };
      }
      return window.updateGradientBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateGradientBlock call failed: ' + e.message);
  }
}

// setRendererInvoker 호출 객체에 다음 두 키 추가 (main.js의 _rendererInvoker 객체 라인 ~1247 근처):
//   addGradientBlock:    _invokeRendererAddGradientBlock,
//   updateGradientBlock: _invokeRendererUpdateGradientBlock,

// ─── primary_iconify.json ─── auto-appended (17-block batch) ─────────────────────
// ─── update_iconify_block — 기존 iconify(icon-block) 부분 수정 ────────────────
// banner02 update 패턴 미러: USER_BUSY 가드 + window.updateIconifyBlock 호출.
// main 측 handler가 iconName 변경 시 새 SVG를 fetch해서 partial.svg로 함께 넣어줌.
async function _invokeRendererUpdateIconifyBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateIconifyBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateIconifyBlock not found' };
      }
      return window.updateIconifyBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateIconifyBlock call failed: ' + e.message);
  }
}

// main.js의 setMcpRendererInvoker({...}) 호출에 추가:
//   updateIconifyBlock: _invokeRendererUpdateIconifyBlock,
// (기존 addIconifyBlock 라인 바로 다음에 추가 — 라인 1249 근처)

// ─── primary_sticker.json ─── auto-appended (17-block batch) ─────────────────────
// main.js의 _rendererInvoker 등록 객체에 추가 (line ~1248 banner02 옆에):
//   addStickerBlock: _invokeRendererAddStickerBlock,
//   updateStickerBlock: _invokeRendererUpdateStickerBlock,
//
// 그리고 main.js 하단 _invokeRendererUpdateBanner02Block 함수 다음에 아래 두 함수 추가:

// ─── add_sticker_block — sticker 블록 추가 (polymorphic 5 shapes) ───────────
// banner02 패턴 미러: 단일 atomic IIFE (동시수정 가드 + window.addStickerBlock + beforeIds diff로 blockId 추출).
async function _invokeRendererAddStickerBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  const dataOpts = { ...opts };
  delete dataOpts.sectionId;
  const safeData = JSON.stringify(dataOpts);
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addStickerBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addStickerBlock not found' };
      }
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.sticker-block')].map(b => b.id));
      window.addStickerBlock(${safeData});
      const blocks = [...document.querySelectorAll('.sticker-block')];
      const newBlock = blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'sticker-block이 추가되지 않았습니다.' };
      }
      return {
        ok: true,
        blockId: newBlock.id,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addStickerBlock call failed: ' + e.message);
  }
}

// ─── update_sticker_block — 기존 sticker 블록 부분 수정 ───────────────────────
async function _invokeRendererUpdateStickerBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateStickerBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateStickerBlock not found' };
      }
      return window.updateStickerBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateStickerBlock call failed: ' + e.message);
  }
}

// ─── primary_vector.json ─── auto-appended (17-block batch) ─────────────────────
// main.js의 _rendererInvoker setMcpRendererInvoker({...}) 객체에 다음 두 줄 추가:
//   addVectorBlock: _invokeRendererAddVectorBlock,
//   updateVectorBlock: _invokeRendererUpdateVectorBlock,
//
// 그리고 banner02 _invokeRendererAdd/UpdateBanner02Block 함수 바로 아래에 다음 두 함수 추가:

// ─── add_vector_block — vector 블록 추가 (svg 문자열 + opts) ────────────────
// vector-block.js의 addVectorBlock(svgString, opts) 시그니처를 위한 wrapper.
// mcp-server에서 _validateVectorOpts로 검증된 opts를 받아 svg를 첫 인자로 분리해 호출.
async function _invokeRendererAddVectorBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  const dataOpts = { ...opts };
  delete dataOpts.sectionId;
  // vector-block.addVectorBlock(svgString, opts) — svg를 첫 인자로 분리
  const svgStr = typeof dataOpts.svg === 'string' ? dataOpts.svg : '';
  delete dataOpts.svg;
  const safeSvg = JSON.stringify(svgStr);
  const safeOpts = JSON.stringify(dataOpts);
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addVectorBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addVectorBlock not found' };
      }
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.vector-block')].map(b => b.id));
      const result = window.addVectorBlock(${safeSvg}, ${safeOpts});
      const blocks = [...document.querySelectorAll('.vector-block')];
      const newBlock = (result && result.block) || blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'vector-block이 추가되지 않았습니다.' };
      }
      return {
        ok: true,
        blockId: newBlock.id,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addVectorBlock call failed: ' + e.message);
  }
}

// ─── update_vector_block — 기존 vector 블록 부분 수정 ──────────────────────
async function _invokeRendererUpdateVectorBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateVectorBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateVectorBlock not found' };
      }
      return window.updateVectorBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateVectorBlock call failed: ' + e.message);
  }
}

// ─── secondary_divider.json ─── auto-appended (17-block batch) ─────────────────────
// ─── add_divider_block — divider 블록 추가 (구분선) ─────────────────────────
// add_banner02_block 패턴 미러. 단일 atomic IIFE (동시수정 가드 + window.addDividerBlock).
// 현 addDividerBlock은 color/lineStyle/weight만 사용 → 추가 필드(padV/padH/lineDir/lineLength)는
// 생성 직후 dataset 보강 + applyDividerStyle 재호출로 반영.
async function _invokeRendererAddDividerBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  // opts에서 sectionId 분리 — block-factory의 addDividerBlock(color/lineStyle/weight)만
  // 1차로 받고, padV/padH/lineDir/lineLength는 dataset 보강으로 처리.
  const addOpts = {};
  if (opts.lineColor  !== undefined) addOpts.color     = opts.lineColor;
  if (opts.lineStyle  !== undefined) addOpts.lineStyle = opts.lineStyle;
  if (opts.lineWeight !== undefined) addOpts.weight    = opts.lineWeight;
  const safeAdd = JSON.stringify(addOpts);
  const extra = {};
  if (opts.padV       !== undefined) extra.padV       = opts.padV;
  if (opts.padH       !== undefined) extra.padH       = opts.padH;
  if (opts.lineDir    !== undefined) extra.lineDir    = opts.lineDir;
  if (opts.lineLength !== undefined) extra.lineLength = opts.lineLength;
  const safeExtra = JSON.stringify(extra);
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addDividerBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addDividerBlock not found' };
      }
      // 지정 섹션 타게팅
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.divider-block')].map(b => b.id));
      window.addDividerBlock(${safeAdd});
      const blocks = [...document.querySelectorAll('.divider-block')];
      const newBlock = blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'divider-block이 추가되지 않았습니다.' };
      }
      // 추가 dataset 보강 (padV/padH/lineDir/lineLength) + 스타일 재적용
      const extra = ${safeExtra};
      let touched = false;
      if (extra.padV       !== undefined) { newBlock.dataset.padV       = String(extra.padV);       touched = true; }
      if (extra.padH       !== undefined) { newBlock.dataset.padH       = String(extra.padH);       touched = true; }
      if (extra.lineDir    !== undefined) { newBlock.dataset.lineDir    = String(extra.lineDir);    touched = true; }
      if (extra.lineLength !== undefined) { newBlock.dataset.lineLength = String(extra.lineLength); touched = true; }
      if (touched && typeof window.applyDividerStyle === 'function') {
        try { window.applyDividerStyle(newBlock); } catch (_) {}
      }
      return {
        ok: true,
        blockId: newBlock.id,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addDividerBlock call failed: ' + e.message);
  }
}

// ─── update_divider_block — 기존 divider 블록 부분 수정 ─────────────────────
// updateBanner02Block 패턴 미러. partial은 mcp-server에서 검증 후 들어옴.
async function _invokeRendererUpdateDividerBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateDividerBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateDividerBlock not found' };
      }
      return window.updateDividerBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateDividerBlock call failed: ' + e.message);
  }
}

// ─── secondary_asset-block.json ─── auto-appended (17-block batch) ─────────────────────
// ─── update_asset_block — 기존 asset-block 부분 수정 ────────────────────────
// 크기/정렬/패딩/이미지/배경/오버레이/preset partial update. updateBanner02Block 패턴 미러.
async function _invokeRendererUpdateAssetBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateAssetBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateAssetBlock not found' };
      }
      return window.updateAssetBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateAssetBlock call failed: ' + e.message);
  }
}

// ─── secondary_table.json ─── auto-appended (17-block batch) ─────────────────────
// ─── update_table_block — 기존 table 블록 부분 수정 ──────────────────────────
// banner02 update 패턴 미러. 동시수정 가드 + window.updateTableBlock atomic 호출.
async function _invokeRendererUpdateTableBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  // partial은 mcp-server에서 검증 후 들어옴. JSON.stringify로 escape.
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateTableBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateTableBlock not found' };
      }
      return window.updateTableBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateTableBlock call failed: ' + e.message);
  }
}

// ─── secondary_icon-circle.json ─── auto-appended (17-block batch) ─────────────────────
// ─── update_icon_circle_block — 기존 icon-circle 블록 부분 수정 ──────────────
// size/bgColor/border/padX/radius/imgSrc/layerName partial update. updateBanner02Block 패턴 미러.
async function _invokeRendererUpdateIconCircleBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  // partial은 mcp-server에서 검증 후 들어옴. JSON.stringify로 escape.
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateIconCircleBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateIconCircleBlock not found' };
      }
      return window.updateIconCircleBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateIconCircleBlock call failed: ' + e.message);
  }
}

// ─── add_icon_circle_block — icon-circle 블록 추가 (bridge 누락 보완, addFrameBlock 패턴 미러) ───
async function _invokeRendererAddIconCircleBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  const safeOpts = JSON.stringify(opts || {});
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addIconCircleBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addIconCircleBlock not found' };
      }
      const beforeIds = new Set([...document.querySelectorAll('.icon-circle-block')].map(b => b.id));
      window.addIconCircleBlock(${safeOpts});
      const blocks = [...document.querySelectorAll('.icon-circle-block')];
      const newBlock = blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) return { ok: false, code: 'NO_ADD', message: 'icon-circle-block이 추가되지 않았습니다.' };
      if (typeof window.triggerAutoSave === 'function') window.triggerAutoSave();
      return { ok: true, blockId: newBlock.id, pageId: window.activePageId || null };
    } catch(e) { return { ok:false, code:'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addIconCircleBlock call failed: ' + e.message);
  }
}

// ─── secondary_graph.json ─── auto-appended (17-block batch) ─────────────────────
// ─── add_graph_block — graph 블록 추가 (data 옵션 풀세트) ───────────────────
// banner02 _invokeRendererAddBanner02Block 패턴 미러: USER_BUSY 가드 + before/after id diff로 신규 blockId 추출.
async function _invokeRendererAddGraphBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  // opts에서 sectionId 분리해서 dataOpts만 addGraphBlock에 전달 (sectionId는 selectSection용)
  const dataOpts = { ...opts };
  delete dataOpts.sectionId;
  const safeData = JSON.stringify(dataOpts);
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addGraphBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addGraphBlock not found' };
      }
      // 지정 섹션 타게팅 (add_banner02_block 패턴)
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.graph-block')].map(b => b.id));
      // addGraphBlock은 row/block을 반환하지 않을 수도 있으니 diff로 신규 탐지 (block-factory 현행)
      const result = window.addGraphBlock(${safeData});
      const blocks = [...document.querySelectorAll('.graph-block')];
      const newBlock = (result && result.block) || blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'graph-block이 추가되지 않았습니다.' };
      }
      return {
        ok: true,
        blockId: newBlock.id,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addGraphBlock call failed: ' + e.message);
  }
}

// ─── update_graph_block — 기존 graph 블록 부분 수정 ─────────────────────────
// chartType/preset/items/스타일 partial update. updateBanner02Block 패턴 미러.
async function _invokeRendererUpdateGraphBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  // partial은 mcp-server에서 검증 후 들어옴. JSON.stringify로 escape.
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateGraphBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateGraphBlock not found' };
      }
      return window.updateGraphBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateGraphBlock call failed: ' + e.message);
  }
}

// ─── secondary_gap.json ─── auto-appended (17-block batch) ─────────────────────
async function _invokeRendererUpdateGapBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  // partial은 mcp-server에서 검증 후 들어옴. JSON.stringify로 escape.
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateGapBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateGapBlock not found' };
      }
      return window.updateGapBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateGapBlock call failed: ' + e.message);
  }
}

// ─── secondary_speech-bubble.json ─── auto-appended (17-block batch) ─────────────────────
// ─── add_speech_bubble_block — speech-bubble 블록 추가 (data 옵션 풀세트) ──
// banner02 패턴 미러: 단일 atomic IIFE (동시수정 가드 + window.addSpeechBubbleBlock(tail) + 나머지 필드는 update 경로).
// blockId는 _makeTextFrame 래퍼 내부 .speech-bubble-block의 id(sb_xxx).
async function _invokeRendererAddSpeechBubbleBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  // sectionId 분리. addSpeechBubbleBlock(tail)은 1-arg, 나머지는 update 경로로 적용.
  const tail = opts.tail || 'left';
  const safeTail = JSON.stringify(tail);
  const restOpts = { ...opts };
  delete restOpts.sectionId;
  delete restOpts.tail;
  const safeRest = JSON.stringify(restOpts);
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addSpeechBubbleBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addSpeechBubbleBlock not found' };
      }
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.speech-bubble-block')].map(b => b.id));
      window.addSpeechBubbleBlock(${safeTail});
      const blocks = [...document.querySelectorAll('.speech-bubble-block')];
      const newBlock = blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'speech-bubble-block이 추가되지 않았습니다.' };
      }
      // 나머지 필드(bubbleStyle/showSender/senderName/bubbleBg/text) update 경로로 적용
      const rest = ${safeRest};
      const restKeys = Object.keys(rest);
      let updateResult = null;
      if (restKeys.length > 0 && typeof window.updateSpeechBubbleBlock === 'function') {
        updateResult = window.updateSpeechBubbleBlock(newBlock.id, rest);
        if (updateResult && updateResult.ok === false) {
          return { ok: false, code: 'UPDATE_AFTER_ADD_FAILED', message: 'add 성공했으나 후속 update 실패', detail: updateResult, blockId: newBlock.id };
        }
      }
      return {
        ok: true,
        blockId: newBlock.id,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
        applied: updateResult ? updateResult.applied : null,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addSpeechBubbleBlock call failed: ' + e.message);
  }
}

// ─── update_speech_bubble_block — 기존 speech-bubble 블록 부분 수정 ─────────
async function _invokeRendererUpdateSpeechBubbleBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateSpeechBubbleBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateSpeechBubbleBlock not found' };
      }
      return window.updateSpeechBubbleBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateSpeechBubbleBlock call failed: ' + e.message);
  }
}

// setMcpRendererInvoker({ ... }) 호출 객체에 다음 두 키 추가:
//   addSpeechBubbleBlock:    _invokeRendererAddSpeechBubbleBlock,
//   updateSpeechBubbleBlock: _invokeRendererUpdateSpeechBubbleBlock,

// ─── secondary_label-group.json ─── auto-appended (17-block batch) ─────────────────────
// ─── add_label_group_block — label-group 블록 추가 (data 옵션 풀세트) ─────────
// banner02 패턴 미러: 단일 atomic IIFE (동시수정 가드 + window.addLabelGroupBlock).
async function _invokeRendererAddLabelGroupBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  const dataOpts = { ...opts };
  delete dataOpts.sectionId;
  const safeData = JSON.stringify(dataOpts);
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addLabelGroupBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addLabelGroupBlock not found' };
      }
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.label-group-block')].map(b => b.id));
      window.addLabelGroupBlock(${safeData});
      const blocks = [...document.querySelectorAll('.label-group-block')];
      const newBlock = blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'label-group-block이 추가되지 않았습니다.' };
      }
      return {
        ok: true,
        blockId: newBlock.id,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addLabelGroupBlock call failed: ' + e.message);
  }
}

// ─── update_label_group_block — 기존 label-group 블록 부분 수정 ──────────────
async function _invokeRendererUpdateLabelGroupBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateLabelGroupBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateLabelGroupBlock not found' };
      }
      return window.updateLabelGroupBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateLabelGroupBlock call failed: ' + e.message);
  }
}

// setRendererInvoker 객체에 추가:
//   addLabelGroupBlock: _invokeRendererAddLabelGroupBlock,
//   updateLabelGroupBlock: _invokeRendererUpdateLabelGroupBlock,

// ─── secondary_shape.json ─── auto-appended (17-block batch) ─────────────────────
// ─── add_shape_block — shape 블록 추가 (도형 종류만 받아서 100×100 frame 생성) ───
// add_banner02_block과 동일 패턴: 단일 atomic IIFE (동시수정 가드 + window.addShapeBlock).
async function _invokeRendererAddShapeBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  const safeShapeType = JSON.stringify(String(opts.shapeType || 'rectangle'));
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addShapeBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addShapeBlock not found' };
      }
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.shape-block')].map(b => b.id));
      window.addShapeBlock(${safeShapeType});
      const blocks = [...document.querySelectorAll('.shape-block')];
      const newBlock = blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'shape-block이 추가되지 않았습니다.' };
      }
      return {
        ok: true,
        blockId: newBlock.id,
        shapeType: newBlock.dataset.shapeType || null,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addShapeBlock call failed: ' + e.message);
  }
}

// ─── update_shape_block — 기존 shape 블록 부분 수정 ─────────────────────────
async function _invokeRendererUpdateShapeBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateShapeBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateShapeBlock not found' };
      }
      return window.updateShapeBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateShapeBlock call failed: ' + e.message);
  }
}

// 그리고 setRendererInvoker({...}) 호출부 객체에 다음 두 줄 추가:
//   addShapeBlock:    _invokeRendererAddShapeBlock,
//   updateShapeBlock: _invokeRendererUpdateShapeBlock,

// ─── secondary_icon-text.json ─── auto-appended (17-block batch) ─────────────────────
// ─── add_icon_text_block — icon-text 블록 추가 (sectionId + text + imgSrc) ──
// add_banner02_block 패턴 미러: 단일 atomic IIFE (동시수정 가드 + window.addIconTextBlock).
async function _invokeRendererAddIconTextBlock(opts = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSectionId = opts.sectionId ? JSON.stringify(String(opts.sectionId)) : 'null';
  // text/imgSrc는 post-add update 단계에서 적용 (addIconTextBlock 기존 시그니처가 opts 미수용).
  const dataOpts = { text: opts.text, imgSrc: opts.imgSrc };
  const safeData = JSON.stringify(dataOpts);
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.addIconTextBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.addIconTextBlock not found' };
      }
      // 지정 섹션 타게팅
      const sid = ${safeSectionId};
      if (sid) {
        const target = document.getElementById(sid) || document.querySelector('[data-section-id="' + sid + '"]');
        if (!target) return { ok: false, code: 'NOT_FOUND', message: 'section not found: ' + sid };
        if (typeof window.selectSection === 'function') { try { window.selectSection(target); } catch(_){} }
      }
      if (typeof window.getSelectedSection === 'function' && !window.getSelectedSection()
          && typeof window.selectSection === 'function') {
        const firstSec = document.querySelector('[id^="sec_"]');
        if (firstSec) { try { window.selectSection(firstSec); } catch (_) {} }
      }
      const beforeIds = new Set([...document.querySelectorAll('.icon-text-block')].map(b => b.id));
      window.addIconTextBlock();
      const blocks = [...document.querySelectorAll('.icon-text-block')];
      const newBlock = blocks.find(b => !beforeIds.has(b.id));
      if (!newBlock) {
        return { ok: false, code: 'NO_ADD', message: 'icon-text-block이 추가되지 않았습니다.' };
      }
      // text/imgSrc는 post-add update로 적용 (기존 addIconTextBlock이 opts 미수용)
      const data = ${safeData};
      if (typeof window.updateIconTextBlock === 'function'
          && (data.text !== undefined || data.imgSrc !== undefined)) {
        const partial = {};
        if (data.text   !== undefined && data.text   !== null) partial.text   = data.text;
        if (data.imgSrc !== undefined && data.imgSrc !== null) partial.imgSrc = data.imgSrc;
        try { window.updateIconTextBlock(newBlock.id, partial); } catch (_) {}
      }
      return {
        ok: true,
        blockId: newBlock.id,
        pageId: window.activePageId || null,
        beforeCount: beforeIds.size,
        afterCount: blocks.length,
      };
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('addIconTextBlock call failed: ' + e.message);
  }
}

// ─── update_icon_text_block — 기존 icon-text 블록 부분 수정 ─────────────────
// updateBanner02Block 패턴 미러. text/imgSrc partial update.
async function _invokeRendererUpdateIconTextBlock({ blockId, partial } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeBlockId = JSON.stringify(String(blockId || ''));
  const safePartial = JSON.stringify(partial || {});
  const atomicJs = `(() => {
    try {
      // ── 동시수정 가드 (atomic) ──
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000, detail: { userEditing, recentKey } };
      }
      if (typeof window.updateIconTextBlock !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window.updateIconTextBlock not found' };
      }
      return window.updateIconTextBlock(${safeBlockId}, ${safePartial});
    } catch (e) { return { ok: false, code: 'CALL_ERROR', message: e.message }; }
  })()`;
  try {
    return await mainWindow.webContents.executeJavaScript(atomicJs, true);
  } catch (e) {
    throw new Error('updateIconTextBlock call failed: ' + e.message);
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
