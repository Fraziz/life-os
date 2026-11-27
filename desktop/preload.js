const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sarilingDesktop', {
  getUrl: () => ipcRenderer.invoke('desktop:get-url'),
  saveUrl: (url) => ipcRenderer.invoke('desktop:save-url', url),
});
