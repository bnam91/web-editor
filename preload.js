const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Projects (파일 기반)
  listProjects:   ()        => ipcRenderer.invoke('projects:list'),
  loadProject:    (id)      => ipcRenderer.invoke('projects:load', id),
  saveProject:    (project) => ipcRenderer.invoke('projects:save', project),
  deleteProject:  (id)      => ipcRenderer.invoke('projects:delete', id),

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

  // App info
  isElectron: true,
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
});
