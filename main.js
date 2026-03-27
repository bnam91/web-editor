const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const os = require('os');

// .env 로드 (크리덴셜 환경변수)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
}
const { spawn } = require('child_process');
const { getPublicIp, findUserByIp, registerLicense, removeIp, updateIpAlias, updateUserName, createLicenseKey, listLicenseKeys } = require('./services/licenseService');

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

  // 라이선스 체크 후 페이지 결정
  checkLicenseAndLoad();

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

/* ── IPC: Projects (파일 기반 저장소) ── */
const PROJECTS_DIR = path.join(__dirname, 'projects');
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

ipcMain.handle('projects:list', () => {
  return fs.readdirSync(PROJECTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf8'));
        return { id: data.id, name: data.name, createdAt: data.createdAt, updatedAt: data.updatedAt, thumbnail: data.thumbnail || null };
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
});

ipcMain.handle('projects:load', (event, id) => {
  const filePath = path.join(PROJECTS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
});

ipcMain.handle('projects:save', (event, project) => {
  const filePath = path.join(PROJECTS_DIR, `${project.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf8');
  return true;
});

ipcMain.handle('projects:delete', (event, id) => {
  const filePath = path.join(PROJECTS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  return true;
});

/* ── IPC: Presets ── */
ipcMain.handle('fullscreen:get', () => mainWindow?.isFullScreen() ?? false);

ipcMain.handle('presets:read-all', () => {
  const dir = path.join(__dirname, 'presets');
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
});

ipcMain.handle('presets:save', (event, preset) => {
  const filePath = path.join(__dirname, 'presets', `${preset.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(preset, null, 2));
  return true;
});

ipcMain.handle('presets:delete', (event, presetId) => {
  const filePath = path.join(__dirname, 'presets', `${presetId}.json`);
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
const TEMPLATES_DIR        = path.join(__dirname, 'templates');
const TEMPLATES_CANVAS_DIR = path.join(TEMPLATES_DIR, 'canvas');
const TEMPLATES_INDEX_FILE = path.join(TEMPLATES_DIR, 'index.json');
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
