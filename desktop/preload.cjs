/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sonicAtlas', {
  getRuntimeConfig: () => ipcRenderer.invoke('runtime:get-config'),
  getAuthStatus: () => ipcRenderer.invoke('netease:get-auth-status'),
  openNeteaseLogin: () => ipcRenderer.invoke('netease:open-login'),
  saveManualCookie: (cookie) => ipcRenderer.invoke('netease:save-manual-cookie', String(cookie ?? '')),
  logoutNetease: () => ipcRenderer.invoke('netease:logout'),
  onAuthChanged: (listener) => {
    const handler = (_event, status) => listener(status);
    ipcRenderer.on('netease:auth-changed', handler);
    return () => ipcRenderer.removeListener('netease:auth-changed', handler);
  },
  onMediaCommand: (listener) => {
    const allowed = new Set(['previous', 'toggle', 'next']);
    const handler = (_event, command) => {
      if (allowed.has(command)) listener(command);
    };
    ipcRenderer.on('media:command', handler);
    return () => ipcRenderer.removeListener('media:command', handler);
  },
});
