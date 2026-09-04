const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net: electronNet } = require('electron');

// ── 캔버스 이미지 외부화: 커스텀 프로토콜 goya-asset://<projectId>/<filename> ──
// 캔버스 HTML에 박히던 인라인 base64를 proj_<id>/assets/<contenthash>.<ext>로 분리하고,
// 이 프로토콜 URL로 참조한다. registerSchemesAsPrivileged는 app ready 이전 top-level 필수.
// standard+secure: file:// origin에서 fetch/CORS 허용(html2canvas export 호환). stream: 대용량.
protocol.registerSchemesAsPrivileged([{
  scheme: 'goya-asset',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true },
}]);
// goya-asset:// 응답 Content-Type 매핑 (확장자 → MIME)
const _GOYA_ASSET_MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp', ico: 'image/x-icon',
};
const { autoUpdater } = require('electron-updater');
const updaterCache = require('./main/updater-cache');
const path = require('path');

// C4: 앱 이름 브랜딩 (macOS 상단 메뉴바 표시)
app.name = 'GODITOR';
const fs = require('fs');
const os = require('os');

// userData 폴더 마이그레이션: 구 이름('Goya Design Editor') → 'GODITOR'.
// app.name이 userData 경로를 결정하므로, 앱이 새 경로에 처음 쓰기 전(top-level)에 rename.
// 같은 볼륨 rename이라 원자적·즉시(6GB+ copy 아님). old만 있고 new 없을 때 1회만.
(function _migrateUserDataDir() {
  try {
    const appDataDir = app.getPath('appData'); // ~/Library/Application Support
    const oldUD = path.join(appDataDir, 'Goya Design Editor');
    const newUD = path.join(appDataDir, 'GODITOR');
    if (fs.existsSync(oldUD) && !fs.existsSync(newUD)) {
      fs.renameSync(oldUD, newUD);
      console.log('[migrate] userData: "Goya Design Editor" -> "GODITOR"');
    }
  } catch (e) {
    console.error('[migrate] userData rename failed:', e.message);
  }
})();

// .gdt 파일 연결 — ★app ready «이전»에 걸어야 한다.
// 맥은 파인더에서 더블클릭한 경로를 `open-file` 이벤트로 주는데, 콜드 스타트에선
// 그 이벤트가 whenReady보다 «먼저» 뜬다. ready 안에서 등록하면 첫 더블클릭을 놓친다.
// ★★그리고 «위 마이그레이션 뒤»여야 한다 (2026-09-02 실측).
//   이 안에서 requestSingleInstanceLock() 을 부르는데, 그게 userData 에 SingletonLock/
//   SingletonCookie/SingletonSocket 을 «만든다»(실측: 새 userData 폴더에 3개가 생겼다).
//   마이그레이션보다 «먼저» 돌면 'GODITOR' 폴더가 그 파일들 때문에 이미 존재해서
//   `!fs.existsSync(newUD)` 가 거짓이 되고 → 이사가 조용히 안 일어난다 →
//   옛 이름 폴더에 있던 사용자의 프로젝트가 통째로 «없는 것»이 된다.
//   ⛔이 두 줄을 위로 다시 올리지 마라. 올리면 그 순간 그 사고가 돌아온다.
try { require('./main/gdt/wire').registerGdtFileAssociations(); }
catch (e) { console.error('[gdt] 파일 연결 등록 실패:', e); }

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
const { login: authLogin, verifySession: authVerifySession, urlIsLive: authUrlIsLive, SIGNUP_URL, PRICING_URL, FIND_EMAIL_URL, FIND_PASSWORD_URL, API_BASE: AUTH_API_BASE } = require('./services/authService');
const { fillSectionTexts: geminiFill } = require('./services/geminiService');
const { fillSectionTexts: openaiFill } = require('./services/openaiService');
const { fillSectionTexts: anthropicFill } = require('./services/anthropicService');
const { generateImage: aiGenerateImage } = require('./services/imageGenService');
const { registerClaudePMIPC, setActualMcpPort, syncClaudePmTitle, handleEnsureClaudePMFolder } = require('./main/claude-pm/ipc');
const { registerTerminalIPC, killAllSessions: killAllTerminalSessions } = require('./main/claude-pm/terminal');
const { startMcpServer, stopMcpServer, setRendererInvoker: setMcpRendererInvoker, setIconifyApi: setMcpIconifyApi, setProjectOps: setMcpProjectOps, getToken: getMcpToken, regenerateToken: regenerateMcpToken } = require('./main/claude-pm/mcp-server');
// Unit B — MCP 접속 토큰(메모리 보관, 화면표시/IPC용). 파일/레포 저장 금지.
let currentMcpToken = null;

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
  // pre-release(beta) 채널: 테스터 앱만 true → GitHub pre-release 자동수신·검증.
  // 일반 사용자는 false(기본) → latest 정식 릴리스만 받음.
  betaChannel: false,
  // [externalize] 프로젝트를 «열 때» 레거시 base64 이미지를 goya-asset 에셋으로 일괄 외부화(기본 OFF).
  // 기본값 ON 전환은 리허설 통과 후 현빈 G2 게이트(DESIGN-asset-batch-externalize.md §3-3).
  autoExternalizeOnOpen: false,
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
    // UTF-8 BOM 제거: 외부 편집기(메모장·PS Set-Content 등)가 BOM을 붙이면
    // JSON.parse가 throw → 설정 전체가 DEFAULT로 무시되는 사고 방지.
    const raw = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
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
  // 패키징(asar) 환경에선 fs.watch가 throw → whenReady 체인이 끊겨
  // setupAutoUpdater/MCP까지 죽는 사고(v0.5.0~0.6.0). 핫리로드는 dev 전용.
  if (app.isPackaged) return;
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
  const windowTitle = gitBranch ? `GODITOR [${gitBranch}]` : 'GODITOR';
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: windowTitle,
    icon: path.join(__dirname, 'build/icon.png'),
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' }
      // ★윈도우/리눅스: 기본 메뉴바(파일·편집·보기·창)가 «창 안»에 붙는다.
      //   맥은 시스템 메뉴바로 가서 안 보이지만 윈도우는 앱 UI 위에 겹쳐 보인다.
      //   ⚠️제거(setApplicationMenu(null))가 아니라 «숨김»을 쓴다 — 제거하면 입력창의
      //     복사·붙여넣기 가속기까지 같이 사라질 수 있다. autoHideMenuBar 는 Alt 로 다시 뜬다.
      : { titleBarStyle: 'default', autoHideMenuBar: true }),
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

  // 로그인 상태 체크 후 페이지 결정
  checkAuthAndLoad();

  ipcMain.handle('get-version', () => app.getVersion());
  ipcMain.handle('app:git-branch', () => getGitBranch());
  ipcMain.handle('app:is-admin', () => isAdminAuthorized());
  ipcMain.handle('app:debug-port', () => {
    const a = process.argv.find(a => a.startsWith('--remote-debugging-port='));
    return a ? a.split('=')[1] : null;
  });
  // Unit B-2 — MCP 접속 토큰 노출/재발급. ★admin 게이팅 해제:
  //   MCP를 일반 사용자에게 개방하려면 사용자가 자기 토큰을 꺼낼 수 있어야 한다
  //   (환경설정 → 개발자 탭). 토큰은 메모리 + userData 0600 파일에만 있다.
  ipcMain.handle('app:mcp-token', () => (getMcpToken ? getMcpToken() : currentMcpToken));
  ipcMain.handle('mcp:regenerate-token', () => (currentMcpToken = regenerateMcpToken()));

  // AI 섹션 텍스트 채우기 (Gemini)
  ipcMain.handle('ai:fillSectionTexts', (_e, payload) => aiFillSectionTexts(payload));

  // 사용자별 Preferences (settings.json: API 키 + 단축키)
  ipcMain.handle('settings:get',      () => readSettings());
  ipcMain.handle('settings:set',      (_e, patch) => writeSettings(patch || {}));
  ipcMain.handle('settings:test-key', (_e, provider, key) => testApiKey(provider, key));

  // Claude PM (feature/claude-pm Phase 2) — pickDirectory / createFolder / openInFinder / spawnClaudeTerminal / pingMcp
  // GAP-010: 강력 권한 IPC(터미널/spawn/folder)는 isAdminAuthorized 게이팅(배포 렌더러발 RCE 차단).
  registerClaudePMIPC(ipcMain, () => isAdminAuthorized());

  // Claude PM (Phase 3 F8) — 내부 터미널 패널 PTY 백엔드
  registerTerminalIPC(ipcMain, () => isAdminAuthorized());

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

  // GAP-008: 라이선스 검증 강제 — 렌더러발(發) 직접 네비게이션 우회 차단.
  // license 화면에서 location.href='projects.html'/'../index.html' 등으로 라이선스 게이트를
  // 건너뛰는 경로를 막는다. 인증된 진입(_editorAccessGranted)·admin일 때만 에디터 페이지 허용.
  // (main의 loadFile은 will-navigate를 발화하지 않으므로 정상 부팅/등록 흐름엔 영향 없음.)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (/\/(projects|index|planning)\.html(\?|#|$)/.test(url)) {
      if (!_editorAccessGranted && !isAdminAuthorized()) {
        event.preventDefault();
        console.warn('[license] 미인증 에디터 네비게이션 차단:', url);
      }
    }
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

/* ── 계정 로그인 상태 저장 (userData/auth.json) ──
   로그인 성공 시 {email, plan, accessUntil, sessionToken}만 저장한다.
   ⚠️ 비밀번호는 절대 저장하지 않는다.
   accessUntil까지는 서버에 묻지 않고 통과시킨다 → 백엔드가 죽어도, 오프라인이어도
   인증했던 사용자가 잠기지 않는다(2026-08-05 백엔드 다운 사고 재발 방지).
   settings.json과 분리한 이유: 설정은 사용자가 편집·동기화하는 파일이고,
   인증 상태는 로그아웃 시 통째로 지워야 하는 별개 수명의 데이터라서. */
let _AUTH_PATH_CACHE = null;
function getAuthPath() {
  if (_AUTH_PATH_CACHE) return _AUTH_PATH_CACHE;
  _AUTH_PATH_CACHE = path.join(app.getPath('userData'), 'auth.json');
  return _AUTH_PATH_CACHE;
}
function readAuth() {
  try {
    const p = getAuthPath();
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
    if (!raw || typeof raw !== 'object' || !raw.email || !raw.accessUntil) return null;
    return raw;
  } catch (_) {
    return null;
  }
}
function writeAuth(record) {
  const next = {
    email:        String(record.email || ''),
    plan:         String(record.plan || ''),
    accessUntil:  String(record.accessUntil || ''),
    sessionToken: String(record.sessionToken || ''),
    savedAt:      new Date().toISOString(),
  };
  try {
    fs.writeFileSync(getAuthPath(), JSON.stringify(next, null, 2), 'utf8');
  } catch (e) {
    console.warn('[auth] 상태 저장 실패:', e.message);
  }
  return next;
}
function clearAuth() {
  try { fs.unlinkSync(getAuthPath()); } catch (_) {}
}
/** accessUntil이 아직 안 지났는가. 파싱 불가면 false(=만료 취급). */
function authAccessValid(a) {
  const t = Date.parse(a?.accessUntil);
  return Number.isFinite(t) && t > Date.now();
}

/* ── admin 모드 인증 (GAP-008 심층: 라이선스/결제 우회 차단) ──
   admin 모드 = 라이선스 검증 우회 + 라이선스 키 발급 권한. 이를 'admin' CLI 인자만으로
   부여하면 배포 앱을 가진 누구나(인자명은 binary strings로 노출) 라이선스/결제를 우회하고
   유료 키를 자가발급할 수 있다 → 매출 직결 보안구멍.
   → 패키징(배포) 빌드에선 'admin' 인자 + 운영자 토큰 인증을 모두 요구한다.
     · dev(미패키징, `electron .`): 인자만으로 허용 — 개발/검증 편의(lens 9335·지디 9334 포함).
     · 패키징: env GODITOR_ADMIN_TOKEN 의 sha256(hex) == userData/admin.allow 파일 내용일 때만 admin.
       admin.allow는 운영자가 관리자 머신에 로컬 배치(앱 번들·레포 미포함) → 일반 고객 빌드엔
       부재하므로 'admin' 인자가 무력화된다(safe-by-default). */
function isAdminAuthorized() {
  if (!process.argv.includes('admin')) return false;
  let packaged = true;
  try { packaged = app.isPackaged; } catch (_) { packaged = false; }
  if (!packaged) return true; // dev/검증 빌드
  try {
    const token = process.env.GODITOR_ADMIN_TOKEN;
    if (!token) return false;
    const allowPath = path.join(app.getPath('userData'), 'admin.allow');
    if (!fs.existsSync(allowPath)) return false;
    const expected = String(fs.readFileSync(allowPath, 'utf8')).trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(expected)) return false; // sha256 hex만 허용
    const crypto = require('crypto');
    const actual = crypto.createHash('sha256').update(token).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
  } catch (_) { return false; }
}

// GAP-008: 에디터(라이선스 게이트 너머) 진입 허가 플래그. 인증된 경로(부팅 라이선스 통과·
// 키 등록 성공·admin)에서만 true로 세팅. will-navigate 가드가 이 플래그로 렌더러발(發)
// 직접 네비게이션(location.href='projects.html' 등) 우회를 차단한다.
let _editorAccessGranted = false;
function _grantEditorAccess() { _editorAccessGranted = true; }

/* ── 로그인 상태 체크 + 초기 페이지 로드 ──
   구버전은 매 실행마다 공인 IP를 조회해 서버에 물었다 → 서버가 죽으면 인증했던
   사용자까지 잠겼다. 지금은 저장된 로그인 상태(accessUntil)만 보고 통과시키고,
   서버 확인은 뒤에서 비차단으로 돌린다. */
