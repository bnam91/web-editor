const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Presets
  readPresets:  ()         => ipcRenderer.invoke('presets:read-all'),
  savePreset:   (preset)   => ipcRenderer.invoke('presets:save', preset),
  deletePreset: (presetId) => ipcRenderer.invoke('presets:delete', presetId),

  // Navigation — 추후 로그인/프로젝트 페이지 구현 시 사용
  // navigate: (page) => ipcRenderer.invoke('navigate', page),

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
