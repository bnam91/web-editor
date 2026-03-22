const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Projects (파일 기반)
  listProjects:   ()        => ipcRenderer.invoke('projects:list'),
  loadProject:    (id)      => ipcRenderer.invoke('projects:load', id),
  saveProject:    (project) => ipcRenderer.invoke('projects:save', project),
  deleteProject:  (id)      => ipcRenderer.invoke('projects:delete', id),

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
  figmaUpload:    (channel, designJSON) => ipcRenderer.invoke('figma:upload', { channel, designJSON }),
  readNodeMap:    ()        => ipcRenderer.invoke('figma:read-node-map'),
  writeNodeMap:   (nodeMap) => ipcRenderer.invoke('figma:write-node-map', nodeMap),

  // Fullscreen
  getFullscreen: () => ipcRenderer.invoke('fullscreen:get'),
  onFullscreenChange: (cb) => ipcRenderer.on('fullscreen-change', (_e, val) => cb(val)),

  // App info
  isElectron: true,
});
