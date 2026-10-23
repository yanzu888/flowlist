const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flowlist', {
  syncTasks: (tasks) => ipcRenderer.send('tasks:sync', tasks),
  showNotification: (task) => ipcRenderer.invoke('notification:show', task),
  getReminderStatus: () => ipcRenderer.invoke('reminder:status'),
  getTrayIconStatus: () => ipcRenderer.invoke('test:tray-icon'),
  onReminder: (callback) => ipcRenderer.on('reminder-fired', (_event, task) => callback(task)),
  onFocusTask: (callback) => ipcRenderer.on('focus-task', (_event, taskId) => callback(taskId)),
  onQuickAdd: (callback) => ipcRenderer.on('quick-add', callback),
  platform: process.platform
});
