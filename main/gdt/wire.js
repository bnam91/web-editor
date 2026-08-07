/* wire.js — .gdt 기능을 앱에 붙인다 (IPC · 애플리케이션 메뉴 · 진행률)
 *
 * ★메뉴가 이 앱엔 «원래 없었다»(Menu.buildFromTemplate 0건). 지금까지는 Electron 기본 메뉴가
 *   ⌘C/⌘V/⌘Z를 제공하고 있었다. 그래서 「파일 → 내보내기」를 붙이려고 메뉴를 통째로 갈면
 *   복사·붙여넣기가 죽는다. ⇒ 표준 role 템플릿을 «먼저» 깔고 그 위에 「파일」을 얹는다.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { app, Menu, dialog, ipcMain, BrowserWindow } = require('electron');
const { exportGdt } = require('./export');
const { importGdt } = require('./import');

// 파일명으로 못 쓰는 문자만 걷어낸다. 한글은 그대로 둔다(겉 이름은 사용자 것 — GDT-SPEC §1).
function safeFileName(name) {
  return String(name || 'project').replace(/[\/\\:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '_').slice(0, 120) || 'project';
}

/* ── 파일 연결 (.gdt 더블클릭) ──
 * ★맥과 윈도우가 «완전히 다른 경로»로 알려준다:
 *   맥   = `open-file` 이벤트. ready 이전에도 뜨므로 핸들러를 «top-level에» 걸어야 한다.
 *   윈도우 = 경로가 `process.argv`로 들어온다. 실행 중이면 «두 번째 인스턴스»의 argv라
 *           단일 인스턴스 잠금 + `second-instance` 이벤트로 받아야 한다.
 * ⇒ 「앱이 꺼진 상태」와 「켜진 상태」가 서로 다른 코드 경로다. 둘 다 큐로 모은다.
 */
/* ★슬롯 하나가 아니라 «큐»여야 한다.
 * 재현(2026-08-07): 파인더에서 .gdt 둘을 다중선택해 Enter 하면 open-file 이 창보다 «먼저»
 *   연달아 두 번 뜬다. 슬롯 하나면 뒤엣것이 앞엣것을 덮어 «A 가 조용히 사라진다».
 *   윈도우도 같다 — argv 에 두 경로가 실려 오는데 첫 번째만 집으면 B 가 사라진다.
 *   id 충돌이 아니라 «사용자가 더블클릭한 파일이 아무 말 없이 안 열리는» 문제라 더 나쁘다.
 */
const _pendingOpenPaths = [];
const MAX_PENDING = 20;      // 다중선택이라도 이 이상은 실수다

function _queue(p) {
  if (!p || _pendingOpenPaths.includes(p)) return;   // 같은 파일 두 번은 한 번으로
  if (_pendingOpenPaths.length >= MAX_PENDING) {
    console.warn(`[gdt] 대기열이 가득 차 무시: ${p}`);
    return;
  }
  _pendingOpenPaths.push(p);
}

/** argv 에서 «모든» .gdt 경로를 집는다. */
function _gdtPathsFromArgv(argv) {
  const out = [];
  for (const a of argv || []) {
    if (typeof a !== 'string' || !a.toLowerCase().endsWith('.gdt')) continue;
    if (fs.existsSync(a)) { out.push(a); continue; }
    // ★.gdt처럼 생겼는데 파일이 없다 — 네트워크 드라이브 미마운트·권한 등.
    //   넘기지는 않는다(존재하지 않는 경로를 넘기면 더 나쁜 실패가 난다).
    //   다만 «조용히» 사라지면 원인을 못 찾으므로 로그는 남긴다.
    console.warn(`[gdt] argv의 .gdt 경로에 접근할 수 없어 무시: ${a}`);
  }
  return out;
}
// 기존 계약 유지(첫 경로 또는 null) — 두장 검증 스크립트가 이 형태를 쓴다
function _gdtPathFromArgv(argv) { return _gdtPathsFromArgv(argv)[0] || null; }

