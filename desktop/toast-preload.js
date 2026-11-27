const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sarilingToast', {
  onShow: (cb) => {
    const listener = (_e, payload) => cb(payload);
    ipcRenderer.on('toast:show', listener);
    return () => ipcRenderer.removeListener('toast:show', listener);
  },
  openPopover: () => ipcRenderer.invoke('toast:open-popover'),
  snooze: (alertKey) => ipcRenderer.invoke('toast:snooze', alertKey),
  dismiss: (alertKey) => ipcRenderer.send('toast:dismiss', alertKey),
  setHovered: (hovered) => ipcRenderer.send('toast:hover', hovered),
});
