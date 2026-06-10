const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Projects (파일 기반)
  listProjects:   ()        => ipcRenderer.invoke('projects:list'),
  loadProject:    (id)      => ipcRenderer.invoke('projects:load', id),
  saveProject:    (project) => ipcRenderer.invoke('projects:save', project),
  // BUG-44: beforeunload용 동기 저장 — async를 await할 수 없는 새로고침/탭닫기 시점에 호출
  saveProjectSync:(project) => ipcRenderer.sendSync('projects:save-sync', project),
  deleteProject:  (id)      => ipcRenderer.invoke('projects:delete', id),
  duplicateProject: ({ sourceProjectId, newName }) =>
    ipcRenderer.invoke('projects:duplicate', { sourceProjectId, newName }),

  // SVG Presets (사용자 자산 — 모든 프로젝트 공유)
  svgPresets: {
    list:   ()                           => ipcRenderer.invoke('svgPresets:list'),
    read:   ({ category, file })         => ipcRenderer.invoke('svgPresets:read',   { category, file }),
    save:   ({ category, name, svg })    => ipcRenderer.invoke('svgPresets:save',   { category, name, svg }),
    delete: ({ category, file })         => ipcRenderer.invoke('svgPresets:delete', { category, file }),
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

  // License
  getPublicIp:        ()                   => ipcRenderer.invoke('license:get-ip'),
  getLicenseUser:     ()                   => ipcRenderer.invoke('license:find-by-ip'),
  registerLicense:    (key, ip, userId)    => ipcRenderer.invoke('license:register', key, ip, userId),
  removeLicenseIp:    (key, ip)            => ipcRenderer.invoke('license:remove-ip', key, ip),
  updateLicenseAlias: (key, ip, alias)     => ipcRenderer.invoke('license:update-alias', key, ip, alias),
  updateLicenseName:  (key, userName)      => ipcRenderer.invoke('license:update-name', key, userName),
  navigateToProjects: ()                   => ipcRenderer.invoke('license:navigate-projects'),
  createLicenseKey:   (plan, memo)         => ipcRenderer.invoke('license:create-key', plan, memo),
  listLicenseKeys:    ()                   => ipcRenderer.invoke('license:list-keys'),

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
