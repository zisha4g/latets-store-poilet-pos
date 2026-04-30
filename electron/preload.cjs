const { contextBridge, ipcRenderer } = require('electron');

// Expose a flag so the web app knows it's running inside Electron
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getRuntimeInfo: () => ipcRenderer.invoke('app:get-runtime-info'),
  printCurrentPage: (options = {}) => ipcRenderer.invoke('app:print-current-page', options),
  getKioskCredentials: () => ipcRenderer.invoke('app:get-kiosk-credentials'),
  getInstallerCredentials: () => ipcRenderer.invoke('app:get-installer-credentials'),
  saveKioskCredentials: (creds) => ipcRenderer.invoke('app:save-kiosk-credentials', creds),
  clearKioskCredentials: () => ipcRenderer.invoke('app:clear-kiosk-credentials'),
  clearInstallerCredentials: () => ipcRenderer.invoke('app:clear-installer-credentials'),
});
