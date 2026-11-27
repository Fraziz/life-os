const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sarilingDesktop', {
  getUrl: () => ipcRenderer.invoke('desktop:get-url'),
  saveUrl: (url) => ipcRenderer.invoke('desktop:save-url', url),
  getBubbleConfig: () => ipcRenderer.invoke('desktop:get-bubble-config'),
  setBubbleVisible: (visible) => ipcRenderer.invoke('desktop:set-bubble-visible', visible),
  setBubbleMode: (mode) => ipcRenderer.invoke('desktop:set-bubble-mode', mode),
  toggleBubblePopover: () => ipcRenderer.invoke('desktop:trigger-bubble'),
  getCompanionConfig: () => ipcRenderer.invoke('desktop:get-companion-config'),
  setStartupEnabled: (enabled) => ipcRenderer.invoke('desktop:set-startup', enabled),
  setAlertSoundEnabled: (enabled) => ipcRenderer.invoke('desktop:set-sound', enabled),
  testAlertRing: () => ipcRenderer.invoke('desktop:test-ring'),
  notifyWorkspaceReady: () => ipcRenderer.send('desktop:workspace-ready'),
});
