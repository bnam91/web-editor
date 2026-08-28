/* _ipc-harness.js — main.js 의 «진짜» IPC 핸들러를 node 에서 직접 부르기 위한 electron 스텁.
 * (파일명이 _ 로 시작해 `node --test "tests/unit/*.test.js"` 글롭에 안 걸린다 — 테스트가 아니라 도구다.)
 *
 * ★왜 필요한가: 핸들러를 «흉내낸» 테스트는 핸들러가 아니라 내 흉내를 검증한다. 배선 오류·인자 오타·
 *   경로 조립 실수는 그런 테스트를 전부 통과한다. 진짜 핸들러를 부르면 그게 안 통한다.
 * ⚠️ main.js 는 프로세스당 한 번만 적재된다(모듈 싱글턴). node --test 는 파일마다 프로세스를 나누므로
 *   테스트 «파일» 하나당 하네스 하나가 원칙이다.
 * ⚠️ userData 는 임시 디렉터리로 강제한다 — 라이브 ~/Library/Application Support/GODITOR 무접촉.
 */
'use strict';
const Module = require('module');
const path = require('path');
const fs = require('fs');
const os = require('os');

/** @param {{userData?:string}} [opts] userData 를 주면 그 디렉터리를 재사용한다 — «앱 재기동» 재현용. */
function loadMain(opts) {
  const userData = (opts && opts.userData) || fs.mkdtempSync(path.join(os.tmpdir(), 'goya-ipc-'));
  fs.mkdirSync(userData, { recursive: true });
  const handlers = new Map(), syncHandlers = new Map(), sent = [];
  const noop = () => {};
  const webContents = { on: noop, send: (ch, p) => sent.push({ ch, p }), session: {}, id: 1 };
  const stub = {
    app: {
      whenReady: () => new Promise(() => {}), on: noop, once: noop, getPath: () => userData,
      getName: () => 'GODITOR', getVersion: () => '0.0.0-test', setAsDefaultProtocolClient: noop,
      quit: noop, exit: noop, isPackaged: false, requestSingleInstanceLock: () => true,
      commandLine: { appendSwitch: noop }, setAboutPanelOptions: noop, dock: { setIcon: noop },
      relaunch: noop, getLoginItemSettings: () => ({}), setLoginItemSettings: noop,
    },
    BrowserWindow: Object.assign(
      function () { return { loadFile: noop, loadURL: noop, on: noop, once: noop, webContents, show: noop, focus: noop, isDestroyed: () => false, close: noop }; },
      { getAllWindows: () => [], fromWebContents: () => null, getFocusedWindow: () => null }),
    ipcMain: { handle: (c, f) => handlers.set(c, f), on: (c, f) => syncHandlers.set(c, f), removeHandler: (c) => handlers.delete(c), handleOnce: (c, f) => handlers.set(c, f), removeAllListeners: noop },
    dialog: { showOpenDialog: async () => ({ canceled: true }), showSaveDialog: async () => ({ canceled: true }), showMessageBox: async () => ({ response: 0 }), showErrorBox: noop },
    /* ★shell.trashItem 을 «진짜로 옮기게» 만든다 — no-op 스텁이면 「휴지통에 갔나」를 못 재고,
     *   삭제 자체가 안 일어나 다른 테스트의 전제까지 무너진다(실제로 U5-2·RS1 이 그렇게 깨졌다).
     *   userData/_Trash 로 옮기고, 테스트는 거기서 «되살려» 왕복까지 잴 수 있다. */
    shell: {
      openExternal: noop, openPath: noop, showItemInFolder: noop,
      trashItem: async (p) => {
        if (stub.__trashFails) throw new Error(stub.__trashFails);
        const dest = path.join(userData, '_Trash', path.basename(p) + '.' + Date.now());
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.renameSync(p, dest);
      },
    },
    protocol: { handle: noop, registerSchemesAsPrivileged: noop, registerFileProtocol: noop },
    net: { fetch: async () => ({ ok: false, status: 0 }) },
    Menu: { buildFromTemplate: () => ({ popup: noop }), setApplicationMenu: noop },
    MenuItem: function () {},
    nativeImage: { createFromPath: () => ({ isEmpty: () => true }), createEmpty: () => ({}) },
    clipboard: { writeText: noop, readText: () => '' },
    screen: { getPrimaryDisplay: () => ({ workAreaSize: { width: 1920, height: 1080 } }), on: noop },
    powerSaveBlocker: { start: () => 1, stop: noop },
    session: { defaultSession: { webRequest: { onBeforeSendHeaders: noop, onHeadersReceived: noop }, setPermissionRequestHandler: noop, clearCache: async () => {} } },
    globalShortcut: { register: () => true, unregisterAll: noop },
  };
  const FAKE = {
    electron: stub,
    'electron-updater': { autoUpdater: { on: noop, checkForUpdates: async () => null, checkForUpdatesAndNotify: async () => null, setFeedURL: noop, downloadUpdate: async () => [], quitAndInstall: noop, logger: null, autoDownload: false, allowPrerelease: false, channel: null, currentVersion: { version: '0.0.0' } } },
    'electron-log': Object.assign(function () {}, { transports: { file: { level: 'info' }, console: { level: 'info' } }, info: noop, warn: noop, error: noop, debug: noop, verbose: noop, silly: noop, log: noop, scope: () => ({ info: noop, warn: noop, error: noop, debug: noop }) }),
  };
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (req, ...a) { return FAKE[req] ? req : origResolve.call(this, req, ...a); };
  for (const k of Object.keys(FAKE)) require.cache[k] = { id: k, filename: k, loaded: true, exports: FAKE[k] };
  process.on('unhandledRejection', () => {}); // app.whenReady() 가 영원히 pending 인 건 의도된 것

  require(path.join(__dirname, '../../main.js'));

  const projectsDir = path.join(userData, 'projects');
  fs.mkdirSync(projectsDir, { recursive: true });
  return {
    userData, projectsDir, sent,
    trashDir: path.join(userData, '_Trash'),
    /** 휴지통 이동을 강제 실패시킨다(음성대조용). 인자 없이 부르면 해제. */
    failTrash: (msg) => { stub.__trashFails = msg || null; },
    /** 휴지통에서 «되살린다» — 왕복 검증용. */
    restoreFromTrash: (entryName, toName) => {
      const from = path.join(userData, '_Trash', entryName);
      const to = path.join(projectsDir, toName);
      fs.renameSync(from, to);
      return to;
    },
    /** 진짜 핸들러를 부른다. 채널이 없으면 즉시 실패시킨다(오타가 조용히 통과하지 않게).
     * ★인자는 «전부» 넘긴다 — 초판이 하나만 넘겨서 projects:delete(id, opts) 의 opts 가 조용히 사라졌다.
     *   그러면 「두 번째 인자를 보는 분기」가 테스트에서 영원히 안 돈다. */
    invoke: (channel, ...args) => {
      const h = handlers.get(channel);
      if (!h) throw new Error(`IPC 채널 없음: ${channel}`);
      return h({ sender: webContents }, ...args);
    },
    has: (channel) => handlers.has(channel),
    channels: () => [...handlers.keys()],
  };
}

module.exports = { loadMain };
