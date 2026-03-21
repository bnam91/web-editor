const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('pages/projects.html');

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
ipcMain.handle('figma:upload', (event, { channel, designJSON }) => {
  const tmpPath = path.join(os.tmpdir(), `sangpe_export_${Date.now()}.json`);
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(designJSON, null, 2), 'utf8');
    const scriptPath = path.join(__dirname, 'figma-renderer', 'sangpe_to_figma.mjs');
    const result = spawnSync('node', [scriptPath, channel, tmpPath], {
      encoding: 'utf-8',
      timeout: 120000,
    });
    fs.unlinkSync(tmpPath);
    if (result.error) throw result.error;
    const logs = (result.stdout || '') + (result.stderr || '');
    const success = result.status === 0;
    return { success, logs };
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch {}
    return { success: false, logs: err.message };
  }
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

/* ── IPC: Navigation (추후 구현) ── */
// ipcMain.handle('navigate', (event, page) => {
//   const pages = {
//     login:    'pages/login.html',
//     projects: 'pages/projects.html',
//     editor:   'index.html',
//   };
//   if (pages[page]) mainWindow.loadFile(pages[page]);
// });

/* ── App lifecycle ── */
app.whenReady().then(() => {
  createWindow();
  watchFiles();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
