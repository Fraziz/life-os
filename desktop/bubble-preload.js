const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sarilingBubble', {
  onState: (cb) => {
    const listener = (_e, state) => cb(state);
    ipcRenderer.on('bubble:state', listener);
    return () => ipcRenderer.removeListener('bubble:state', listener);
  },
  getState: () => ipcRenderer.invoke('bubble:get-state'),
  toggleApp: () => ipcRenderer.invoke('bubble:toggle-app'),
  setMode: (mode) => ipcRenderer.invoke('bubble:set-mode', mode),
  dragStart: (screenX, screenY) => ipcRenderer.send('bubble:drag-start', { screenX, screenY }),
  dragMove: (screenX, screenY) => ipcRenderer.send('bubble:drag-move', { screenX, screenY }),
  dragEnd: (screenX, screenY) => ipcRenderer.send('bubble:drag-end', { screenX, screenY }),
  openContextMenu: () => ipcRenderer.send('bubble:context-menu'),
});
