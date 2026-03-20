const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Presets
  readPresets:  ()         => ipcRenderer.invoke('presets:read-all'),
  savePreset:   (preset)   => ipcRenderer.invoke('presets:save', preset),
  deletePreset: (presetId) => ipcRenderer.invoke('presets:delete', presetId),

  // Navigation — 추후 로그인/프로젝트 페이지 구현 시 사용
  // navigate: (page) => ipcRenderer.invoke('navigate', page),

  // App info
  isElectron: true,
});
