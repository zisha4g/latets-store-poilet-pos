const { contextBridge } = require('electron');

// Expose a flag so the web app knows it's running inside Electron
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
});
