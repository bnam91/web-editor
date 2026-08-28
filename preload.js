const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Projects (파일 기반)
  listProjects:   ()        => ipcRenderer.invoke('projects:list'),
  // opts.open=true → «프로젝트를 연다»는 로드(열 때 외부화 정책이 여기서만 돈다). 저장 경로의 병합용 로드는 opts 없이.
  loadProject:    (id, opts) => ipcRenderer.invoke('projects:load', id, opts),
  saveProject:    (project) => ipcRenderer.invoke('projects:save', project),
  // BUG-44: beforeunload용 동기 저장 — async를 await할 수 없는 새로고침/탭닫기 시점에 호출
  saveProjectSync:(project) => ipcRenderer.sendSync('projects:save-sync', project),
  // [U7] 삭제 = «휴지통으로 이동»이 기본. permanent:true 는 휴지통이 실패해 사용자가 «2차 확인으로 선택»했을 때만.
  //   반환은 { ok, trashed, reason } — 「지웠나」와 「휴지통이냐 영구냐」를 구분한다(구 boolean 은 못 나눴다).
  deleteProject:  (id, opts) => ipcRenderer.invoke('projects:delete', id, opts || {}),
  duplicateProject: ({ sourceProjectId, newName }) =>
    ipcRenderer.invoke('projects:duplicate', { sourceProjectId, newName }),

  // SVG Presets (사용자 자산 — 모든 프로젝트 공유)
  svgPresets: {
    list:           ()                           => ipcRenderer.invoke('svgPresets:list'),
    read:           ({ category, file })         => ipcRenderer.invoke('svgPresets:read',   { category, file }),
    save:           ({ category, name, svg })    => ipcRenderer.invoke('svgPresets:save',   { category, name, svg }),
    delete:         ({ category, file })         => ipcRenderer.invoke('svgPresets:delete', { category, file }),
    createCategory: ({ name })                   => ipcRenderer.invoke('svgPresets:createCategory', { name }),
  },

  // Projects Meta — branches/commits/thumbnail 분리 저장
  saveProjectMeta: (projectId, metaData) => ipcRenderer.invoke('projects:save-meta', projectId, metaData),
  loadProjectMeta: (projectId)           => ipcRenderer.invoke('projects:load-meta', projectId),

  // Presets
  readPresets:  ()         => ipcRenderer.invoke('presets:read-all'),
  savePreset:   (preset)   => ipcRenderer.invoke('presets:save', preset),
  deletePreset: (presetId) => ipcRenderer.invoke('presets:delete', presetId),

  // Navigation — 추후 로그인/프로젝트 페이지 구현 시 사용
  // navigate: (page) => ipcRenderer.invoke('navigate', page),

  // Templates
  loadTemplateIndex:   ()         => ipcRenderer.invoke('templates:load-index'),
  saveTemplateIndex:   (arr)      => ipcRenderer.invoke('templates:save-index', arr),
  loadTemplateCanvas:  (id)       => ipcRenderer.invoke('templates:load-canvas', id),
  saveTemplateCanvas:  (id, html) => ipcRenderer.invoke('templates:save-canvas', id, html),
  deleteTemplateCanvas:(id)       => ipcRenderer.invoke('templates:delete-canvas', id),

  // Figma Upload
  figmaUpload:       (channel, designJSON) => ipcRenderer.invoke('figma:upload', { channel, designJSON }),
  figmaCancelUpload: ()                    => ipcRenderer.invoke('figma:cancel-upload'),
  readNodeMap:       ()                    => ipcRenderer.invoke('figma:read-node-map'),
  writeNodeMap:      (nodeMap)             => ipcRenderer.invoke('figma:write-node-map', nodeMap),

  // Fullscreen
  getFullscreen: () => ipcRenderer.invoke('fullscreen:get'),
  onFullscreenChange: (cb) => ipcRenderer.on('fullscreen-change', (_e, val) => cb(val)),

  // Marketplace (bnam91/goditor-market)
  market: {
    push: (payload) => ipcRenderer.invoke('market:push', payload),
    list: ()        => ipcRenderer.invoke('market:list'),
    pull: (payload) => ipcRenderer.invoke('market:pull', payload),
    auth: ()        => ipcRenderer.invoke('market:auth'),
  },

  // 원격 동시협업 (main/collab/*). ★네트워크·sessionToken 은 main 에만 있다 —
  // 렌더러는 여기 열린 문으로만 말한다(CSP·토큰 격리).
  collab: {
    ref:      (payload) => ipcRenderer.invoke('collab:ref',      payload),
    seq:      (payload) => ipcRenderer.invoke('collab:seq',      payload),
    register: (payload) => ipcRenderer.invoke('collab:register', payload),
    leave:    (payload) => ipcRenderer.invoke('collab:leave',    payload),
    invite:   (payload) => ipcRenderer.invoke('collab:invite',   payload),
    invites:  (payload) => ipcRenderer.invoke('collab:invites',  payload),
    respond:  (payload) => ipcRenderer.invoke('collab:respond',  payload),
    push:     (payload) => ipcRenderer.invoke('collab:push',     payload),
    pull:     (payload) => ipcRenderer.invoke('collab:pull',     payload),
  },

  // Account auth (라이선스 키 제도 폐지 → 홈페이지 계정 로그인)
  getAuthState:       ()                   => ipcRenderer.invoke('auth:state'),
  refreshAuth:        ()                   => ipcRenderer.invoke('auth:refresh'),
  authLogin:          (email, password)    => ipcRenderer.invoke('auth:login', email, password),
  authLogout:         ()                   => ipcRenderer.invoke('auth:logout'),
  openExternalUrl:    (url)                => ipcRenderer.invoke('auth:open-external', url),
  navigateToProjects: ()                   => ipcRenderer.invoke('license:navigate-projects'),

  // AI section text fill (Gemini)
  aiFillSectionTexts: (payload) => ipcRenderer.invoke('ai:fillSectionTexts', payload),

  // AI 이미지 생성 (Nano Banana · gpt-image-1) + 디스크 저장/조회/삭제
  aiGenerateImage: (payload)                  => ipcRenderer.invoke('ai:generateImage', payload),
  aiSaveImage:     ({ projectId, b64, mime }) => ipcRenderer.invoke('ai:saveImage',   { projectId, b64, mime }),
  aiReadImage:     ({ projectId, blobPath })  => ipcRenderer.invoke('ai:readImage',   { projectId, blobPath }),
  aiDeleteImage:   ({ projectId, blobPath })  => ipcRenderer.invoke('ai:deleteImage', { projectId, blobPath }),

  // Assets 트리 — 디스크 분리 (project/<id>/assets/ast_xxx.<ext>)
  assetsSaveFile:   ({ projectId, b64, mime, originalName }) => ipcRenderer.invoke('assets:saveFile',   { projectId, b64, mime, originalName }),
  assetsReadFile:   ({ projectId, blobPath })                => ipcRenderer.invoke('assets:readFile',   { projectId, blobPath }),
  assetsDeleteFile: ({ projectId, blobPath })                => ipcRenderer.invoke('assets:deleteFile', { projectId, blobPath }),
  // 캔버스 이미지 외부화 — content-hash dedup 저장, goya-asset:// URL 반환
  assetsSaveCanvasImage: ({ projectId, b64, mime })          => ipcRenderer.invoke('assets:saveCanvasImage', { projectId, b64, mime }),
  assetsReadAsDataUri:   ({ projectId, filename })           => ipcRenderer.invoke('assets:readAsDataUri', { projectId, filename }),
  // [externalize] 일괄 외부화 — 수동 변환 / 되돌리기 / 상태조회 + 열 때 알림(이벤트)
  externalizeProject:     ({ projectId, force }) => ipcRenderer.invoke('projects:externalize', { projectId, force: force === true }),
  externalizeRollback:    ({ projectId, dryRun } = {}) => ipcRenderer.invoke('projects:externalize-rollback', { projectId, dryRun: dryRun === true }),
  externalizeScan:        ({ projectId }) => ipcRenderer.invoke('projects:externalize-scan', { projectId }),
  onProjectExternalized:  (cb) => ipcRenderer.on('projects:externalized', (_e, p) => cb(p)),
  onExternalizeHint:      (cb) => ipcRenderer.on('projects:externalize-hint', (_e, p) => cb(p)),

  // [version-history] 버전 기록 — ★읽기 전용 3채널. 되돌리기·사본생성은 아직 노출하지 않는다.
  historyList:        ({ projectId })      => ipcRenderer.invoke('projects:history-list', { projectId }),
  historyRead:        ({ projectId, ts })  => ipcRenderer.invoke('projects:history-read', { projectId, ts }),
  historyDiffPayload: ({ projectId, ts })  => ipcRenderer.invoke('projects:history-diff-payload', { projectId, ts }),
  // 사본으로 열기 — 비파괴(새 프로젝트를 만들 뿐 기존 것을 안 건드린다). 되돌리기(파괴)는 아직 없다.
  historyOpenCopy:    ({ projectId, ts, newName }) => ipcRenderer.invoke('projects:history-open-copy', { projectId, ts, newName }),
  // ★파괴 경로 — 「이 버전으로 교체」. openProjectIds 는 «이 창이 연 탭 목록»이다.
  //   안 넘기면 main 이 «판별 불가»로 보고 거부한다(다른 창에서 열려 있을 수 있으므로).
  historyRestore:     ({ projectId, ts, openProjectIds, activeProjectId, currentData }) =>
    ipcRenderer.invoke('projects:history-restore', { projectId, ts, openProjectIds, activeProjectId, currentData }),

  // 사용자별 Preferences (API 키 + 단축키)
  getSettings:  ()              => ipcRenderer.invoke('settings:get'),
  setSettings:  (patch)         => ipcRenderer.invoke('settings:set', patch),
  testApiKey:   (provider, key) => ipcRenderer.invoke('settings:test-key', provider, key),

  // App info
  isElectron: true,
  getVersion: () => ipcRenderer.invoke('get-version'),
  isAdmin: () => ipcRenderer.invoke('app:is-admin').catch(() => false),
  debugPort: () => ipcRenderer.invoke('app:debug-port').catch(() => null),
  getGitBranch: () => ipcRenderer.invoke('app:git-branch').catch(() => null),

  // Unit B-2 — MCP 접속 토큰(노출/재발급). ★admin 전용이 «아니다» — MCP를 일반 사용자에게
  // 개방하면서 게이팅을 풀었다(환경설정 › 개발자 탭에서 누구나 자기 토큰을 꺼낸다).
  // 토큰은 메모리 + userData/claude-pm/mcp-<port>.json(0600)에만 산다.
  getMcpToken: () => ipcRenderer.invoke('app:mcp-token').catch(() => null),
  regenerateMcpToken: () => ipcRenderer.invoke('mcp:regenerate-token').catch(() => null),

  // Intake (design-bot pipeline)
  saveIntakeFile:  (data)     => ipcRenderer.invoke('intake:save', data),
  loadIntakeFile:  (filename) => ipcRenderer.invoke('intake:load', filename),
  listIntakeFiles: ()         => ipcRenderer.invoke('intake:list'),

  // Figma Bridge (WebSocket 서버 ON/OFF)
  figmaBridgeStatus: () => ipcRenderer.invoke('figma-bridge-status'),
  figmaBridgeStart:  () => ipcRenderer.invoke('figma-bridge-start'),
  figmaBridgeStop:   () => ipcRenderer.invoke('figma-bridge-stop'),

  // 섹션 이미지 캡처 (CDP 기반 — html2canvas flex 버그 우회)
  captureSection: (opts) => ipcRenderer.invoke('capture-section', opts),
  // 섹션 이미지 캡처 (CDP Page.captureScreenshot + captureBeyondViewport)
  // — 청크 캡쳐 동기화 버그 우회용. clone 전체를 viewport 밖이어도 한 번에 캡쳐.
  captureSectionCdp: (opts) => ipcRenderer.invoke('capture-section-cdp', opts),

  // 종료 전 강제 저장
  onForceSaveBeforeQuit: (cb) => ipcRenderer.on('force-save-before-quit', () => cb()),

  // ── .gdt 프로젝트 내보내기 ──
  // gdtExport는 «왕복 검증까지 끝난 뒤» resolve한다 — 성공 = 파일이 실제로 다시 열렸다는 뜻.
  gdtExport:        (args) => ipcRenderer.invoke('gdt:export', args),
  gdtImport:        (args) => ipcRenderer.invoke('gdt:import', args || {}),
  onGdtProgress:    (cb)   => ipcRenderer.on('gdt:progress', (_e, p) => cb(p)),
  onGdtMenuExport:  (cb)   => ipcRenderer.on('gdt:menu-export', () => cb()),
  onGdtMenuImport:  (cb)   => ipcRenderer.on('gdt:menu-import', () => cb()),
  // 파일 연결(.gdt 더블클릭) — 켜진 상태는 push, 꺼진 상태(콜드 스타트)는 pull로 받는다.
  onGdtOpenFile:    (cb)   => ipcRenderer.on('gdt:open-file', (_e, p) => cb(p)),
  gdtTakePendingOpen: ()   => ipcRenderer.invoke('gdt:takePendingOpen'),
  // 비우지 않고 조회만 — 로그인 화면이 「로그인하면 이 파일을 엽니다」를 보여줄 때 쓴다
  gdtPeekPendingOpen: ()   => ipcRenderer.invoke('gdt:peekPendingOpen'),
  quitReady: () => ipcRenderer.send('quit-ready'),

  // Clipboard (Electron 메인 프로세스 경유 — navigator.clipboard 권한 거부 우회)
  clipboardWriteText:  (text)    => ipcRenderer.invoke('clipboard:writeText', text),
  clipboardWriteImage: (dataUrl) => ipcRenderer.invoke('clipboard:writeImage', dataUrl),

  // Claude PM (feature/claude-pm Phase 2)
  pickDirectory:        (defaultPath)            => ipcRenderer.invoke('claudePM:pickDirectory', { defaultPath }),
  createClaudePMFolder: ({ basePath, projectName }) => ipcRenderer.invoke('claudePM:createFolder', { basePath, projectName }),
  openInFinder:         (folderPath)             => ipcRenderer.invoke('claudePM:openInFinder', { folderPath }),
  spawnClaudeTerminal:  (folderPath)             => ipcRenderer.invoke('claudePM:spawnClaudeTerminal', { folderPath }),
  pingClaudePM:         ()                       => ipcRenderer.invoke('claudePM:pingMcp'),
  getMcpInfo:           ()                       => ipcRenderer.invoke('claudePM:getMcpInfo').catch(() => null),
  // ⚠️실측(08-15): 이걸 «부르는 렌더러 코드가 없다». 그래서 global.currentActiveProjectId는
  //   늘 null이었고 read_project·read_section·duplicate_project가 항상 죽었다.
  //   지금은 mcp-server의 _activeProjectId()가 편집기 창 URL을 폴백으로 읽어 살려뒀다.
  //   여길 실제로 부르게 만들면 그 폴백보다 우선한다.
  setClaudePMActiveProject: (projectId)          => ipcRenderer.invoke('claudePM:setActiveProject', { projectId }),
  // 자동 PM 폴더 보장 — 신규 프로젝트 생성 직후 + 기존 프로젝트 활성화 시 호출
  ensureClaudePMFolder: ({ projectId, projectName, basePath } = {}) =>
                        ipcRenderer.invoke('claudePM:ensureFolder', { projectId, projectName, basePath }),

  // Claude PM Phase 3 (F8) — 내부 터미널 패널
  claudePMTerminalStart:  ({ folderPath, cols, rows, projectId } = {}) =>
                          ipcRenderer.invoke('claudePM:terminal:start',  { folderPath, cols, rows, projectId }),
  claudePMTerminalWrite:  (sessionId, data)      =>
                          ipcRenderer.invoke('claudePM:terminal:write',  { sessionId, data }),
  claudePMTerminalResize: (sessionId, cols, rows) =>
                          ipcRenderer.invoke('claudePM:terminal:resize', { sessionId, cols, rows }),
  claudePMTerminalKill:   (sessionId)            =>
                          ipcRenderer.invoke('claudePM:terminal:kill',   { sessionId }),
  // 데이터/exit 이벤트 구독 — cb({sessionId, data}) / cb({sessionId, code, signal})
  // unsubscribe 함수를 반환
  onClaudePMTerminalData: (cb) => {
    const h = (_e, p) => { try { cb(p); } catch (_) {} };
    ipcRenderer.on('claudePM:terminal:data', h);
    return () => ipcRenderer.removeListener('claudePM:terminal:data', h);
  },
  onClaudePMTerminalExit: (cb) => {
    const h = (_e, p) => { try { cb(p); } catch (_) {} };
    ipcRenderer.on('claudePM:terminal:exit', h);
    return () => ipcRenderer.removeListener('claudePM:terminal:exit', h);
  },
});
