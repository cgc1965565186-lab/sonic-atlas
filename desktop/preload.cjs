/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sonicAtlas', {
  getRuntimeConfig: () => ipcRenderer.invoke('runtime:get-config'),
  openInstallHelp: () => ipcRenderer.invoke('app:open-install-help'),
  importLocalFiles: () => ipcRenderer.invoke('local:import-files'),
  importLocalFolder: () => ipcRenderer.invoke('local:import-folder'),
  listLocalTracks: () => ipcRenderer.invoke('local:list'),
  rescanLocalTracks: () => ipcRenderer.invoke('local:rescan'),
  relocateLocalTrack: (id) => ipcRenderer.invoke('local:relocate', String(id ?? '')),
  removeLocalTrack: (id) => ipcRenderer.invoke('local:remove', String(id ?? '')),
  getDiagnostics: (status) => ipcRenderer.invoke('diagnostics:get', status ?? {}),
  exportDiagnostics: (status) => ipcRenderer.invoke('diagnostics:export', status ?? {}),
  openFeedback: (status) => ipcRenderer.invoke('diagnostics:feedback', status ?? {}),
  saveExport: (payload) => ipcRenderer.invoke('export:save', payload),
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
  onFullscreenChanged: (listener) => {
    const handler = (_event, fullscreen) => listener(Boolean(fullscreen));
    ipcRenderer.on('app:fullscreen-changed', handler);
    return () => ipcRenderer.removeListener('app:fullscreen-changed', handler);
  },
});