async function checkAuthAndLoad() {
  if (isAdminAuthorized()) {
    _grantEditorAccess();
    mainWindow.loadFile('pages/projects.html');
    return;
  }
  const auth = readAuth();
  if (auth && authAccessValid(auth)) {
    _grantEditorAccess();
    mainWindow.loadFile('pages/projects.html');
    silentRefresh(auth); // 네트워크 없으면 조용히 포기 — 부팅을 막지 않는다
    return;
  }
  // 저장된 계정이 있으면 license.html이 만료 화면으로, 없으면 로그인 화면으로 뜬다
  // (렌더러가 auth:state를 물어서 분기).
  mainWindow.loadFile('pages/license.html');
}

/** 온라인이면 접근권한을 조용히 갱신. 실패·판단불가는 전부 무시(캐시 유지). */
async function silentRefresh(auth) {
  try {
    const r = await authVerifySession(auth.email, auth.sessionToken);
    if (!r) return;                    // 오프라인 또는 엔드포인트 미구현 → 유예 유지
    if (r.ok && r.accessUntil) {
      writeAuth({ ...auth, plan: r.plan || auth.plan, accessUntil: r.accessUntil });
      return;
    }
    if (r.reason === 'expired' && r.accessUntil) {
      // 세션 중에는 쫓아내지 않는다. 다음 실행부터 만료 화면.
      writeAuth({ ...auth, plan: r.plan || auth.plan, accessUntil: r.accessUntil });
      return;
    }
    if (r.reason === 'invalid_session') clearAuth();
  } catch (_) {}
}

/* ── IPC: 계정 인증 ── */

// 로그인 화면/만료 화면 분기용 현재 상태. 비밀번호·세션토큰은 렌더러에 넘기지 않는다.
ipcMain.handle('auth:state', () => {
  const auth = readAuth();
  const valid = !!auth && authAccessValid(auth);
  return {
    signedIn:    valid,
    expired:     !!auth && !valid,
    email:       auth?.email || '',
    plan:        auth?.plan || '',
    accessUntil: auth?.accessUntil || '',
    purchaseUrl: PRICING_URL,
    signupUrl:   SIGNUP_URL,
    findEmailUrl:    FIND_EMAIL_URL,
    findPasswordUrl: FIND_PASSWORD_URL,
  };
});

ipcMain.handle('auth:login', async (_event, email, password) => {
  const r = await authLogin(String(email || '').trim(), String(password || ''));
  if (r.ok) {
    writeAuth({
      email: r.email, plan: r.plan, accessUntil: r.accessUntil, sessionToken: r.sessionToken,
    });
    // 세션토큰은 반환하지 않는다(렌더러 노출 최소화).
    return { ok: true, email: r.email, plan: r.plan, accessUntil: r.accessUntil };
  }
  if (r.reason === 'expired') {
    // 자격증명은 맞는데 이용기간이 끝난 계정 — 다음 실행에서도 만료 화면이 뜨도록 기록.
    // (sessionToken 없음)
    writeAuth({ email: String(email || '').trim(), plan: r.plan, accessUntil: r.accessUntil, sessionToken: '' });
  }
  return r;
});

// ★「새로고침」 — 등급이 «앱 밖에서» 바뀌기 때문에 필요하다.
//   입금 승인도, 베타 종료도 서버에서 일어난다. 앱을 다시 켜야만 반영되면 사용자는 안 켠다.
//   ⚠️ 오프라인이면 verifySession 이 null 을 준다 — 그때는 «기존 상태를 유지»한다(못 쓰게 만들지 않는다).
//   ★반대로 서버가 «죽었다고 대답»한 경우(invalid_session·email_not_verified)는 유예가 아니다.
//     그걸 오프라인과 같이 다루면 폐기된 세션이 영영 안 지워진다 — 다른 기기에서 로그인해
//     토큰이 갈린 사용자는 이 앱에서 옛 등급을 계속 보게 된다.
//   ★만료(expired)는 «대답은 왔지만 ok 는 아닌» 세 번째 갈래다. 토큰은 살아 있으므로 지우지
//     않고 값만 갱신하되, 화면엔 「갱신됨」이 아니라 만료라고 알려야 한다.
ipcMain.handle('auth:refresh', async () => {
  const auth = readAuth();
  if (!auth?.email || !auth?.sessionToken) return { ok: false, reason: 'not_signed_in' };
  const r = await authVerifySession(auth.email, auth.sessionToken);
  if (!r) return { ok: false, reason: 'offline' };          // 유예 유지 — auth.json 을 안 건드린다
  if (r.ok === false && (r.reason === 'invalid_session' || r.reason === 'email_not_verified')) {
    clearAuth();
    return { ok: false, reason: r.reason };
  }
  writeAuth({ ...auth, plan: r.plan || auth.plan, accessUntil: r.accessUntil || auth.accessUntil });
  if (r.ok === false) return { ok: false, reason: r.reason || 'unknown', plan: r.plan || '', accessUntil: r.accessUntil || '' };
  return { ok: true, plan: r.plan || '', accessUntil: r.accessUntil || '' };
});

ipcMain.handle('auth:logout', () => {
  clearAuth();
  return { ok: true };
});

// 가입/요금제/계정찾기 링크를 외부 브라우저로. ★임의 URL 오픈은 허용하지 않는다
// (렌더러 주입 스크립트가 shell.openExternal을 범용 실행 경로로 쓰는 것을 차단).
//
// ★열기 «전에» 그 주소가 살아 있는지 확인한다. 확인 없이 열면 사용자는 「이메일 찾기」를
//   눌러서 404를 본다 — 링크가 없는 것보다 나쁘다. 2026-08-07 오전엔 찾기 두 페이지가
//   실제로 404였고(배포 전), 같은 날 설정 사고로 홈페이지 정적 페이지가 통째로 404가 된
//   일도 있었다(authService.js FIND_* 주석 참고). 그래서 「배포될 때까지의 임시 조치」가
//   아니라 상시 안전장치다 — 페이지는 조용히 사라질 수 있다.
//
// ★비용을 어디에 두었는지가 중요하다:
//   - 조회는 «링크를 누른 순간»에만 한다. 부팅 경로(checkAuthAndLoad)는 건드리지 않았다.
//     앱 시작을 네트워크에 묶으면 오프라인 유예가 무너진다 — 우리가 파는 게 그거다.
//   - 판단 불가(오프라인·타임아웃 4초)는 «막지 않는다». 느리면 열리고, 죽었을 때만 막힌다.
//   - 상태를 저장하지 않는다. 그래서 페이지가 살아나면 다음 클릭부터 바로 풀린다.
//     (막는 쪽만 되고 푸는 쪽이 안 되면 영영 막힌다 — 그 구조를 피했다.)
ipcMain.handle('auth:open-external', async (_event, url) => {
  let u;
  try {
    u = new URL(String(url || ''));
  } catch (_) {
    return { ok: false, error: 'BAD_URL' };
  }
  if (u.protocol !== 'https:' || u.origin !== AUTH_API_BASE) {
    console.warn('[auth] 외부 링크 차단:', u.origin);
    return { ok: false, error: 'BLOCKED' };
  }
  let seenStatus = null;
  const live = await authUrlIsLive(u.toString(), (_url, status) => { seenStatus = status; });
  if (live === false) {
    console.warn(`[auth] 아직 배포되지 않은 페이지 — 열지 않음: ${u.pathname} (HTTP ${seenStatus})`);
    return { ok: false, error: 'NOT_READY', status: seenStatus };
  }
  shell.openExternal(u.toString());
  return { ok: true };
});

