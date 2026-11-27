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
  toggleRoutineBlock: (blockId) => ipcRenderer.invoke('popover:toggle-routine-block', blockId),
  dismissReminder: (reminderId) => ipcRenderer.invoke('popover:dismiss-reminder', reminderId),
  openWorkspace: (route) => ipcRenderer.invoke('popover:open-workspace', route || '/'),
  closePopover: () => ipcRenderer.send('popover:close'),
});
