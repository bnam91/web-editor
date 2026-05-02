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
const { fillSectionTexts: aiFillSectionTexts } = require('./services/geminiService');

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
  const windowTitle = gitBranch ? `상페마법사 [${gitBranch}]` : '상페마법사';
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

ipcMain.handle('projects:list', () => {
  const items = fs.readdirSync(PROJECTS_DIR)
    .filter(f => /^proj_\d+\.json$/.test(f))
    .map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf8'));
        if (!data.id || data.id === 'undefined') return null;
        // thumbnail은 _meta.json에서 우선 조회, 없으면 proj.json 폴백 (마이그레이션 전 하위 호환)
        let thumbnail = data.thumbnail || null;
        const metaPath = path.join(PROJECTS_DIR, `${data.id}_meta.json`);
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if (meta.thumbnail) thumbnail = meta.thumbnail;
          } catch {}
        }
        return { id: data.id, name: data.name, type: data.type || null, createdAt: data.createdAt, updatedAt: data.updatedAt, thumbnail };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  // 같은 ID 중복 제거 — updatedAt 최신 것만 유지 (정렬 후 첫 번째)
  const seen = new Set();
  return items.filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
});

ipcMain.handle('projects:load', (event, id) => {
  const filePath = path.join(PROJECTS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
});

ipcMain.handle('projects:save', (event, project) => {
  const filePath = path.join(PROJECTS_DIR, `${project.id}.json`);

  // 기존 파일보다 페이지 수가 줄어들면 저장 거부 (오염된 상태가 덮어쓰는 것 방지)
  if (fs.existsSync(filePath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const existingPages = existing.version === 2 ? (existing.pages?.length || 0) : 1;
      const newPages = project.version === 2 ? (project.pages?.length || 0) : 1;
      if (newPages < existingPages) {
        console.warn(`[projects:save] 페이지 수 감소 감지 (${existingPages} → ${newPages}), 저장 거부: ${project.id}`);
        return { ok: false, reason: 'page_count_reduced', existing: existingPages, incoming: newPages };
      }
      // 롤링 백업: 정상 저장 전 직전 버전 보존
      const backupPath = path.join(PROJECTS_DIR, `${project.id}_backup.json`);
      fs.copyFileSync(filePath, backupPath);
    } catch {}
  }

  fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf8');
  return { ok: true };
});

ipcMain.handle('projects:delete', (event, id) => {
  const filePath = path.join(PROJECTS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  // _meta.json도 함께 삭제
  const metaPath = path.join(PROJECTS_DIR, `${id}_meta.json`);
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  return true;
});

/* ── IPC: Projects Meta (branches/commits/thumbnail 분리 저장) ── */
ipcMain.handle('projects:save-meta', (event, projectId, metaData) => {
  const filePath = path.join(PROJECTS_DIR, `${projectId}_meta.json`);
  fs.writeFileSync(filePath, JSON.stringify(metaData, null, 2), 'utf8');
  return { ok: true };
});

ipcMain.handle('projects:load-meta', (event, projectId) => {
  const filePath = path.join(PROJECTS_DIR, `${projectId}_meta.json`);
  if (!fs.existsSync(filePath)) return null;
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

ipcMain.handle('figma-bridge-start', async () => {
  if (figmaBridgeProc) return { ok: true, msg: '이미 실행 중' };
  const bunPath = os.homedir() + '/.bun/bin/bun';
  figmaBridgeProc = spawn(bunPath, ['figma-plugin/socket.js'], {
    cwd: path.join(__dirname),
    detached: false,
    stdio: 'ignore'
  });
  figmaBridgeProc.on('exit', () => { figmaBridgeProc = null; });
  await new Promise(r => setTimeout(r, 1500));
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
app.whenReady().then(() => {
  createWindow();
  watchFiles();
  // 개발 모드에서는 자동업데이트 스킵
  if (!process.argv.includes('--enable-logging')) {
    setupAutoUpdater();
  }
});

/* ── 종료 전 강제 저장 ── */
app.on('before-quit', (event) => {
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