function _deliver(p) {
  if (!p) return;
  const win = BrowserWindow.getAllWindows()[0];
  if (win && !win.isDestroyed() && !win.webContents.isLoading()) {
    if (win.isMinimized()) win.restore();
    win.focus();
    win.webContents.send('gdt:open-file', p);
  } else {
    // 창이 아직 없다(콜드 스타트). 렌더러가 준비되면 «가져간다» — push는 경합에 진다.
    _queue(p);
  }
}
function _deliverAll(paths) { for (const p of paths) _deliver(p); }

/* ★app ready «이전»에 불러야 한다 — 맥 open-file은 ready 전에도 뜬다. */
function registerGdtFileAssociations() {
  // 맥: 꺼진 상태·켜진 상태 모두 이 이벤트로 온다
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    _deliver(filePath);
  });

  // 윈도우: 실행 중이면 두 번째 인스턴스의 argv로 온다.
  // ★잠금은 «패키지 빌드에서만» 건다 — dev:step2~dev:admin 병렬 인스턴스와
  //   layout-orchestrator의 격리 인스턴스가 한 창으로 접히는 걸 막기 위해서다.
  if (app.isPackaged) {
    // ★app.quit()가 아니라 exit(0) — quit()은 «비동기»라 그 뒤로 main.js가 계속 실행돼
    //   두 번째 인스턴스가 창을 띄우거나 마이그레이터를 도는 사이 경합이 난다.
    //   이 인스턴스는 아직 아무것도 안 했으므로 즉시 끊는 게 안전하다.
    if (!app.requestSingleInstanceLock()) { app.exit(0); return; }
    app.on('second-instance', (_e, argv) => _deliverAll(_gdtPathsFromArgv(argv)));
  }

  // 콜드 스타트(윈도우): 최초 argv에 «여러» 경로가 실려 올 수 있다(다중선택)
  for (const p of _gdtPathsFromArgv(process.argv.slice(1))) _queue(p);
}

function registerGdtIpc({ projectsDir, resolveProjectJsonPath }) {
  // 렌더러가 준비된 뒤 «가져간다». push 방식은 렌더러가 리스너를 걸기 전에 도착하면 유실된다.
  ipcMain.handle('gdt:takePendingOpen', () => {
    // ★배열로 «전부» 넘기고 비운다. 하나씩 주면 렌더러가 나머지를 못 가져간다.
    const all = _pendingOpenPaths.slice();
    _pendingOpenPaths.length = 0;
    return all;
  });

  ipcMain.handle('gdt:export', async (event, { projectId, projectName } = {}) => {
    try {
      if (!projectId) return { ok: false, error: 'projectId 필수' };
      const src = resolveProjectJsonPath(projectId);
      if (!src || !fs.existsSync(src)) return { ok: false, error: `프로젝트 파일을 찾을 수 없습니다 (${projectId})` };

      const win = BrowserWindow.fromWebContents(event.sender);
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: '프로젝트 내보내기',
        defaultPath: path.join(app.getPath('documents'), `${safeFileName(projectName || projectId)}.gdt`),
        filters: [{ name: 'GODITOR 프로젝트', extensions: ['gdt'] }],
        properties: ['createDirectory'],
      });
      if (canceled || !filePath) return { ok: false, canceled: true };

      // 진행률 — 렌더러가 ipcRenderer.on('gdt:progress')로 받는다. 60fps로 쏘지 않도록 솎는다.
      let lastSent = 0;
      const onProgress = (p) => {
        const now = Date.now();
        if (p.phase !== 'scan' || now - lastSent > 100) {
          lastSent = now;
          if (!win.isDestroyed()) win.webContents.send('gdt:progress', p);
        }
      };

      const result = await exportGdt({
        srcProjJson: src,
        outPath: filePath,
        meta: { name: projectName || projectId, sourceId: projectId, appVersion: app.getVersion() },
        onProgress,
      });
      return result;
    } catch (e) {
      return { ok: false, error: (e && e.message) || String(e) };
    }
  });

  // ── 불러오기 ──
  // filePath가 오면 그걸 쓰고(파일 연결·드래그 대비), 없으면 열기 대화상자를 띄운다.
  ipcMain.handle('gdt:import', async (event, { filePath } = {}) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      let src = filePath;
      if (!src) {
        const { canceled, filePaths } = await dialog.showOpenDialog(win, {
          title: '프로젝트 불러오기',
          filters: [{ name: 'GODITOR 프로젝트', extensions: ['gdt'] }],
          properties: ['openFile'],
        });
        if (canceled || !filePaths?.length) return { ok: false, canceled: true };
        src = filePaths[0];
      }

      let lastSent = 0;
      const onProgress = (p) => {
        const now = Date.now();
        if (p.phase !== 'restore' || now - lastSent > 100) {
          lastSent = now;
          if (win && !win.isDestroyed()) win.webContents.send('gdt:progress', p);
        }
      };

      return await importGdt({ gdtPath: src, projectsDir, onProgress });
    } catch (e) {
      return { ok: false, error: (e && e.message) || String(e) };
    }
  });
}