ipcMain.handle('license:navigate-projects', () => {
  // GAP-008: 인증 검증 강제 — 인증 없이 navigate로 에디터에 진입하던 우회 차단.
  // (기존: 무조건 projects.html 로드 → license 화면 콘솔에서 navigateToProjects() 한 줄로 우회)
  if (isAdminAuthorized()) { _grantEditorAccess(); mainWindow.loadFile('pages/projects.html'); return { ok: true }; }
  const auth = readAuth();
  if (auth && authAccessValid(auth)) {
    _grantEditorAccess();
    mainWindow.loadFile('pages/projects.html');
    return { ok: true };
  }
  return { ok: false, code: 'LICENSE_REQUIRED' };
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
// [externalize] 파일수준 일괄 외부화 모듈(DESIGN-asset-batch-externalize.md). 없어도 앱은 뜬다(best-effort).
function _getExternalizer() {
  try { return require('./main/project-store/externalizer'); }
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

// GAP-009: 경로 세그먼트(파일명·프로젝트 id) 살균 — 구분자(/ \)를 '_'로, 순수 점(. .. ...)을
// '_'로 치환해 path-traversal(상위 디렉터리 이탈) 차단. 정상 id(proj_<digits> 등 \w.- 조합)는 불변.
const _safeSeg = s => {
  const v = String(s || '').replace(/[^\w.-]/g, '_');
  return (v === '' || /^\.+$/.test(v)) ? '_' : v;
};

// proj.json 경로 dual-resolve: 신 우선 → flat fallback.
// migrator 모듈이 있으면 그쪽 사용, 없으면 동일 로직 인라인.
// snapshot-store 지연 로더 — _getExternalizer/_getMigrator 와 같은 패턴(모듈 부재 시 앱은 계속 뜬다).
let _ssMod = null, _ssTried = false;
function _SS() {
  if (!_ssTried) { _ssTried = true; try { _ssMod = require('./main/project-store/snapshot-store'); } catch (e) { console.warn('[snapshot-store] 로드 실패:', e.message); } }
  return _ssMod || _SS_FALLBACK;
}
// 모듈이 없으면 «스냅샷을 안 만들고 폴백 후보도 안 준다» — 저장·로드 자체는 계속 되게(현행과 동일한 안전 성향).
const _SS_FALLBACK = { writeSnapshot: () => ({ ok: false, skipped: 'module_missing' }), pruneVersions: () => ({ kept: 0, deleted: [] }), loadFallbackCandidates: () => [] };

function _resolveProjectJsonPath(id) {
  id = _safeSeg(id); // GAP-009
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
  id = _safeSeg(id); // GAP-009
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
  id = _safeSeg(id); // GAP-009
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
  id = _safeSeg(id); // GAP-009
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

/* ── [b8] 목록 메타 캐시 ──
   projects:list가 무거운 proj.json(인라인 base64로 최대 100MB+)을 통째 JSON.parse 하던 것을 방지.
   목록 렌더에 필요한 경량 필드(name·type·createdAt·updatedAt·marketRef)를 proj_meta.json에 캐시하고,
   meta가 proj.json보다 최신이면(mtime 비교) 풀파싱을 생략한다. (thumbnail은 기존대로 save-meta가 관리.) */
function _refreshListMeta(id, src) {
  // saveProject / 풀파싱 폴백 시 호출 — 목록 필드만 read-merge-write(다른 meta 필드 보존).
  try {
    const paths = _ensureNewLayoutPaths(id);
    let merged = {};
    try { if (fs.existsSync(paths.meta)) merged = JSON.parse(fs.readFileSync(paths.meta, 'utf8')) || {}; } catch (_) {}
    merged = {
      ...merged,
      name: src.name, type: src.type || null,
      createdAt: src.createdAt || null, updatedAt: src.updatedAt || null,
      marketRef: src.marketRef || null, listMetaV: 1,
    };
    _atomicWriteFileSync(paths.meta, JSON.stringify(merged, null, 2));
  } catch (_) { /* 메타 캐시 실패는 무해 — 다음 목록서 다시 풀파싱 */ }
}
// 한 프로젝트의 목록 아이템을 만든다. metaFast=true면 신 레이아웃 전용(메타 우선·풀파싱 회피),
// 캐시 미스/구버전이면 1회 풀파싱 후 메타를 갱신해 다음부터 빨라지게 한다.
function _listItemFor(id, projPath, metaFast) {
  const metaPath = _resolveMetaJsonPath(id);
  if (metaFast && metaPath) {
    try {
      const mStat = fs.statSync(metaPath);
      const pStat = fs.statSync(projPath);
      // meta가 proj.json 이상으로 최신 + 목록필드(name) 캐시됨 → 풀파싱 생략
      if (mStat.mtimeMs >= pStat.mtimeMs) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        // listMetaV 마커가 있어야 b8가 기록한 목록 캐시로 신뢰(구버전 meta엔 name이 없으니
        // 마커 없으면 풀파싱 폴백 → lazy 갱신). name도 함께 확인.
        if (meta && meta.listMetaV && meta.name != null) {
          return { id, name: meta.name, type: meta.type || null, createdAt: meta.createdAt || null,
                   updatedAt: meta.updatedAt || null, thumbnail: meta.thumbnail || null, marketRef: meta.marketRef || null,
                   collabRef: meta.collabRef || null,
                   // ★즐겨찾기는 collabRef 와 같은 «이 설치의 상태» — proj.json(문서)이 아니라 meta 에 산다
                   favorite: meta.favorite === true };
        }
      }
    } catch (_) { /* stat/parse 실패 → 풀파싱 폴백 */ }
  }
  // 폴백: proj.json 풀파싱(현행 동작) + (신 레이아웃이면) 목록 메타 캐시 갱신
  const data = JSON.parse(fs.readFileSync(projPath, 'utf8'));
  if (!data.id || data.id === 'undefined') return null;
  let thumbnail = data.thumbnail || null;
  // ★collabRef 는 proj.json 이 아니라 meta 에만 산다(원격 연결은 «문서»가 아니라 «이 설치»의 상태다).
  //   그래서 풀파싱 폴백 경로에서도 meta 를 읽어 와야 배지가 안 사라진다.
  let collabRef = null;
  let favorite = false;
  if (metaPath && fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      if (meta.thumbnail) thumbnail = meta.thumbnail;
      collabRef = meta.collabRef || null;
      favorite = meta.favorite === true;   // ★빠른 경로와 «같은 곳»에서 읽는다 — 갈리면 배지가 깜빡인다
    } catch {}
  }
  if (metaFast) { try { _refreshListMeta(data.id, data); } catch (_) {} }
  return { id: data.id, name: data.name, type: data.type || null, createdAt: data.createdAt,
           updatedAt: data.updatedAt, thumbnail, marketRef: data.marketRef || null, collabRef, favorite };
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

// 캔버스 이미지 외부화용 — content-hash 기반 저장(자동 dedup).
// 동일 바이트 = 동일 파일명 → 여러 참조가 한 파일 공유. 캔버스 HTML은 goya-asset:// URL만 보관.
function _extFromMime(mime) {
  switch (String(mime || '').toLowerCase()) {
    case 'image/jpeg': case 'image/jpg': return 'jpg';
    case 'image/svg+xml': return 'svg';
    case 'image/webp': return 'webp';
    case 'image/gif': return 'gif';
    default: return 'png';
  }
}
ipcMain.handle('assets:saveCanvasImage', (_e, { projectId, b64, mime } = {}) => {
  if (!projectId) return { ok: false, error: 'projectId 필수' };
  if (!b64) return { ok: false, error: 'b64 필수' };
  try {
    const buf = Buffer.from(b64, 'base64');
    // [externalize] 저장 규약(sha256 16hex + mime 확장자·dedup)은 externalizer.saveImageBytes 한 곳이 정본 —
    // 렌더러 신규 외부화와 main 일괄 외부화가 «같은 바이트 = 같은 파일명»이어야 dedup이 성립한다.
    const X = _getExternalizer();
    let filename, url;
    if (X) {
      ({ filename, url } = X.saveImageBytes(PROJECTS_DIR, _safeSeg(projectId), buf, mime));
    } else {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
      const dir = _getProjectAssetsDir(projectId);
      fs.mkdirSync(dir, { recursive: true });
      filename = `${hash}.${_extFromMime(mime)}`;
      const full = path.join(dir, filename);
      if (!fs.existsSync(full)) fs.writeFileSync(full, buf); // dedup: 이미 있으면 재기록 생략
      url = `goya-asset://${projectId}/${filename}`;
    }
    return {
      ok: true,
      hash: filename.split('.')[0],
      filename,
      blobPath: `assets/${filename}`,
      url,
      bytes: buf.length,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

// export HTML 포터블화용 — goya-asset:// 에셋을 base64 data URI로 읽어 반환.
// 렌더러 fetch()는 file:// origin에서 커스텀 스킴 cross-origin이 하드 차단되므로(Chromium),
// export-html의 inlineGoyaAssets가 이 IPC로 base64 재인라인한다. path-traversal 가드 포함.
ipcMain.handle('assets:readAsDataUri', (_e, { projectId, filename } = {}) => {
  try {
    const pid = _safeSeg(String(projectId || ''));
    const fn = _safeSeg(String(filename || ''));
    if (!pid || !fn) return { ok: false, error: 'projectId/filename 필수' };
    const safeRoot = path.join(PROJECTS_DIR, pid, 'assets');
    const full = path.join(safeRoot, fn);
    if (!full.startsWith(safeRoot + path.sep)) return { ok: false, error: 'forbidden' };
    if (!fs.existsSync(full)) return { ok: false, error: 'not found' };
    const ext = path.extname(full).slice(1).toLowerCase();
    const mime = _GOYA_ASSET_MIME[ext] || 'application/octet-stream';
    const b64 = fs.readFileSync(full).toString('base64');
    return { ok: true, dataUri: `data:${mime};base64,${b64}` };
  } catch (e) {
    return { ok: false, error: e && e.message };
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

  // 1) 신 레이아웃 우선: proj_<id>/proj.json — [b8] 메타 우선(무거운 proj.json 풀파싱 회피)
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (!/^proj_\d+$/.test(ent.name)) continue;
    const projPath = path.join(PROJECTS_DIR, ent.name, 'proj.json');
    if (!fs.existsSync(projPath)) continue;
    const id = ent.name; // 신 레이아웃 불변식: 디렉터리명 = proj_<id>
    if (seen.has(id)) continue;
    try {
      const item = _listItemFor(id, projPath, true);
      if (!item) continue;
      seen.add(item.id);
      items.push(item);
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

/* ── [externalize] 열 때 정책 (DESIGN-asset-batch-externalize.md §3-2 ①·§3-3·§4-C) ──
   렌더러가 «프로젝트를 연다»고 알린 로드(opts.open)에서만 동작. 저장 경로의 loadProject(기존본 병합)에선 안 돈다.
   - 협업 등록(meta.collabRef) 프로젝트: 자동변환 제외, 안내만(상대 디스크엔 에셋이 없다 — 지디 결정 ⓑ).
   - settings.autoExternalizeOnOpen=true: 변환 → 렌더러는 처음부터 goya-asset 본을 받는다(새로고침·경합 없음).
   - OFF(기본): 대형 레거시(≥20MB)면 힌트 이벤트만. 렌더러가 프로젝트당 1회 토스트.
   알림은 반환 객체에 필드를 섞지 않고 이벤트로 보낸다 — loadProject→saveProject로 그대로 되쓰는 호출부가
   여럿이라(이름변경 등) 마커가 proj.json에 새는 것을 막는다. */
const EXTERNALIZE_HINT_MIN_BYTES = 20 * 1024 * 1024;
function _externalizeOnOpen(event, id) {
  const X = _getExternalizer();
  if (!X) return;
  const safeId = _safeSeg(id);
  const scan = X.scanProjectFile(PROJECTS_DIR, safeId);
  if (!scan.exists || scan.base64Refs === 0) return;
  const send = (ch, payload) => { try { event.sender.send(ch, payload); } catch (_) {} };
  // [F5] 협업 제외 게이트는 fail-closed — meta가 «존재하는데 못 읽으면»(잘림·경합) 협업 여부 불명이므로
  //   변환을 보류한다(협업 프로젝트를 잘못 변환하면 상대 화면에서 이미지가 깨진다). meta 부재(정상 비협업)는 진행.
  let collabRef = null, metaUnreadable = false;
  try {
    const m = _resolveMetaJsonPath(safeId);
    if (m) {
      try { collabRef = (JSON.parse(fs.readFileSync(m, 'utf8')) || {}).collabRef || null; }
      catch (_) { try { if (fs.existsSync(m)) metaUnreadable = true; } catch (_2) {} }
    }
  } catch (_) {}
  if (collabRef || metaUnreadable) { send('projects:externalize-hint', { projectId: safeId, reason: collabRef ? 'collab' : 'meta_unreadable', bytes: scan.bytes, base64Refs: scan.base64Refs }); return; }
  if (readSettings().autoExternalizeOnOpen === true) {
    const r = X.externalizeProjectFile(PROJECTS_DIR, safeId, { afterWrite: (pid, data) => _refreshListMeta(pid, data) });
    console.log(`[externalize] on-open ${safeId}:`, JSON.stringify(r));
    if (r && r.ok && !r.noop) send('projects:externalized', { projectId: safeId, ...r });
    else if (r && !r.ok) send('projects:externalize-hint', { projectId: safeId, reason: 'failed', error: r.reason, bytes: scan.bytes, base64Refs: scan.base64Refs });
    return;
  }
  if (scan.bytes >= EXTERNALIZE_HINT_MIN_BYTES) send('projects:externalize-hint', { projectId: safeId, reason: 'legacy', bytes: scan.bytes, base64Refs: scan.base64Refs });
}

ipcMain.handle('projects:load', (event, id, opts) => {
  if (opts && opts.open === true) { try { _externalizeOnOpen(event, id); } catch (e) { console.warn('[externalize] on-open 실패(무시):', e && e.message); } }
  const filePath = _resolveProjectJsonPath(id);
  // 1) 정상 경로: proj.json
  if (filePath) {
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch (e) { console.warn(`[projects:load] proj.json 손상(${id}): ${e.message} — 백업 폴백 시도`); }
  }
  // 2) GAP-004 폴백 체인: proj_backup.json → proj_history 최신→오래된 순.
  //    백업 인프라(롤링백업·히스토리 5슬롯)가 옆에 유효본을 둬도 손상 시 빈 프로젝트로
  //    로드되던 데이터손실을 차단. 첫 유효본을 반환하고 proj.json으로 자가치유 재기록.
  //   후보 «순서 자체»가 계약이다 — backup → history(최신→오래된) → pre-externalize(★맨 끝).
  //   pre-externalize는 변환 시점에 고정돼 늙으므로 앞에 두면 한 달 늙은 원본이 최신 백업/히스토리를
  //   이겨 덮어쓰는 데이터손실(F1)이 난다. 이 순서는 snapshot-store 에서 특성화 테스트로 고정돼 있다.
  const candidates = _SS().loadFallbackCandidates(PROJECTS_DIR, id, _resolveBackupJsonPath);
  for (const c of candidates) {
    let proj;
    try { proj = JSON.parse(fs.readFileSync(c.path, 'utf8')); }
    catch (_) { continue; } // 이 백업도 손상 → 다음 후보
    // ★[A2 치명] «파싱되면 프로젝트»가 아니다. readVersion 은 이미 isProjectShaped 로 거르는데
    //   폴백 루프만 안 걸러서, 히스토리 폴더의 사이드카(pins.json)가 프로젝트로 채택되고
    //   자가치유가 39MB proj.json 을 3줄로 덮어썼다(3차 검수 end-to-end 재현).
    //   ⛔후보 «생성»쪽(loadFallbackCandidates)도 고쳤지만 여기서 한 번 더 막는다 —
    //   이 루프는 backup·pre-externalize 등 우리가 이름을 통제하지 못하는 파일도 먹는다.
    if (!_SS().isProjectShaped(proj)) {
      console.warn(`[projects:load] 후보가 프로젝트 형태가 아님 — 건너뜀: ${path.basename(c.path)}`);
      continue;
    }
    console.warn(`[projects:load] ${id} 손상 → ${c.from}(${path.basename(c.path)})에서 복구`);
    try { // 자가치유: 복구본을 proj.json으로 재기록 (다음 로드부터 정상)
      const paths = _ensureNewLayoutPaths(id);
      _atomicWriteFileSync(paths.proj, JSON.stringify(proj, null, 2));
    } catch (e) { console.warn('[projects:load] 자가치유 재기록 실패:', e.message); }
    return { ...proj, _recovered: c.from }; // _recovered: 렌더러 통지용(serialize엔 미포함)
  }
  // 3) proj.json·백업·히스토리 모두 부재/손상 → 복구 불가
  return null;
});

/* ── [externalize] 수동 변환 · 되돌리기 · 상태 조회 (설정>성능) ── */
ipcMain.handle('projects:externalize', (_e, { projectId, force } = {}) => {
  const X = _getExternalizer();
  if (!X) return { ok: false, reason: 'module_missing' };
  if (!projectId) return { ok: false, reason: 'projectId 필수' };
  // 협업 등록 프로젝트: 자동뿐 아니라 수동도 한 번 막는다(상대 디스크엔 에셋이 없어 깨진 이미지가 간다).
  // 사용자가 경고를 보고 force로 다시 부르면 진행(지디 결정 ⓑ의 수동 경로 보완).
  if (!force) {
    try {
      const m = _resolveMetaJsonPath(_safeSeg(projectId));
      if (m) {
        try { if ((JSON.parse(fs.readFileSync(m, 'utf8')) || {}).collabRef) return { ok: false, reason: 'collab' }; }
        // [F5] meta 존재하나 못 읽음 → 협업 여부 불명. 보수적으로 협업으로 간주해 막는다(force로 override 가능).
        catch (_) { try { if (fs.existsSync(m)) return { ok: false, reason: 'collab' }; } catch (_2) {} }
      }
    } catch (_) {}
  }
  const r = X.externalizeProjectFile(PROJECTS_DIR, _safeSeg(projectId), { afterWrite: (pid, data) => _refreshListMeta(pid, data) });
  console.log(`[externalize] manual ${projectId}:`, JSON.stringify(r));
  return r;
});
ipcMain.handle('projects:externalize-rollback', (_e, { projectId, dryRun } = {}) => {
  const X = _getExternalizer();
  if (!X) return { ok: false, reason: 'module_missing' };
  if (!projectId) return { ok: false, reason: 'projectId 필수' };
  const r = X.rollbackExternalize(PROJECTS_DIR, _safeSeg(projectId), { dryRun: dryRun === true, afterWrite: (pid, data) => _refreshListMeta(pid, data) });
  if (!dryRun) console.log(`[externalize] rollback ${projectId}:`, JSON.stringify(r));
  return r;
});
ipcMain.handle('projects:externalize-scan', (_e, { projectId } = {}) => {
  const X = _getExternalizer();
  if (!X || !projectId) return null;
  try { return X.scanProjectFile(PROJECTS_DIR, _safeSeg(projectId)); } catch (_) { return null; }
});

/* ── [version-history] 버전 기록 조회 (U2 — ★읽기 전용) ─────────────────────
 * ⛔이 블록에는 «쓰기» 채널이 없다. 되돌리기·사본생성은 U5/U6 에서 별도로 온다.
 *   복구 기능이 조회만으로 사용자 데이터를 바꾸면 안 된다.
 *   ⚠️ 단 하나의 예외는 사이드카(proj_history/index.json · pins.json)다 — «파생 캐시»이고
 *      잃어도 재빌드된다. 프로젝트 데이터(proj.json/백업/슬롯/에셋)는 한 바이트도 안 바뀐다.
 *      단위테스트가 그 경계를 (경로,크기,해시) 스냅샷 대조로 못 박는다.
 * ★DIFF_PAYLOAD_MAX: 정규화 «후»에도 이만큼 크면 렌더러로 안 보낸다. 목록의 숫자와 손실 요약은
 *   인덱스에서 나오므로 그래도 답이 나온다 — 상세 비교만 건너뛴다(P-1 정직). */
const DIFF_PAYLOAD_MAX = 8 * 1024 * 1024;

ipcMain.handle('projects:history-list', (_e, { projectId } = {}) => {
  const SS = _SS();
  if (!projectId || typeof SS.listVersions !== 'function') return { ok: false, reason: 'unavailable' };
  try { return SS.listVersions(PROJECTS_DIR, _safeSeg(projectId)); }
  catch (e) { console.warn('[history:list] 실패:', e.message); return { ok: false, reason: 'exception', message: e.message }; }
});

ipcMain.handle('projects:history-read', (_e, { projectId, ts } = {}) => {
  const SS = _SS();
  if (!projectId || typeof SS.readVersion !== 'function') return { ok: false, reason: 'unavailable' };
  try { return SS.readVersion(PROJECTS_DIR, _safeSeg(projectId), ts); }
  catch (e) { return { ok: false, reason: 'exception', message: e.message }; }
});

/* 손실/변경 비교용 재료 — ★«양쪽을 같은 좌표계로» 몰아서 준다.
 * 스냅샷은 정규형인데 현재본이 base64 면 이미지가 든 모든 섹션이 「변경」으로 떠서 목록이 무용해진다.
 * 렌더러는 40MB base64 를 해싱할 수 없으므로(동기 crypto 없음) 여기서 접어 보낸다.
 * canonicalize(write:false) = 해시만 계산, 디스크 무접촉. */
ipcMain.handle('projects:history-diff-payload', (_e, { projectId, ts } = {}) => {
  const SS = _SS();
  if (!projectId || typeof SS.readVersion !== 'function') return { ok: false, reason: 'unavailable' };
  const pid = _safeSeg(projectId);
  try {
    const snap = SS.readVersion(PROJECTS_DIR, pid, ts);
    if (!snap.ok) return snap;
    const curPath = _resolveProjectJsonPath(pid);
    if (!curPath) return { ok: false, reason: 'no_current' };
    let cur;
    try { cur = JSON.parse(fs.readFileSync(curPath, 'utf8')); }
    catch (e) { return { ok: false, reason: 'current_corrupt', message: e.message }; }

    const toMap = (data) => {
      const canon = SS.canonicalize(PROJECTS_DIR, pid, data, { write: false });
      const out = {};
      for (const c of SS._internal.canvasStrings(canon.data)) out[c.key] = c.html;
      return out;
    };
    const snapCanvas = toMap(snap.data);
    const curCanvas = toMap(cur);
    const size = Object.values(snapCanvas).reduce((a, h) => a + h.length, 0)
               + Object.values(curCanvas).reduce((a, h) => a + h.length, 0);
    if (size > DIFF_PAYLOAD_MAX) return { ok: false, reason: 'too_large', bytes: size };
    return { ok: true, ts: snap.ts, snapCanvas, curCanvas, bytes: size };
  } catch (e) {
    console.warn('[history:diff-payload] 실패:', e.message);
    return { ok: false, reason: 'exception', message: e.message };
  }
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

// 저장 코어 — ipcMain.handle('projects:save')(렌더러)와 MCP create_project(main)가 공용.
// (_duplicateProjectImpl과 같은 패턴 — 핸들러 본문을 함수로 추출했을 뿐 로직 무변경.)
async function _saveProjectImpl(project) {
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

      // (버전 스냅샷은 proj.json 을 «쓴 뒤» 아래에서 만든다 — 재료가 파일이 아니라 메모리의 객체다)
    } catch {}
  }

  _atomicWriteFileSync(filePath, JSON.stringify(project, null, 2));
  // [b8] 목록 메타 캐시 갱신 — proj.json 직후 기록해 meta.mtime >= proj.mtime 불변식 유지(목록 풀파싱 회피)
  _refreshListMeta(project.id, project);
  // [version-history] 버전 스냅샷 — «지금 저장되는 객체»를 정규형(goya-asset)으로 기록 + 계층 프룬.
  //   ★proj.json 을 «쓴 뒤»여야 한다: updateCurrent 가 새 mtime/size 를 읽어 목록 신선도 판정에 쓴다.
  //   ★스냅샷 실패가 저장 실패로 번지면 안 된다 — 전체를 삼킨다(현행 백업 로직과 같은 규율).
  try {
    _SS().writeSnapshot(PROJECTS_DIR, project.id, project, { reason: 'auto' });
    _SS().pruneVersions(PROJECTS_DIR, project.id);
  } catch (e) { console.warn('[projects:save] 버전 스냅샷 실패(저장은 정상):', e.message); }
  // claude-pm/project.meta.json title 동기화 (PM 폴더 있을 때만, best-effort)
  try { await syncClaudePmTitle(PROJECTS_DIR, project.id, project.name); } catch {}
  return { ok: true };
}
ipcMain.handle('projects:save', (event, project) => _saveProjectImpl(project));

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
    _refreshListMeta(project.id, project); // [b8] 목록 메타 캐시 동기 갱신 (mtime 불변식 유지)
    // [version-history/Q4] ★새로고침·탭닫기 순간에도 버전을 남긴다 — 사고가 제일 잦은 순간인데
    //   여태 이 경로엔 슬롯이 «전혀» 안 생겼다(롤링 백업만). 같은 10분 간격 게이트를 타므로
    //   종료가 매번 느려지지 않는다(실측: 게이트에 막히면 0.1ms, 생성될 때만 39.6MB 기준 230ms).
    //   ★스냅샷 실패가 «종료 저장»을 막으면 안 된다 — 삼킨다.
    try {
      _SS().writeSnapshot(PROJECTS_DIR, project.id, project, { reason: 'unload' });
      _SS().pruneVersions(PROJECTS_DIR, project.id);
    } catch (e) { console.warn('[projects:save-sync] 버전 스냅샷 실패(저장은 정상):', e.message); }
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

/* ── [version-history/U7] 삭제 안전망 — 영구삭제 → «휴지통» (현빈 승인) ────
 * ★설계 §8-0 규약: «되돌릴 수단»을 대상과 «같은 봉투»에 두지 마라.
 *   proj_<id>/ 안에 proj.json · proj_backup.json · **proj_history 스냅샷 전부** · assets 가 다 있다.
 *   그걸 rmSync 하면 본체와 복구 수단이 «동시에» 사라진다 — 우리가 만든 버전 히스토리가 삭제 앞에서
 *   통째로 무력해진다. 휴지통이 그 봉투 «밖»의 안전망 역할을 한다.
 *
 * ★실패하면 «조용히 영구삭제로 폴백하지 않는다». 복구 도구를 만들면서 「휴지통이 안 되니 지울게요」는
 *   앞뒤가 안 맞는다. 대신 정직하게 실패를 돌려주고, «영구 삭제»는 사용자가 2차 확인으로 «선택»한다.
 *   ⇒ 반환을 { ok, trashed, reason } 으로 나눠 「지웠나」와 「휴지통이냐 영구냐」를 구분한다.
 *     (구 반환은 boolean 하나라 「지웠다」와 「지울 게 없었다」가 같은 값이었다.)
 *
 * ⚠️비동기 전환의 숨은 위험(설계 D-U7-4): rmSync 는 반환 시점에 이미 끝나 «반쯤 지워진 상태»가
 *   구조적으로 없었다. trashItem 은 Promise 라 await 사이에 autosave 가 끼어들 수 있다.
 *   ⇒ 호출측(렌더러)이 «그 프로젝트를 안 연 상태»로 부르는 게 전제다 — 갤러리에서만 부른다.
 */
ipcMain.handle('projects:delete', async (event, id, opts = {}) => {
  const safeId = String(id || '').trim();
  if (!safeId || safeId.includes('/') || safeId.includes('\\') || /^\.+$/.test(safeId)) {
    return { ok: false, trashed: false, reason: 'invalid_id' };
  }
  const permanent = opts && opts.permanent === true;   // ★2차 확인을 «거친» 경우에만 true
  const projectsBase = path.resolve(PROJECTS_DIR);
  const dirPath = path.resolve(PROJECTS_DIR, safeId);
  const inBase = (p) => p.startsWith(projectsBase + path.sep);

  // 지울 대상 모으기 — 번들 디렉터리 + 구 flat 잔재.
  // ★flat <id>_history/ 도 «복구 재료»다(projects:load 폴백 체인이 읽는다) — 같이 휴지통으로 보낸다.
  // ★순서가 중요하다 — «구 flat 잔재 먼저, 번들 디렉터리 나중».
  //   반대로 하면(번들 먼저) 잔재 하나가 실패했을 때 «본체는 휴지통인데 <id>_history 는 남는» 상태가 되고,
  //   목록의 낡은 카드를 누르면 projects:load 폴백이 그 잔재로 «옛 내용의 좀비»를 되살린다.
  //   잔재 먼저면 최악이 「본체는 멀쩡한데 낡은 잔재만 치웠다」라 무해하다.
  const targets = [];
  for (const name of [`${safeId}.json`, `${safeId}_meta.json`, `${safeId}_backup.json`, `${safeId}_history`]) {
    const p2 = path.resolve(PROJECTS_DIR, name);
    if (inBase(p2) && fs.existsSync(p2)) targets.push(p2);
  }
  if (inBase(dirPath) && fs.existsSync(dirPath)) targets.push(dirPath);
  if (!targets.length) return { ok: true, trashed: false, reason: 'not_found', deleted: 0 };

  // ★휴지통에서 «찾을 수 있어야» 복구다. proj_178… 폴더가 수십 개면 자기 걸 못 고른다.
  //   ⛔디렉터리 이름은 «안» 바꾼다 — id 가 곧 디렉터리명이라 trash 실패 시 살아있는 프로젝트가 깨진다.
  //   어차피 버려질 봉투 «안»에 마커를 넣는 건 위험이 0이다.
  // ⛔permanent 모드엔 마커가 쓸모없다(휴지통에서 찾을 일이 없다) — 안 쓴다.
  // ⚠️symlink 로 base 밖을 가리키면 마커가 PROJECTS_DIR 밖에 써진다 → realpath 로 한 번 더 막는다.
  let markerPath = null;
  if (!permanent && fs.existsSync(dirPath)) {
    let realOk = false;
    try { realOk = fs.realpathSync(dirPath).startsWith(fs.realpathSync(projectsBase) + path.sep); } catch (_) {}
    if (realOk) {
    try {
      let name = safeId, sections = null;
      try {
        const m = JSON.parse(fs.readFileSync(path.join(dirPath, 'proj_meta.json'), 'utf8'));
        if (m && m.name) name = m.name;
      } catch (_) {}
      try { sections = _countSections(JSON.parse(fs.readFileSync(path.join(dirPath, 'proj.json'), 'utf8'))); } catch (_) {}
      markerPath = path.join(dirPath, '_deleted-info.json');
      fs.writeFileSync(markerPath,
        JSON.stringify({ name, id: safeId, deletedAt: new Date().toISOString(), sections }, null, 2));
    } catch (_) { markerPath = null; /* 마커 실패는 삭제를 무르지 않는다 */ }
    }
  }

  const failed = [];
  let trashedCount = 0;
  let bundleMoved = false;   // ★«우리가» 번들을 옮겼나 — 사후조건은 그때만 의미가 있다
  // ★[A3 치명] 하나라도 실패하면 «거기서 멈춘다». targets 는 「잔재 먼저, 번들 마지막」 순이므로
  //   조기중단은 곧 «번들 무접촉»이다.
  //   ⛔초판은 실패해도 continue 해서, 잔재가 EPERM 인데 번들만 휴지통으로 갔다. 그러면
  //   2차 확인창에서 「영구 삭제」를 취소하는 순간 — proj.json·proj_history·assets 는 전부 휴지통이고
  //   구 flat 잔재만 남아서 — 같은 이름 카드가 «1년 전 내용»으로 부활하고(projects:load 폴백),
  //   그 프로젝트의 버전 기록은 통째로 휴지통이라 «앱 안에서» 되돌릴 방법이 없다.
  //   다음 자동저장이 그 옛 내용을 새 번들로 굳혀 되돌리기 창까지 닫는다.
  //   ★순서(잔재 먼저)는 필요조건이었을 뿐 충분조건이 아니었다 — 중단이 있어야 보장이 된다.
  //   ⇒ 이 루프가 나가는 순간의 불변식: «failed 가 비어있지 않으면 번들은 그대로 있다».
  for (const t of targets) {
    if (permanent) {
      try { fs.rmSync(t, { recursive: true, force: true }); trashedCount++; if (t === dirPath) bundleMoved = true; }
      catch (e) { failed.push({ path: path.basename(t), error: e.message }); break; }
    } else {
      try { await shell.trashItem(t); trashedCount++; if (t === dirPath) bundleMoved = true; }
      catch (e) {
        // ★이미 없으면 «성공»이다 — 연타·경합으로 먼저 치워진 것을 실패로 보면
        //   사용자에게 「영구 삭제할까요」라는 거짓 경고를 띄운다.
        //   ⛔단 bundleMoved 로는 «안» 친다 — 우리가 옮긴 게 아니므로 아래 사후조건의 대상이 아니다.
        if (e && (e.code === 'ENOENT' || /ENOENT/.test(e.message || ''))) { trashedCount++; continue; }
        failed.push({ path: path.basename(t), error: e.message });
        break;
      }
    }
  }
  if (failed.length) {
    // ★조용히 영구삭제로 폴백하지 «않는다». 사용자가 알고 고르게 한다.
    // ★★그리고 «부분 이동»을 「전부 실패」로 말하지 않는다 — 초판은 trashedCount 를 «계산만 하고 안 읽어»
    //   번들이 이미 휴지통에 간 상태에서 trashed:false 를 답했다. 그러면 렌더러가
    //   「휴지통으로 옮길 수 없습니다 → 영구 삭제할까요」라는 «사실과 다른» 확인창을 띄운다.
    //   ★[A3] 조기중단 덕분에 여기서 bundleMoved 는 «항상 false» 다(번들이 목록의 마지막이므로).
    //   그래서 trashed 는 «번들이 갔나»로 정직하게 답할 수 있다 — 렌더러의 확인창이 이걸 보고
    //   「영구 삭제할까요」를 물으므로, 여기서 거짓을 말하면 사용자가 판단을 그르친다.
    const partial = trashedCount > 0;   // 잔재 일부만 옮겨졌다(프로젝트 본체는 그대로)
    console.warn('[projects:delete] 실패:', JSON.stringify(failed), 'moved=', trashedCount, 'bundleMoved=', bundleMoved);
    if (markerPath) { try { fs.unlinkSync(markerPath); } catch (_) {} }   // 살아남은 프로젝트에 마커를 남기지 않는다
    return { ok: false, trashed: bundleMoved, bundleIntact: !bundleMoved, deleted: trashedCount,
             reason: permanent ? 'delete_failed' : (partial ? 'trash_partial' : 'trash_failed'),
             message: failed[0].error, failed };
  }
  // ★사후조건 — await 사이에 autosave 가 프로젝트를 «다시 만들었을» 수 있다(D-U7-4 의 비동기 창).
  //   그러면 「휴지통에 보냈다」가 사실이 아니다. 잠금 대신 결과를 확인해서 정직하게 답한다.
  if (!permanent && bundleMoved && fs.existsSync(dirPath)) {
    return { ok: false, trashed: true, deleted: trashedCount, reason: 'recreated_during_delete',
             message: '삭제 도중 프로젝트가 다시 만들어졌습니다(다른 창에서 편집 중일 수 있습니다).' };
  }
  return { ok: true, trashed: !permanent, deleted: trashedCount };
});


// 프로젝트 복제 코어 — ipcMain.handle(렌더러)와 MCP 도구(duplicate_project)가 공용.
/**
 * 프로젝트 복제.
 * @param {object} args
 * @param {string} args.sourceProjectId 원본 id — 에셋 폴더·meta·goya-asset URL 재매핑의 «기준»이다.
 * @param {string} [args.newName]
 * @param {object} [args.sourceData] ★내용을 «다른 것»으로 바꿔 복제한다(버전 히스토리의 「사본으로 열기」).
 *   안 주면 원본 proj.json 을 읽는다(기존 동작 그대로). 주면 그 객체가 내용이 되고,
 *   에셋 하드링크·goya-asset URL 치환·meta 처리 등 «나머지 전부»는 동일한 경로를 탄다.
 *   ⇒ 복제 로직을 두 벌 만들지 않는다. js/market.js 가 saveProject 로 직접 만들다가 에셋을 통째로
 *     빠뜨린 전례가 있다(사본이 원본 폴더를 몰래 참조 → 원본 삭제 시 404).
 */
async function _duplicateProjectImpl({ sourceProjectId, newName, sourceData } = {}) {
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

    // JSON 복사 + 메타 갱신. sourceData 가 오면 «내용만» 그것으로 바꾼다(기준 id 는 그대로 원본).
    const src = sourceData && typeof sourceData === 'object'
      ? sourceData
      : JSON.parse(fs.readFileSync(srcJsonPath, 'utf8'));
    const dup = JSON.parse(JSON.stringify(src)); // 깊은 복제 — 호출측 객체를 절대 변형하지 않는다
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

    // 캔버스 HTML 안의 goya-asset://<oldId>/ → <newId>/ 재매핑 (asset은 하드링크로 공유되지만
    // URL의 projectId가 원본을 가리키면 프로토콜 핸들러가 원본 폴더를 읽음 → 신 id로 교정).
    const oldUrlPrefix = `goya-asset://${sourceProjectId}/`;
    const newUrlPrefix = `goya-asset://${newId}/`;
    if (Array.isArray(dup.pages)) {
      for (const pg of dup.pages) {
        if (pg && typeof pg.canvas === 'string' && pg.canvas.includes(oldUrlPrefix)) {
          pg.canvas = pg.canvas.split(oldUrlPrefix).join(newUrlPrefix);
        }
      }
    }

    // 자산 폴더 복사 — tmp → rename으로 원자성
    // source 디렉터리는 항상 PROJECTS_DIR/<sourceProjectId>/ (claude-pm/images/assets 등은 이미 신 레이아웃)
    const srcDir = path.join(PROJECTS_DIR, sourceProjectId);
    const dstDir = path.join(PROJECTS_DIR, newId);
    const tmpDir = path.join(PROJECTS_DIR, `.${newId}.tmp`);
    if (fs.existsSync(srcDir)) {
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
        // images/: 프로젝트별 가변(AI 생성물 편집 등) → 실복사.
        const imgSrc = path.join(srcDir, 'images');
        if (fs.existsSync(imgSrc)) fs.cpSync(imgSrc, path.join(tmpDir, 'images'), { recursive: true });
        // assets/: content-hash 불변 파일 → 하드링크로 공유(85MB 재복사 회피, dedup 유지).
        //          동일 볼륨이라 linkSync 성공. 실패(크로스볼륨 등) 시 파일별 copy 폴백.
        const astSrc = path.join(srcDir, 'assets');
        if (fs.existsSync(astSrc)) {
          const astDst = path.join(tmpDir, 'assets');
          fs.mkdirSync(astDst, { recursive: true });
          for (const ent of fs.readdirSync(astSrc, { withFileTypes: true })) {
            if (!ent.isFile()) continue; // assets는 평면 파일만
            const sp = path.join(astSrc, ent.name);
            const dp = path.join(astDst, ent.name);
            try { fs.linkSync(sp, dp); }
            catch (_) { fs.copyFileSync(sp, dp); } // 폴백
          }
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
        // ★collabRef 는 «이 문서»가 아니라 «이 설치의 원격 연결 상태»다(main.js:852). 사본에 딸려가면
        //   두 프로젝트가 같은 협업방을 가리켜 서로의 편집을 덮어쓴다 — 그건 데이터 사고다.
        //   externalized 마커도 사본에는 의미가 없다(사본의 pre-externalize 원본이 없으므로 되돌리기 불가).
        delete meta.collabRef;
        delete meta.externalized;
        _atomicWriteFileSync(targetPaths.meta, JSON.stringify(meta, null, 2));
      } catch (e) { console.warn('[projects:duplicate] meta 복사 실패:', e.message); }
    }
    // [b8] 사본 목록 캐시는 사본 데이터 기준으로 갱신 — 원본 meta를 복사하면 createdAt 등 목록필드가
    //   원본 값으로 stale해지므로(meta.mtime>proj.mtime라 목록서 그대로 노출됨) dup으로 덮어쓴다.
    try { _refreshListMeta(newId, dup); } catch (_) {}

    return { ok: true, newProjectId: newId, newName: baseName };
  } catch (e) {
    console.error('[projects:duplicate] 예외:', e);
    return { ok: false, error: e.message || '알 수 없는 오류', code: 'io' };
  }
}
ipcMain.handle('projects:duplicate', (_e, args = {}) => _duplicateProjectImpl(args));

/* ── [version-history] U5 «사본으로 열기» — 비파괴 ─────────────────────────
 * 옛 버전을 «새 프로젝트»로 만든다. 원본 프로젝트는 한 바이트도 안 바뀐다.
 * 읽기전용 뷰어 대신 사본을 주는 이유: 사용자는 만져보고 판단해야 하는데, 원본은 안전해야 한다.
 * ★반드시 _duplicateProjectImpl 을 탄다 — goya-asset URL 이 hostname 에 projectId 를 박고 있어서
 *   URL 치환 + 에셋 하드링크를 안 하면 사본이 원본 폴더를 몰래 참조한다(원본 삭제 시 404). */
/* ── [version-history] U6b «이 버전으로 교체» — ★파괴 경로 ────────────────
 * 현빈 확정(Q2): 교체가 «기본», 교체 «직전» 자동 스냅샷, 다른 창에 열려 있으면 거부 + 새 프로젝트만.
 *
 * ★안전판이 «먼저» 박히는 순서를 코드가 강제한다 — snapshot-store.prepareRestore 가
 *   ①안전판 강제 스냅샷 → ②실패하면 data 조차 «안 넘기고» 종료 → ③성공해야 데이터를 준다.
 *   그래서 이 핸들러는 「안전판을 잊는」 실수를 할 수 없다(잊으면 덮을 데이터 자체가 없다).
 *
 * ★★autosave 경합 — 이 유닛의 진짜 난점(설계 §D10)
 *   그 프로젝트가 «에디터에 열려 있는데» main 이 proj.json 을 직접 쓰면,
 *   1.5초 뒤 autosave 가 옛 DOM 으로 «되돌린 것을 되돌린다».
 *   ⇒ 열려 있으면 main 은 «쓰지 않고» 데이터만 준다. 적용은 렌더러가
 *     state._suppressAutoSave + applyProjectData 로 한다(commit-system.js:269 가 세운 정본).
 *
 * ★다중 인스턴스 — 2026-09-02 «막았다»(현빈 확정: 포토샵처럼 하나만). 잠금은 main/gdt/wire.js 의
 *   registerGdtFileAssociations() 안에 있다(requestSingleInstanceLock + second-instance → 첫 창을 앞으로).
 *   ⚠️예외가 «둘» 있다: `--remote-debugging-port` 가 붙은 dev 실행(CDP 검증·격리 인스턴스)과
 *     GODITOR_ALLOW_MULTI=1. 즉 «개발 중에는» 두 번째 프로세스가 여전히 뜬다 — 아래 판별은 그대로 필요하다.
 *   판별 불가일 때 덮어쓰면 남의 편집을 조용히 날린다 ⇒ 거부하고 «왜»를 화면에 말한다(설계 §7-4).
 *   호출측은 openProjectIds(이 창이 연 탭 목록)를 «반드시» 넘겨야 한다 — 안 넘기면 판별 불가로 본다.
 */
ipcMain.handle('projects:history-restore', async (_e, { projectId, ts, openProjectIds, activeProjectId, currentData } = {}) => {
  const SS = _SS();
  if (!projectId || typeof SS.prepareRestore !== 'function') return { ok: false, reason: 'unavailable' };
  const pid = _safeSeg(projectId);

  // ★「열려 있나」를 main 이 «추측하지 않는다» — 렌더러가 답한다(설계 §D10).
  if (!Array.isArray(openProjectIds)) {
    return { ok: false, reason: 'unknown_open_state',
      message: '다른 창에서 열려 있을 수 있어 교체할 수 없습니다 — 새 프로젝트로 복원하세요.' };
  }
  // ★«다른 창»은 main 이 실제로 셀 수 있다. 창이 둘 이상이면 이 창의 탭 목록은 «전체 지식»이 아니다
  //   → 덮어쓰면 다른 창의 편집을 조용히 날린다. 거부하고 이유를 말한다.
  //   ⚠️ 별도 «프로세스»(두 번째 앱 실행)는 이걸로도 못 잡는다. 배포본에서는 단일 인스턴스 잠금이
  //     그걸 막지만(main/gdt/wire.js), dev 실행(--remote-debugging-port·GODITOR_ALLOW_MULTI=1)은
  //     여전히 여러 개가 뜬다 ⇒ 이 창 수 판별은 «폐기하지 마라». §D10 잔여 위험은 «개발 실행»으로 좁혀졌다.
  let windowCount = 1;
  try { windowCount = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed()).length || 1; } catch (_) {}
  if (windowCount > 1) {
    return { ok: false, reason: 'multiple_windows', windowCount,
      message: `창이 ${windowCount}개 열려 있어 교체할 수 없습니다(다른 창에서 이 프로젝트를 편집 중일 수 있습니다) — 새 프로젝트로 복원하세요.` };
  }
  /* ★[1차검수 잠복] «열려 있다»만으로 렌더러 적용을 켜면 안 된다.
   * applyProjectData 는 «활성 탭»의 화면을 바꾼다 — 비활성 탭의 projectId 로 부르면
   * A 의 데이터가 활성 탭 B 화면에 적용된다. 현 진입점 조합에선 도달 불가지만,
   * ★진입점이 하나만 늘면 바로 터진다(방금 톱니바퀴를 늘렸다). 구조로 막는다.
   * ⇒ 렌더러가 「이게 활성 탭이다」를 명시(activeProjectId)해야만 적용 경로를 연다.
   *   아니면 main 이 직접 쓴다 — 화면이 안 바뀌니 경합도 없다. */
  const isOpenHere = openProjectIds.includes(pid) && activeProjectId === pid;

  let r;
  try { r = SS.prepareRestore(PROJECTS_DIR, pid, ts, { currentData: isOpenHere ? currentData : null }); }
  catch (e) { console.error('[history:restore] prepareRestore 예외:', e); return { ok: false, reason: 'exception', message: e.message }; }
  if (!r.ok) return r;   // ★안전판이 없으면 여기서 끝. 아래로 내려가지 않는다.

  // 열려 있으면 «쓰지 않는다» — 렌더러가 적용한다(autosave 경합 회피)
  if (isOpenHere) {
    return { ok: true, applyInRenderer: true, preRestoreTs: r.preRestoreTs, ts: r.ts,
             data: r.data, source: r.source, missingAssets: r.missingAssets,
             targetEmpty: r.targetEmpty, currentEmpty: r.currentEmpty };
  }
  // 안 열려 있으면 main 이 직접 쓴다.
  // ★★[C1] «그대로 쓰면» 안 된다. 되돌릴 데이터는 스냅샷이고, 스냅샷은 렌더러의 serializeProject()
  //   산출물일 수 있어 id·name·createdAt·marketRef 가 «없다». 그대로 쓰면 proj.json 에 id 가 없어
  //   _listItemFor(main.js:850)가 그 프로젝트를 목록에서 통째로 빼버린다 — 사용자에겐 «삭제»로 보인다.
  //   ⇒ 정상 저장경로(_saveProjectImpl → _guardProjectName)와 «같은 규율»로 기존 파일과 병합한다.
  try {
    const prevPath = _resolveProjectJsonPath(pid);
    let prev = {};
    try { if (prevPath) prev = JSON.parse(fs.readFileSync(prevPath, 'utf8')) || {}; } catch (_) {}
    const merged = {
      ...prev, ...r.data,
      id: pid,
      name: r.data.name || prev.name || 'Untitled',
      createdAt: r.data.createdAt || prev.createdAt || null,
      updatedAt: new Date().toISOString(),   // 되돌린 «시각»이 최신이다 — 목록 정렬이 과거로 감기면 안 된다
    };
    await _saveProjectImpl(merged);          // 롤링백업·이름가드·목록캐시·스냅샷을 한 번에 얻는다
  } catch (e) {
    // ★여기서 실패해도 «안전판은 이미 있다» — 사용자는 아무것도 잃지 않았다.
    console.error('[history:restore] 쓰기 실패:', e);
    return { ok: false, reason: 'write_failed', message: e.message, preRestoreTs: r.preRestoreTs };
  }
  return { ok: true, applyInRenderer: false, preRestoreTs: r.preRestoreTs, ts: r.ts,
           source: r.source, missingAssets: r.missingAssets,
           targetEmpty: r.targetEmpty, currentEmpty: r.currentEmpty };
});

ipcMain.handle('projects:history-open-copy', async (_e, { projectId, ts, newName } = {}) => {
  const SS = _SS();
  if (!projectId || typeof SS.readVersion !== 'function') return { ok: false, error: 'unavailable', code: 'unavailable' };
  const pid = _safeSeg(projectId);
  try {
    const snap = SS.readVersion(PROJECTS_DIR, pid, ts);
    if (!snap.ok) return { ok: false, error: snap.reason, code: snap.reason };
    let base = pid;
    try { const cur = JSON.parse(fs.readFileSync(_resolveProjectJsonPath(pid), 'utf8')); base = cur.name || base; }
    catch (_) { base = (snap.data && snap.data.name) || base; }
    const d = new Date(snap.ts);
    const stamp = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} `
                + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const name = (newName && String(newName).trim()) || `${base} (v ${stamp})`;
    const r = await _duplicateProjectImpl({ sourceProjectId: pid, newName: name, sourceData: snap.data });
    return r.ok ? { ...r, fromTs: snap.ts } : r;
  } catch (e) {
    console.error('[history:open-copy] 예외:', e);
    return { ok: false, error: e.message, code: 'io' };
  }
});

// 프로젝트 생성 코어 — MCP create_project 도구가 사용.
// ⚠️빈 프로젝트 «포맷»은 갤러리 「새 프로젝트」(pages/projects.html createProject())와 동일해야
//   한다 — 저쪽 스냅샷 구조를 바꾸면 여기도 같이 바꿀 것. 저장은 렌더러와 «같은 경로»
//   (_saveProjectImpl = projects:save 코어)를 그대로 탄다(새 포맷을 손으로 빚지 않는다).
async function _createProjectImpl({ name } = {}) {
  try {
    const projName = (name && String(name).trim()) || 'Untitled';
    if (projName.length > 100) return { ok: false, error: 'name too long (>100)', code: 'invalid' };
    // 새 ID — _duplicateProjectImpl과 동일한 충돌 방어(신 디렉터리/flat 잔재 모두 체크)
    let id, t = Date.now();
    do { id = `proj_${t}`; t++; }
    while (
      fs.existsSync(path.join(PROJECTS_DIR, id)) ||
      fs.existsSync(path.join(PROJECTS_DIR, `${id}.json`))
    );
    const now = new Date().toISOString();
    const emptySnap = JSON.stringify({
      version: 2, currentPageId: 'page_1',
      pages: [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { bg: '#f5f5f5', gap: 100, padX: 72, padY: 32, padXExcludesAsset: true }, canvas: '' }]
    });
    const proj = {
      id, name: projName,
      createdAt: now, updatedAt: now,
      version: 2,
      currentPageId: 'page_1',
      pages: [{ id: 'page_1', name: 'Page 1', label: '', pageSettings: { bg: '#f5f5f5', gap: 100, padX: 72, padY: 32, padXExcludesAsset: true }, canvas: '' }],
      currentBranch: 'dev',
      branches: {
        main: { snapshot: emptySnap, createdAt: Date.now(), updatedAt: Date.now() },
        dev:  { snapshot: emptySnap, createdAt: Date.now(), updatedAt: Date.now() }
      }
    };
    const r = await _saveProjectImpl(proj);
    if (!r || r.ok !== true) return { ok: false, error: 'save failed', code: 'io' };
    // PM 폴더 보장 — 갤러리 createProject()와 동일하게 best-effort(실패해도 생성은 성공).
    try { await handleEnsureClaudePMFolder(null, { projectId: id, projectName: projName }); } catch (_) {}
    return { ok: true, projectId: id, name: projName };
  } catch (e) {
    console.error('[projects:create] 예외:', e);
    return { ok: false, error: e.message || '알 수 없는 오류', code: 'io' };
  }
}

/* ── 열림 «확정» 대기 (2026-08-25, 조용한 데이터 유실 봉합) ────────────────────
 * ⛔loadFile 은 «문서 로드»까지만 기다린다. 그 뒤 렌더러가 프로젝트를 읽어 캔버스를 복원하는
 *   구간은 안 기다린다. 실측(39MB 세이프본, open_project 응답 t0 기준):
 *     t0+87ms    응답 ok
 *     t0+782ms   URL·window.activeProjectId·readyState('complete')·window.addSection ← 넷 다 «목적지 값»
 *                인데 캔버스 섹션 0개(=아직 옛/빈 DOM)
 *     t0+1,782ms 섹션 22개 적용 완료
 *   그 1.7초 창에 들어온 편집은 곧 교체될 DOM 에 쓰이고 «에러 없이» 사라진다.
 * ⇒ 위 넷은 전부 거짓말한다. 기다릴 수 있는 유일한 진실은 렌더러가 스스로 찍는 «적용 완료 확정»
 *   (js/project-loading.js 의 gdtProjectReady) 뿐이다.
 * ⇒ 그리고 «적용 완료»만으로도 부족했다(2차 실측) — applyProjectData 는 autosave 억제를
 *   rAF 한 프레임 뒤에 푸는데, 39MB 는 그 프레임이 늦어 적용 직후 편집이 «저장 예약조차» 안 됐다.
 *   그래서 대기 조건은 «적용 확정 + autosave 무장(autosaveArmed)» 둘 다이다.
 * ⛔setTimeout 고정 대기 금지 — 로드 시간은 프로젝트 크기에 비례한다(수십ms~수초). 임의 상수는 깨진다.
 */
const OPEN_READY_TIMEOUT_MS = 120000;   // 39MB급도 통과하는 상한. 초과 = 정직한 load_timeout.
async function _waitProjectReady(wc, projectId, timeoutMs, prevDocOrigin) {
  const t0 = Date.now();
  const deadline = t0 + timeoutMs;
  let interval = 25;
  let last = null;
  let mismatchSince = 0;
  const EXPR = '(window.gdtProjectReady && window.gdtProjectReady.get) ? window.gdtProjectReady.get() : null';
  for (;;) {
    if (!mainWindow || mainWindow.isDestroyed() || !wc || wc.isDestroyed()) {
      return { ok: false, code: 'no_window', waitedMs: Date.now() - t0, state: last };
    }
    let s = null;
    // 네비게이션 중엔 컨텍스트가 파괴돼 throw 한다 — 그건 «아직»이라는 뜻이지 실패가 아니다.
    // ⚠️렌더러가 «완전히» 멈추면(무거운 동기 작업·디버거 정지) executeJavaScript 는 영원히
    //   안 돌아온다 → 여기서 await 로 굳으면 deadline 검사에 도달조차 못 해 타임아웃이 «안 난다».
    //   그래서 매 폴에 상한을 건다(무응답 = 아직, 다음 폴에서 다시 본다).
    //   ★상한은 «남은 예산»으로 잡는다 — 고정 1초로 잡으면 예산이 끝난 뒤 도착한 응답을 보고
    //     timeoutMs 를 넘겨 ok 를 돌려주게 된다(실측: timeoutMs=1000 인데 1,404ms 에 ok).
    const cap = Math.min(1000, Math.max(50, deadline - Date.now()));
    try {
      s = await Promise.race([
        wc.executeJavaScript(EXPR).catch(() => null),
        new Promise(r => setTimeout(() => r(null), cap)),
      ]);
    } catch (_) { s = null; }
    if (s) {
      last = s;
      if (s.urlProject !== projectId) {
        // 누군가 그 사이 다른 곳으로 이동시켰다. 계속 기다려봐야 영영 안 온다.
        if (!mismatchSince) mismatchSince = Date.now();
        else if (Date.now() - mismatchSince > 2000) {
          return { ok: false, code: 'navigated_away', waitedMs: Date.now() - t0, state: s };
        }
      } else {
        mismatchSince = 0;
        // ★«이번 navigate 에 대응하는» 문서인가 — 이전 문서에 남아 있던 ready 를 보고 통과하면
        //   거짓양성이다(begin 없는 상태/지난 로드의 잔여 settle). 문서 신원으로 못 박는다.
        const freshDoc = (prevDocOrigin == null) || (s.docOrigin != null && s.docOrigin !== prevDocOrigin);
        // ★'ready'(적용 완료) 만으로는 부족하다 — autosave 억제가 아직 안 풀렸으면 그 편집은
        //   MutationObserver 에 삼켜져 저장이 «예약조차» 안 된다(project-loading.js 주석의 실측).
        if (freshDoc && s.projectId === projectId && s.phase === 'ready' && s.autosaveArmed === true) {
          return { ok: true, waitedMs: Date.now() - t0, state: s };
        }
        if (freshDoc && s.projectId === projectId && s.phase === 'error') {
          return { ok: false, code: 'load_error', waitedMs: Date.now() - t0, state: s };
        }
      }
    }
    if (Date.now() >= deadline) break;
    await new Promise(r => setTimeout(r, Math.min(interval, Math.max(1, deadline - Date.now()))));
    if (interval < 250) interval = Math.min(250, Math.round(interval * 1.6));
  }
  return { ok: false, code: 'load_timeout', waitedMs: Date.now() - t0, state: last };
}

// 활성 프로젝트 «전환» 코어 — MCP open_project 도구가 사용.
// 갤러리 openProject()(location.href='../index.html?project=<id>')와 같은 목적지로 mainWindow를
// navigate한다. mcp-server._activeProjectId()가 창 URL(?project=)을 읽으므로 navigate = 전환.
// ⚠️main의 loadFile은 will-navigate(GAP-008 라이선스 가드)를 «안» 타므로 같은 조건을 여기서
//   직접 검사한다 — 미인증 상태에서 MCP로 게이트를 우회해 에디터에 진입하는 구멍 방지.
// 이전 프로젝트의 미저장 변경분은 렌더러 beforeunload의 projects:save-sync(새로고침과 동일
// 경로)가 flush한다.
async function _openProjectImpl({ projectId, timeoutMs } = {}) {
  try {
    if (!projectId || typeof projectId !== 'string') return { ok: false, error: 'projectId 필수', code: 'invalid' };
    if (!/^proj_\d+$/.test(projectId)) return { ok: false, error: 'proj_* 만 열 수 있습니다', code: 'not_proj' };
    const projPath = _resolveProjectJsonPath(projectId);
    if (!projPath || !fs.existsSync(projPath)) return { ok: false, error: `project not found: ${projectId}`, code: 'not_found' };
    if (!_editorAccessGranted && !isAdminAuthorized()) return { ok: false, error: '라이선스 미인증 — 에디터 접근 불가', code: 'no_access' };
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) return { ok: false, error: 'window not ready', code: 'no_window' };
    let previousProject = null;
    let previousScreen = null;
    try {
      const u = mainWindow.webContents.getURL();
      const m = u && u.match(/[?&]project=([^&#]+)/);
      if (m) previousProject = decodeURIComponent(m[1]);
      // ★previousProject:null 은 «못 읽었다»가 아니라 «편집기가 아니었다»일 수 있다(갤러리/라이선스
      //   화면엔 ?project= 가 없다). 둘을 구분 못 하면 정상 동작이 이상 신호로 오독된다.
      const mm = u && u.match(/\/([^/?#]+\.html)/);
      previousScreen = mm ? mm[1] : (u ? 'unknown' : 'none');
    } catch (_) {}
    // 이번 navigate «전»의 문서 신원 — 아래 대기가 「새 문서인가」를 대조하는 기준.
    let prevDocOrigin = null;
    try {
      prevDocOrigin = await Promise.race([
        mainWindow.webContents.executeJavaScript('(performance && performance.timeOrigin) || null').catch(() => null),
        new Promise(r => setTimeout(() => r(null), 1500)),
      ]);
    } catch (_) { prevDocOrigin = null; }
    const tmo = Number.isInteger(timeoutMs) && timeoutMs >= 1000 && timeoutMs <= 600000
      ? timeoutMs : OPEN_READY_TIMEOUT_MS;
    const deadline = Date.now() + tmo;
    // loadFile 자체도 «영원히» 안 돌아올 수 있다(렌더러가 통째로 멈춘 경우) — 예산 안에서만 기다린다.
    const navTimedOut = Symbol('nav-timeout');
    let navTimer = null;
    const navResult = await Promise.race([
      mainWindow.loadFile('index.html', { query: { project: projectId } }).then(() => null),
      new Promise(r => { navTimer = setTimeout(() => r(navTimedOut), tmo); }),
    ]);
    if (navTimer) clearTimeout(navTimer);
    if (navResult === navTimedOut) {
      return {
        ok: false, code: 'load_timeout', projectId, previousProject, previousScreen,
        waitedMs: tmo, timeoutMs: tmo, stage: 'navigate',
        error: `프로젝트 창 이동이 ${tmo}ms 안에 끝나지 않았습니다 — 편집 도구를 쓰면 유실될 수 있습니다.`,
      };
    }
    // ⛔여기서 곧바로 ok 를 돌려주면 «조용한 데이터 유실»이다(위 _waitProjectReady 주석의 실측).
    //   렌더러가 「이 프로젝트를 적용했다」고 확정할 때까지 기다린다.
    const w = await _waitProjectReady(mainWindow.webContents, projectId, Math.max(0, deadline - Date.now()), prevDocOrigin);
    if (!w.ok) {
      // 「일단 ok」 금지 — 못 기다렸으면 못 기다렸다고 말한다.
      return {
        ok: false, code: w.code, projectId, previousProject, previousScreen,
        waitedMs: w.waitedMs, timeoutMs: tmo,
        error: w.code === 'load_timeout'
          ? `프로젝트가 ${tmo}ms 안에 열리지 않았습니다 — 편집 도구를 쓰면 유실될 수 있습니다.`
          : `프로젝트 열기 실패(${w.code})`,
        rendererState: w.state || null,
      };
    }
    // 호출자가 «무엇이 열렸는지» 대조할 수 있게 확인값을 싣는다(응답 ok 만 보고 넘어가지 않도록).
    return {
      ok: true, projectId, previousProject, previousScreen,
      activeProjectId: (w.state && w.state.urlProject) || projectId,
      ready: true, waitedMs: w.waitedMs,
      sections: (w.state && typeof w.state.sections === 'number') ? w.state.sections : null,
      loadDetail: (w.state && w.state.detail) || '',
    };
  } catch (e) {
    console.error('[projects:open] 예외:', e);
    return { ok: false, error: e.message || '알 수 없는 오류', code: 'io' };
  }
}

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
// Phase 3: 에러 분류 + non-ff push rebase 가드 (멀티맥 동시 push 경쟁 방지, force 절대 금지)
function _errCode(msg) {
  if (/non-fast-forward|fetch first|\[rejected\]|\bbehind\b/i.test(msg)) return 'conflict';
  if (/auth|login|denied|403|permission|could not read Username/i.test(msg)) return 'auth';
  if (/could not resolve host|network|timed out|connection|failed to connect/i.test(msg)) return 'network';
  return 'error';
}
function _errMsg(msg) {
  return ({ auth: 'GitHub 인증 필요 — 터미널에서 `gh auth login` 후 다시 시도하세요.',
            network: '네트워크 오류 — 연결을 확인하고 다시 시도하세요.',
            conflict: '원격에 더 새 버전이 있습니다. "목록 새로고침"으로 받은 뒤 다시 올리세요.' }[_errCode(msg)])
         || ('업로드 실패: ' + String(msg).slice(0, 200));
}
async function _pushWithRebase(dir) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await _execFileP('git', ['-C', dir, 'push', '-u', 'origin', 'main']); return { ok: true }; }
    catch (e) {
      const msg = String(e.message || '');
      if (attempt === 0 && _errCode(msg) === 'conflict') {
        // 원격이 앞섬 → fetch + rebase 후 1회 재시도. 다른 파일(다른 프로젝트)이면 rebase 통과.
        try {
          await _execFileP('git', ['-C', dir, 'fetch', 'origin', 'main']);
          await _execFileP('git', ['-C', dir, 'rebase', 'origin/main']);
        } catch (_re) {
          await _execFileP('git', ['-C', dir, 'rebase', '--abort']).catch(() => {});
          return { ok: false, code: 'conflict', message: '같은 프로젝트를 다른 맥이 먼저 올렸습니다. "목록 새로고침"으로 받은 뒤 다시 올리세요.' };
        }
        continue;   // 재시도
      }
      return { ok: false, code: _errCode(msg), message: _errMsg(msg) };
    }
  }
  return { ok: false, code: 'conflict', message: 'push 재시도 실패 — 먼저 받은 뒤 다시 올리세요.' };
}
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
    const pr = await _pushWithRebase(dir);   // Phase 3: non-ff면 fetch+rebase 후 재시도
    if (!pr.ok) return pr;
    return { ok: true, account: acc, id: pid, version };
  } catch (e) { return { ok: false, message: e.message }; }
});
ipcMain.handle('market:list', async () => {
  try { const dir = await _ensureMarketRepo(); return { ok: true, items: _rebuildMarketIndex(dir) }; }
  catch (e) { return { ok: false, code: _errCode(e.message), message: _errMsg(e.message) }; }
});
// Phase 3: gh 인증 선점검
ipcMain.handle('market:auth', async () => {
  try { await _execFileP('gh', ['auth', 'status']); return { ok: true }; }
  catch { return { ok: false, code: 'auth', message: 'GitHub 미인증 — 터미널에서 `gh auth login` 후 마켓을 사용하세요.' }; }
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

/* ── IPC: 원격 동시협업 ──
   구현은 main/collab/* 에 있다. 여기엔 «주입»만 둔다 — 협업이 커져도 main.js 가 안 붓게.
   ⚠️ sessionToken 은 이 클로저 밖으로 안 나간다(렌더러엔 collab:* 결과만 간다). */
require('./main/collab').init(ipcMain, {
  readAuth,
  readMeta: (id) => {
    try {
      const p = _resolveMetaJsonPath(id);
      if (!p || !fs.existsSync(p)) return {};
      return JSON.parse(fs.readFileSync(p, 'utf8')) || {};
    } catch (_) { return {}; }
  },
  writeMeta: (id, patch) => {
    // read-merge-write — 목록 캐시(name·thumbnail 등)를 날리지 않는다.
    const paths = _ensureNewLayoutPaths(id);
    let merged = {};
    try { if (fs.existsSync(paths.meta)) merged = JSON.parse(fs.readFileSync(paths.meta, 'utf8')) || {}; } catch (_) {}
    _atomicWriteFileSync(paths.meta, JSON.stringify({ ...merged, ...patch }, null, 2));
  },
});

/* ── IPC: 어드민(공지 작성·신고 열람) ──
   구현은 main/admin/* 에 있다. 여기엔 «주입»만 둔다(협업과 같은 꼴).
   ⚠️ sessionToken 은 이 클로저 밖으로 안 나간다 — 렌더러엔 admin:* 결과만 간다.
   ★권한은 서버가 지킨다(api/_lib/roles.js requireAdmin). 이 모듈의 role 판정은
     «환경설정에 공지 탭을 그릴까»를 정하는 힌트일 뿐이다. */
require('./main/admin').init(ipcMain, { readAuth });

/* ── IPC: 운영자 공지 ──
   구현은 main/notice/* 에 있다. 여기엔 «주입»만 둔다(collab 과 같은 규약).
   ⚠️ sessionToken 은 이 클로저 밖으로 안 나간다 — 공지 조회의 x-session-token 헤더는 main 에서만 붙는다. */
require('./main/notice').init(ipcMain, {
  userDataDir: USER_DATA_DIR,
  readAuth,
  getVersion: () => { try { return app.getVersion(); } catch (_) { return ''; } },
  getWindows: () => BrowserWindow.getAllWindows(),
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
    const filePath = path.join(INTAKE_DIR, _safeSeg(filename)); // GAP-009
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
  const filePath = path.join(PRESETS_DIR, `${_safeSeg(preset && preset.id)}.json`); // GAP-009
  fs.writeFileSync(filePath, JSON.stringify(preset, null, 2));
  return true;
});

ipcMain.handle('presets:delete', (event, presetId) => {
  const filePath = path.join(PRESETS_DIR, `${_safeSeg(presetId)}.json`); // GAP-009
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
        if (canvas) fs.writeFileSync(path.join(TEMPLATES_CANVAS_DIR, `${_safeSeg(meta.id)}.html`), canvas, 'utf8'); // GAP-009
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
  const filePath = path.join(TEMPLATES_CANVAS_DIR, `${_safeSeg(id)}.html`); // GAP-009
  if (!fs.existsSync(filePath)) return null;
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
});

ipcMain.handle('templates:save-canvas', (event, id, html) => {
  fs.writeFileSync(path.join(TEMPLATES_CANVAS_DIR, `${_safeSeg(id)}.html`), html, 'utf8'); // GAP-009
  return true;
});

ipcMain.handle('templates:delete-canvas', (event, id) => {
  const filePath = path.join(TEMPLATES_CANVAS_DIR, `${_safeSeg(id)}.html`); // GAP-009
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

/** electron-updater 가 쓰는 캐시 루트. 이름을 못 읽으면 null(= pending 정리 무동작).
 *  ⛔app.getName() 으로 «추측»하지 않는다 — 엉뚱한 디렉터리를 지우느니 아무것도 안 하는 게 낫다. */
function _updaterCacheDir() {
  try {
    return updaterCache.resolveUpdaterCacheDir({
      appUpdateConfigPath: app.isPackaged
        ? path.join(process.resourcesPath, 'app-update.yml')
        : path.join(app.getAppPath(), 'dev-app-update.yml'),
    });
  } catch (e) {
    console.warn('[updater-cache] 캐시 경로 해석 실패:', e.message);
    return null;
  }
}

/** ★설치가 «끝난 뒤» 남은 pending 페이로드를 지운다 — R1/A1.
 *  판정·근거는 main/updater-cache.js 머리주석 참조. 여기선 «언제 부르나»만 정한다:
 *  checkForUpdatesAndNotify() «앞». 뒤에 두면 방금 받은 pending 과 경합한다. */
function cleanSpentUpdaterPending() {
  const cacheDir = _updaterCacheDir();
  if (!cacheDir) { console.log('[updater-cache] updaterCacheDirName 없음 — 정리 건너뜀'); return; }
  try {
    updaterCache.cleanPendingIfSpent({
      cacheDir,
      currentVersion: app.getVersion(),
      logger: { info: (m) => console.log(m), warn: (m) => console.warn(m) },
    });
  } catch (e) {
    console.warn('[updater-cache] 정리 실패(무시하고 계속):', e.message);
  }
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  // 채널 분기: settings.betaChannel=true인 테스터만 pre-release 수신.
  // 일반 사용자(false)는 latest 정식만 → 미검증 빌드가 전파되지 않음.
  try {
    autoUpdater.allowPrerelease = !!readSettings().betaChannel;
    console.log('[updater] allowPrerelease =', autoUpdater.allowPrerelease);
  } catch (_) {}

  autoUpdater.on('update-available', (info) => {
    console.log('[updater] 새 버전 발견:', info.version);
  });

  autoUpdater.on('update-downloaded', (info) => {
    // 「이 pending 은 몇 버전인가」를 박아둔다 — 다음 실행의 정리 판정 «정본».
    // (파일명 파싱은 폴백일 뿐이다: arch 접미사·프리릴리즈를 파일명만으론 못 가른다.)
    try {
      const cacheDir = _updaterCacheDir();
      if (cacheDir) updaterCache.writePendingMarker({ cacheDir, version: info.version, fileName: info.downloadedFile ? path.basename(info.downloadedFile) : null });
    } catch (e) { console.warn('[updater-cache] 마커 기록 실패:', e.message); }

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

  // ★검사 «전»에 소진된 pending 을 비운다(뒤에 두면 갓 받은 페이로드와 경합).
  cleanSpentUpdaterPending();

  autoUpdater.checkForUpdatesAndNotify();
}

/* ── App lifecycle ── */
app.whenReady().then(async () => {
  // goya-asset:// 핸들러 — proj_<id>/assets/<file>을 디스크에서 직접 스트림.
  // path-traversal 가드(assets 루트 밖 거부). 브라우저가 캐시·lazy-load 담당 → JS heap에 base64 없음.
  protocol.handle('goya-asset', (request) => {
    try {
      const u = new URL(request.url); // goya-asset://<projectId>/<filename>
      const projectId = _safeSeg(decodeURIComponent(u.hostname || ''));
      const filename = _safeSeg(decodeURIComponent((u.pathname || '').replace(/^\/+/, '')));
      if (!projectId || !filename) return new Response('bad request', { status: 400 });
      const safeRoot = path.join(PROJECTS_DIR, projectId, 'assets');
      const full = path.join(safeRoot, filename);
      if (!full.startsWith(safeRoot + path.sep)) return new Response('forbidden', { status: 403 });
      if (!fs.existsSync(full)) return new Response('not found', { status: 404 });
      // 렌더러 Image()/lazy-load 는 이 스트림으로 동작. (단, file:// origin 렌더러의 fetch()는
      // Chromium이 커스텀 스킴 cross-origin을 하드 차단 → export HTML 재인라인은 fetch 대신
      // assets:readAsDataUri IPC를 사용한다. 아래 핸들러 참조.)
      return electronNet.fetch(require('url').pathToFileURL(full).toString());
    } catch (e) {
      return new Response('error: ' + (e && e.message), { status: 500 });
    }
  });

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

  // .gdt 내보내기 — IPC + 애플리케이션 메뉴.
  // ★메뉴는 이 앱에 원래 없어서 Electron 기본 메뉴가 ⌘C/⌘V를 대신하고 있었다.
  //   표준 role 템플릿 위에 「파일」을 얹는 방식이라 기본 편집 단축키가 유지된다.
  try {
    const { registerGdtIpc, buildAppMenu } = require('./main/gdt/wire');
    registerGdtIpc({ projectsDir: PROJECTS_DIR, resolveProjectJsonPath: _resolveProjectJsonPath });
    buildAppMenu();
  } catch (e) {
    console.error('[gdt] 초기화 실패 — 메뉴 없이 계속:', e);
  }

  createWindow();
  // watchFiles가 던져도 updater/MCP 초기화는 계속돼야 함 (0.5.0 자동업데이트 사망 원인)
  try { watchFiles(); } catch (e) { console.error('[hot-reload] watch skipped:', e.message); }
  // 개발 모드에서는 자동업데이트 스킵
  if (!process.argv.includes('--enable-logging')) {
    setupAutoUpdater();
  }
  // Claude PM MCP 서버 (포트 9345, port-status 표 9345+ 신규 자유)
  try {
    const { port: actualPort, token: mcpToken } = await startMcpServer({
      port: 9345,
      onActiveProject: () => global.currentActiveProjectId || null,
    });
    // EADDRINUSE fallback이 일어나도 ipc 핸들러가 올바른 포트로 ping
    setActualMcpPort(actualPort);
    // Unit B — 접속 토큰 보관(메모리). renderer 노출은 admin 게이팅 IPC로만.
    currentMcpToken = mcpToken || null;
    // Phase 2/3 — renderer write bridge 주입
    setMcpRendererInvoker({
      addTextBlock: _invokeRendererAddBlock,
      editTextBlock: _invokeRendererEditBlock,
      addSection: _invokeRendererAddSection,
      addAssetBlock: _invokeRendererAddAssetBlock,
      scratchAdd: _invokeRendererScratchAdd,
      buildBasicSection: _invokeRendererBuildBasicSection,
      getCanvasState: _invokeRendererGetCanvasState,
      listScratchItems: _invokeRendererListScratchItems,
      readScratchItem: _invokeRendererReadScratchItem,
      deleteScratchItem: _invokeRendererDeleteScratchItem,
      updateScratchItem: _invokeRendererUpdateScratchItem,
      addGapBlock: _invokeRendererAddGapBlock,
      deleteSection: _invokeRendererDeleteSection,
      deleteBlock: _invokeRendererDeleteBlock,
      moveSection: _invokeRendererMoveSection,
      moveBlock: _invokeRendererMoveBlock,
      insertGapAfterBlock: _invokeRendererInsertGapAfterBlock,
      updateSection: _invokeRendererUpdateSection,
      addTableBlock: _invokeRendererAddTableBlock,
      addCardBlock: _invokeRendererAddCardBlock,
      updateCardBlock: _invokeRendererUpdateCardBlock,
      addChecklistItem: _invokeRendererAddChecklistItem,
      setSectionMemo: _invokeRendererSetSectionMemo,
      getSectionMemo: _invokeRendererGetSectionMemo,
      updateChecklistItem: _invokeRendererUpdateChecklistItem,
      listChecklistItems: _invokeRendererListChecklistItems,
      deleteChecklistItem: _invokeRendererDeleteChecklistItem,
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
    // 프로젝트 단위 코어 주입 — MCP duplicate_project/create_project/open_project 도구가 사용.
    if (typeof setMcpProjectOps === 'function') {
      setMcpProjectOps({ duplicate: _duplicateProjectImpl, create: _createProjectImpl, open: _openProjectImpl });
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

// ─── move_block — 블록(비-섹션) 순서 재배치 ────────────────────────────────
// moveSection과 동일한 얇은 bridge 패턴. 실제 검증(section 여부 등)은 renderer의
// window.moveBlock 안에서 한 번 더 하지만, 여기서도 section-block을 조기 컷해
// "move_section을 대신 쓰라"는 에러를 IPC 왕복 전에 돌려준다.
async function _invokeRendererMoveBlock({ blockId, beforeId, afterId } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) throw new Error('renderer not ready');
  if (mainWindow.isMinimized()) return { ok: false, code: 'WINDOW_MINIMIZED' };
  const safeBid = JSON.stringify(String(blockId || ''));
  const safeB   = beforeId ? JSON.stringify(String(beforeId)) : 'null';
  const safeA   = afterId  ? JSON.stringify(String(afterId))  : 'null';
  return await mainWindow.webContents.executeJavaScript(
    `(() => { try {
      const bid = ${safeBid}, bId = ${safeB}, aId = ${safeA};
      const el = document.getElementById(bid);
      if (!el) return { ok:false, code:'NOT_FOUND', message:'block not found: '+bid };
      if (el.classList.contains('section-block')) return { ok:false, code:'IS_SECTION', message:'section은 move_section 사용' };
      if (bId && !document.getElementById(bId)) return { ok:false, code:'NOT_FOUND', message:'beforeId not found' };
      if (aId && !document.getElementById(aId)) return { ok:false, code:'NOT_FOUND', message:'afterId not found' };
      const result = window.moveBlock(bid, { beforeId: bId, afterId: aId });
      if (!result) return { ok:false, code:'MOVE_FAILED', blockId: bid, beforeId: bId, afterId: aId };
      return { ok:true, blockId: bid, movedUnitId: result.movedUnitId || bid, refUnitId: result.refUnitId || null, beforeId: bId, afterId: aId };
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

// ─── delete_scratch_item — 스크래치패드 아이템 삭제 ──────────────────────────
// list/read_scratch_item과 짝. 스크래치는 캔버스 undo history 밖(IndexedDB 별도)이라
// USER_BUSY류 동시편집 가드가 필요 없다(텍스트 인라인 편집 같은 충돌 대상이 아님).
async function _invokeRendererDeleteScratchItem({ id } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  const safeId = JSON.stringify(String(id || ''));
  return await mainWindow.webContents.executeJavaScript(
    `(typeof window._scratchDeleteForMcp === "function") ? window._scratchDeleteForMcp(${safeId}) : { ok:false, code:'API_MISSING' }`,
    true
  );
}

// ─── update_scratch_item — 스크래치패드 아이템 재배치(x/y/w) ────────────────
async function _invokeRendererUpdateScratchItem({ id, x, y, w } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  const safeId = JSON.stringify(String(id || ''));
  const safeOpts = JSON.stringify({
    x: typeof x === 'number' ? x : undefined,
    y: typeof y === 'number' ? y : undefined,
    w: typeof w === 'number' ? w : undefined,
  });
  return await mainWindow.webContents.executeJavaScript(
    `(typeof window._scratchUpdateForMcp === "function") ? window._scratchUpdateForMcp(${safeId}, ${safeOpts}) : { ok:false, code:'API_MISSING' }`,
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
/* MCP put_image — 이미지 바이트를 «스크래치»로 들여보내는 입구.
 * ★가드는 _invokeRendererAddAssetBlock 의 것을 «하나도 빼지 않고» 복제했다:
 *   renderer not ready · WINDOW_MINIMIZED · USER_BUSY(편집 중·최근 키입력 1.5초) · API_MISSING
 *   + 단일 atomic IIFE — 두 executeJavaScript 사이 race 차단
 *   ⚠️특히 USER_BUSY: 사람이 타이핑 중인데 이미지가 끼어들면 안 된다.
 * ★프로젝트 열림 확인과 «되읽기»는 렌더러 쪽(_scratchAddForMcp)에서 한다 —
 *   그 상태(_currentProjectId·_scratchItems)가 거기 있고, 왕복을 늘리지 않는다.
 */
async function _invokeRendererScratchAdd({ src, width } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeSrc   = JSON.stringify(String(src || ''));
  const safeWidth = width ? String(Number(width) || 0) : 'undefined';
  const atomicJs = `(async () => {
    try {
      const ae = document.activeElement;
      const userEditing = !!(ae && (
        ae.isContentEditable || ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA'
      ) && !(ae.closest && ae.closest('#claude-pm-terminal-panel, #claude-pm-terminal-mini, .xterm, .xterm-helper-textarea')));
      const recentKey = (Date.now() - (window._lastUserKeydown || 0)) < 1500;
      if (userEditing || recentKey) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 편집 중입니다. 잠시 후 다시 시도하세요.', retryAfter: 2000 };
      }
      if (typeof window._scratchAddForMcp !== 'function') {
        return { ok: false, code: 'API_MISSING', message: 'window._scratchAddForMcp not found' };
      }
      return await window._scratchAddForMcp(${safeSrc}, { width: ${safeWidth} });
    } catch (e) {
      return { ok: false, code: 'RENDERER_ERROR', message: String((e && e.message) || e) };
    }
  })()`;
  return await mainWindow.webContents.executeJavaScript(atomicJs, true);
}

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
      // sectionId 추가(2026-08-30): put_image 가 «어느 섹션에 붙었나»를 돌려줘야 하는데
      //   sectionId 생략 호출(활성 섹션 사용)에서는 호출자가 그걸 «알 방법이 없었다». 필드 추가만 — 기존 필드는 그대로.
      const secOf = lastNew?.closest('[id^="sec_"]')?.id || sid || null;
      return { ok: true, preset: ${safePreset}, assetBefore: before, assetAfter: after, assetBlockId: lastNew?.id || null, sectionId: secOf, hasImage: !!(lastNew?.querySelector('.asset-img')?.src || lastNew?.dataset?.imgSrc || (lastNew?.classList?.contains('asset-img') && lastNew?.src)) };
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

// ─── list_checklist_items — 체크리스트 전체(또는 필터) 조회 ─────────────────
// INV-B3 결손 #2 짝 — add/update만 있고 조회가 없던 것 해소. 순수 데이터 읽기라
// USER_BUSY 가드 불필요(인라인 편집 중이어도 목록 조회는 막을 이유 없음).
async function _invokeRendererListChecklistItems({ includeDone = true, sectionId } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  const safeOpts = JSON.stringify({ includeDone: includeDone !== false, sectionId: sectionId || null });
  return await mainWindow.webContents.executeJavaScript(
    `(() => { try {
      if (typeof window.listChecklistItems !== 'function') return { ok:false, code:'API_MISSING' };
      const items = window.listChecklistItems(${safeOpts});
      return { ok:true, items, count: items.length };
    } catch(e) { return { ok:false, code:'EXCEPTION', message:e.message }; } })()`,
    true
  );
}

// ─── delete_checklist_item — 체크리스트 항목 삭제 ────────────────────────────
// list와 짝. USER_BUSY 가드는 update_checklist_item과 동일(같은 인라인 편집 중 항목을
// 지우려는 race 방지) — 단, 편집 중인 항목이 삭제 대상과 다르면 막지 않는다.
async function _invokeRendererDeleteChecklistItem({ id } = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents) {
    throw new Error('renderer not ready');
  }
  if (mainWindow.isMinimized()) {
    return { ok: false, code: 'WINDOW_MINIMIZED', message: '창이 최소화 상태입니다.' };
  }
  const safeId = JSON.stringify(String(id || ''));
  return await mainWindow.webContents.executeJavaScript(
    `(() => { try {
      const id = ${safeId};
      const ae = document.activeElement;
      const editingHost = ae && ae.closest && ae.closest('.ck-item, .todo-pin-popup, .ck-inline-input');
      const editingId = editingHost && editingHost.dataset ? (editingHost.dataset.id || null) : null;
      if (editingId && editingId === id) {
        return { ok: false, code: 'USER_BUSY', message: '사용자가 이 항목을 편집 중입니다.', retryAfter: 2000 };
      }
      if (typeof window.deleteChecklistItem !== 'function') return { ok:false, code:'API_MISSING' };
      return window.deleteChecklistItem({ id });
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

/* ══════════════════════════════════════════════════════════════════════════
   [Unit B] 버그·피드백 신고 — IPC 3개 (2026-09-02)
   ──────────────────────────────────────────────────────────────────────────
   ★파일 «맨 끝»에 몰아 둔다: 같은 시각 다른 유닛(G3 공지·G4 어드민/단일실행)이
     main.js 를 동시에 고치고 있다. 한 덩어리로 모여 있어야 충돌 조정이 싸다.
   ★sessionToken 은 여기서만 붙는다 — 렌더러로 나가지 않는다(기존 원칙 유지).
══════════════════════════════════════════════════════════════════════════ */
const reportQueue = require('./main/report/queue');

let _reportQueueReady = false;
function ensureReportQueue() {
  if (_reportQueueReady) return;
  _reportQueueReady = true;
  reportQueue.init({
    userDataDir: app.getPath('userData'),
    apiBase: AUTH_API_BASE,
    // ★큐 파일엔 토큰을 적지 않는다. 보낼 때마다 «그 순간의» auth.json 을 읽는다
    //   ⇒ 로그아웃했다면 그 뒤 재시도는 자동으로 익명이 된다(유저렌즈 D-c).
    readAuth: () => {
      const a = readAuth();
      return a ? { email: a.email, sessionToken: a.sessionToken } : null;
    },
    log: (m) => console.warn(m),
  });
}
app.whenReady().then(() => {
  try {
    ensureReportQueue();
    // 켜질 때 한 번 — 지난번에 서버가 죽어 있어 남은 신고를 보낸다(유저렌즈 C-a).
    setTimeout(() => { reportQueue.flush().catch(() => {}); }, 5000);
  } catch (e) { console.warn('[report] 큐 초기화 실패:', e.message); }
});

/** 신고 창이 「함께 보내지는 것」에 적을 값 + 아직 못 보낸 건수. */
ipcMain.handle('report:context', () => {
  let queued = 0;
  try { ensureReportQueue(); queued = reportQueue.stats().size; } catch (_) {}
  return {
    appVersion: app.getVersion(),
    os: `${process.platform} ${require('os').release()}`,
    arch: process.arch,
    queued,
  };
});

/* 화면 캡처 — 1280px 축소 + JPEG. ★렌더러로 원본 PNG(수 MB)를 넘기지 않는다.
   축소를 메인에서 끝내야 IPC 도, 미리보기도, 전송 payload 도 같은 «한 장»이 된다. */
ipcMain.handle('report:capture', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return { ok: false, message: '창을 찾을 수 없습니다' };
    let img = await win.webContents.capturePage();
    if (!img || img.isEmpty()) return { ok: false, message: '빈 화면입니다' };
    const size = img.getSize();
    const longEdge = Math.max(size.width, size.height);
    if (longEdge > 1280) {
      img = size.width >= size.height ? img.resize({ width: 1280 }) : img.resize({ height: 1280 });
    }
    const out = img.getSize();
    return {
      ok: true,
      w: out.width,
      h: out.height,
      dataUrl: 'data:image/jpeg;base64,' + img.toJPEG(72).toString('base64'),
    };
  } catch (e) {
    return { ok: false, message: e.message };
  }
});

/* 신고 접수 — ★언제나 «큐에 먼저» 넣고 그다음에 보낸다.
   반대로 하면 전송 중 앱이 죽었을 때 아무 데도 안 남는다(PLAN §2⑸). */
ipcMain.handle('report:submit', async (_event, payload) => {
  try {
    ensureReportQueue();
    if (!payload || typeof payload.text !== 'string' || !payload.text.trim()) {
      return { ok: false, sent: false, queued: false, message: '내용을 적어 주세요.' };
    }
    const { dropped } = reportQueue.enqueue(payload);
    const r = await reportQueue.flush();
    return {
      ok: true,
      sent: r.sent > 0,
      queued: r.left > 0,
      left: r.left,
      dropped,                       // 상한 50 을 넘겨 «오래된» 것이 빠진 수
      message: r.sent > 0 ? (r.lastMessage || null) : (r.lastError || null),
    };
  } catch (e) {
    return { ok: false, sent: false, queued: false, message: e.message };
  }
});

/** 큐 상태 조회 — 검증·표시용(전송은 안 한다). */
ipcMain.handle('report:queue-stats', () => {
  try { ensureReportQueue(); return reportQueue.stats(); } catch (e) { return { size: 0, max: 50, error: e.message }; }
});
