const { contextBridge, ipcRenderer } = require('electron');

// Expose secure Windows 11 Native APIs to the renderer
contextBridge.exposeInMainWorld('jarvisNative', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
  getSystemInfo: () => ipcRenderer.invoke('app:getSystemInfo'),
  showNotification: (title, body) => ipcRenderer.invoke('app:notify', { title, body }),
  isDesktop: true
});
