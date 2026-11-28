const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sarilingPopover', {
  getSnapshot: () => ipcRenderer.invoke('popover:get-snapshot'),
  onSnapshot: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('popover:snapshot', listener);
    return () => ipcRenderer.removeListener('popover:snapshot', listener);
  },
  onOpened: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('popover:opened', listener);
    return () => ipcRenderer.removeListener('popover:opened', listener);
  },
  setSoundEnabled: (enabled) => ipcRenderer.invoke('popover:set-sound', enabled),
  setBlinkEnabled: (enabled) => ipcRenderer.invoke('popover:set-blink-enabled', enabled),
  stopBlink: () => ipcRenderer.invoke('popover:stop-blink'),
  resumeBlink: () => ipcRenderer.invoke('popover:resume-blink'),
  ringNow: () => ipcRenderer.invoke('popover:ring-now'),
  addTask: (title) => ipcRenderer.invoke('popover:add-task', title),
  completeTask: (taskId) => ipcRenderer.invoke('popover:complete-task', taskId),
  toggleSubtask: (taskId, subtaskId) => ipcRenderer.invoke('popover:toggle-subtask', taskId, subtaskId),
  toggleRoutineBlock: (blockId) => ipcRenderer.invoke('popover:toggle-routine-block', blockId),
  toggleRoutineStep: (blockId, stepIdx) => ipcRenderer.invoke('popover:toggle-routine-step', blockId, stepIdx),
  dismissReminder: (reminderId) => ipcRenderer.invoke('popover:dismiss-reminder', reminderId),
  openWorkspace: (route) => ipcRenderer.invoke('popover:open-workspace', route || '/'),
  closePopover: () => ipcRenderer.send('popover:close'),
});
