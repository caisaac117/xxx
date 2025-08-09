const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  generateReport: (markdown) => ipcRenderer.invoke('app:generateReport', { markdown }),
  close: () => ipcRenderer.invoke('app:close'),
  minimize: () => ipcRenderer.invoke('app:minimize'),
  maxrestore: () => ipcRenderer.invoke('app:maxrestore')
});
