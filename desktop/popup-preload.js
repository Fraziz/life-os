const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sarilingPopover', {
  getSnapshot: () => ipcRenderer.invoke('popover:get-snapshot'),
  onSnapshot: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('popover:snapshot', listener);
    return () => ipcRenderer.removeListener('popover:snapshot', listener);
  },
  addTask: (title) => ipcRenderer.invoke('popover:add-task', title),
  completeTask: (taskId) => ipcRenderer.invoke('popover:complete-task', taskId),
  completeRoutineBlock: (blockId) => ipcRenderer.invoke('popover:complete-routine-block', blockId),
  openWorkspace: (route) => ipcRenderer.invoke('popover:open-workspace', route || '/'),
  closePopover: () => ipcRenderer.send('popover:close'),
});