/* ── 애플리케이션 메뉴 ──
 * 표준 role을 전부 유지한 위에 「파일」만 추가한다. role 기반이라 ⌘C/⌘V/⌘Z가 살아 있다.
 */
function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  const sendToFocused = (channel) => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
    if (win && !win.isDestroyed()) win.webContents.send(channel);
  };

  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about', label: `${app.name} 정보` },
        { type: 'separator' },
        { role: 'services', label: '서비스' },
        { type: 'separator' },
        { role: 'hide', label: `${app.name} 가리기` },
        { role: 'hideOthers', label: '다른 항목 가리기' },
        { role: 'unhide', label: '모두 보기' },
        { type: 'separator' },
        { role: 'quit', label: `${app.name} 종료` },
      ],
    }] : []),
    {
      label: '파일',
      submenu: [
        { label: '프로젝트 불러오기…', accelerator: 'CmdOrCtrl+Shift+O', click: () => sendToFocused('gdt:menu-import') },
        { label: '프로젝트 내보내기…', accelerator: 'CmdOrCtrl+Shift+E', click: () => sendToFocused('gdt:menu-export') },
        { type: 'separator' },
        isMac ? { role: 'close', label: '창 닫기' } : { role: 'quit', label: '종료' },
      ],
    },
    {
      label: '편집',
      submenu: [
        { role: 'undo', label: '실행 취소' },
        { role: 'redo', label: '다시 실행' },
        { type: 'separator' },
        { role: 'cut', label: '오려두기' },
        { role: 'copy', label: '복사' },
        { role: 'paste', label: '붙여넣기' },
        ...(isMac ? [{ role: 'pasteAndMatchStyle', label: '스타일 맞춰 붙여넣기' }] : []),
        { role: 'delete', label: '삭제' },
        { role: 'selectAll', label: '전체 선택' },
      ],
    },
    {
      label: '보기',
      submenu: [
        { role: 'reload', label: '새로고침' },
        { role: 'forceReload', label: '강제 새로고침' },
        { role: 'toggleDevTools', label: '개발자 도구' },
        { type: 'separator' },
        { role: 'resetZoom', label: '실제 크기' },
        { role: 'zoomIn', label: '확대' },
        { role: 'zoomOut', label: '축소' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '전체 화면' },
      ],
    },
    {
      label: '창',
      submenu: [
        { role: 'minimize', label: '최소화' },
        ...(isMac
          ? [{ role: 'zoom', label: '확대/축소' }, { type: 'separator' }, { role: 'front', label: '모두 앞으로 가져오기' }]
          : [{ role: 'close', label: '닫기' }]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

module.exports = {
  registerGdtIpc, registerGdtFileAssociations, buildAppMenu, safeFileName,
  // 테스트용 — 파일 연결 경로는 GUI 더블클릭 없이는 재현이 어려워 상태를 들여다볼 창구를 둔다
  _gdtPathFromArgv, _gdtPathsFromArgv, getPendingOpenPath: () => _pendingOpenPaths.slice(),
};
