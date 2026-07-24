import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, safeStorage, session, shell } from 'electron';
import { createAppState } from './app-state.mjs';
import { createAuthStore, normalizeCookie } from './auth-store.mjs';
import { createDiagnostics, isExpectedCancellation } from './diagnostics.mjs';
import { createLocalLibrary, SUPPORTED_AUDIO_EXTENSIONS } from './local-library.mjs';
import { startLocalServer } from '../server/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
let mainWindow = null;
let localServer = null;
let authStore = null;
let localLibrary = null;
let diagnostics = null;
let appState = null;
let loginWindow = null;
let closingServer = false;
const installHelpUrl = 'https://cgc1965565186-lab.github.io/sonic-atlas/#macos-install';
const feedbackUrl = 'https://github.com/cgc1965565186-lab/sonic-atlas/issues/new';

app.enableSandbox();
if (!app.requestSingleInstanceLock()) app.quit();

function isTrustedSender(event) {
  try {
    const url = new URL(event.senderFrame.url);
    return url.hostname === '127.0.0.1' && (url.origin === localServer?.url || url.origin === process.env.VITE_DEV_SERVER_URL);
  } catch {
    return false;
  }
}

function handle(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!isTrustedSender(event)) throw new Error('Untrusted IPC sender');
    return handler(...args);
  });
}

function notifyAuth(status) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('netease:auth-changed', status);
}

function diagnosticStatus(status = {}) {
  return diagnostics.report({
    localLibrary,
    audioStatus: status.audioStatus,
    quality: status.quality,
    authenticated: status.authenticated,
  });
}

function audioFilters() {
  return [{
    name: '音频文件',
    extensions: [...SUPPORTED_AUDIO_EXTENSIONS].map((extension) => extension.slice(1)),
  }];
}

function sendMediaCommand(command) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('media:command', command);
}

function registerMediaShortcuts() {
  const shortcuts = [
    ['Media Previous Track', 'previous'],
    ['Media Play/Pause', 'toggle'],
    ['Media Next Track', 'next'],
  ];
  for (const [accelerator, command] of shortcuts) {
    try {
      globalShortcut.register(accelerator, () => sendMediaCommand(command));
    } catch {
      // Focused-window keys and Media Session remain available when the OS reserves a media key.
    }
  }
}

async function currentAuthStatus(cookieOverride) {
  const status = await localServer.netease.getAuthStatus(cookieOverride);
  return { ...status, persistence: authStore.getPersistence() };
}

function serializeCookies(cookies) {
  return cookies
    .filter((cookie) => cookie.name && cookie.value)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

async function openNeteaseLogin() {
  if (loginWindow && !loginWindow.isDestroyed()) {
    loginWindow.focus();
    return currentAuthStatus();
  }

  const loginSession = session.fromPartition(`netease-login-${Date.now()}`, { cache: false });
  loginSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  loginWindow = new BrowserWindow({
    parent: mainWindow,
    modal: false,
    width: 1120,
    height: 760,
    minWidth: 840,
    minHeight: 620,
    title: '网易云音乐登录',
    show: false,
    backgroundColor: '#111211',
    webPreferences: {
      session: loginSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  loginWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  loginWindow.once('ready-to-show', () => loginWindow?.show());

  return new Promise((resolve) => {
    let finished = false;
    let checking = false;

    const finish = async (status) => {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      notifyAuth(status);
      if (loginWindow && !loginWindow.isDestroyed()) loginWindow.close();
      resolve(status);
    };

    const inspectCookies = async () => {
      if (finished || checking) return;
      checking = true;
      try {
        const cookies = await loginSession.cookies.get({ url: 'https://music.163.com/' });
        const hasCredential = cookies.some((cookie) => cookie.name === 'MUSIC_U' || cookie.name === 'MUSIC_A');
        if (!hasCredential) return;
        const candidate = serializeCookies(cookies);
        const status = await currentAuthStatus(candidate);
        if (!status.authenticated) return;
        await authStore.save(candidate);
        await finish({ ...status, persistence: authStore.getPersistence() });
      } finally {
        checking = false;
      }
    };

    const timer = setInterval(() => {
      void inspectCookies().catch(() => {
        // A transient login-status timeout must never escape into Electron's main process.
      });
    }, 900);
    loginWindow.on('closed', () => {
      loginWindow = null;
      if (!finished) {
        finished = true;
        clearInterval(timer);
        void currentAuthStatus()
          .then(resolve)
          .catch(() => resolve({ authenticated: false, persistence: authStore.getPersistence(), user: null }));
      }
    });
    void loginWindow.loadURL('https://music.163.com/#/login').catch(() => {
      // Chromium keeps its load error page visible; swallowing the rejected promise prevents a native crash dialog.
    });
  });
}

function registerIpc() {
  handle('runtime:get-config', async () => {
    const stored = appState.snapshot();
    return {
      apiBaseUrl: localServer.url,
      platform: process.platform,
      version: app.getVersion(),
      fullscreen: Boolean(mainWindow?.isFullScreen()),
      onboardingComplete: stored.onboardingComplete,
      playerSession: stored.playerSession,
      visualPreferences: stored.visualPreferences,
    };
  });
  handle('app:open-install-help', () => shell.openExternal(installHelpUrl));
  handle('app:set-onboarding-complete', (value) => appState.setOnboardingComplete(value));
  handle('app:save-player-session', (value) => appState.setPlayerSession(value));
  handle('app:save-visual-preferences', (value) => appState.setVisualPreferences(value));
  handle('local:list', () => localLibrary.list());
  handle('local:import-files', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '导入本地音乐',
      properties: ['openFile', 'multiSelections'],
      filters: audioFilters(),
    });
    if (result.canceled) return { tracks: localLibrary.list(), imported: 0, updated: 0, failures: [] };
    return localLibrary.importFiles(result.filePaths);
  });
  handle('local:import-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择音乐文件夹',
      properties: ['openDirectory', 'multiSelections'],
    });
    if (result.canceled) return { tracks: localLibrary.list(), imported: 0, updated: 0, failures: [] };
    return localLibrary.importFolders(result.filePaths);
  });
  handle('local:rescan', () => localLibrary.rescan());
  handle('local:relocate', async (id) => {
    if (!/^local-[a-f0-9]{24}$/.test(id)) throw new Error('无效的本地曲目');
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '重新定位音乐文件',
      properties: ['openFile'],
      filters: audioFilters(),
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return localLibrary.relocate(id, result.filePaths[0]);
  });
  handle('local:remove', async (id) => {
    if (!/^local-[a-f0-9]{24}$/.test(id)) throw new Error('无效的本地曲目');
    return localLibrary.remove(id);
  });
  handle('diagnostics:get', (status) => diagnosticStatus(status));
  handle('diagnostics:export', async (status) => {
    const report = diagnosticStatus(status);
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '导出 Sonic Atlas 诊断报告',
      defaultPath: `Sonic-Atlas-Diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return false;
    await fs.writeFile(result.filePath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
    return true;
  });
  handle('diagnostics:feedback', async (status) => {
    clipboard.writeText(JSON.stringify(diagnosticStatus(status), null, 2));
    await shell.openExternal(feedbackUrl);
    return true;
  });
  handle('export:save', async (payload) => {
    const format = payload?.format === 'png' ? 'png'
      : payload?.format === 'mp4' ? 'mp4'
        : payload?.format === 'webm' ? 'webm'
          : '';
    if (!format || typeof payload?.base64 !== 'string') throw new Error('导出内容无效');
    const bytes = Buffer.from(payload.base64, 'base64');
    if (bytes.length === 0 || bytes.length > 96 * 1024 * 1024) throw new Error('导出内容大小无效');
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '保存 Sonic Atlas 视觉作品',
      defaultPath: `Sonic-Atlas-${Date.now()}.${format}`,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    });
    if (result.canceled || !result.filePath) return false;
    await fs.writeFile(result.filePath, bytes, { mode: 0o600 });
    return true;
  });
  handle('netease:get-auth-status', () => currentAuthStatus());
  handle('netease:open-login', () => openNeteaseLogin());
  handle('netease:save-manual-cookie', async (rawCookie) => {
    const cookie = normalizeCookie(rawCookie);
    if (!cookie || cookie.length > 16_384) throw new Error('Cookie 内容无效');
    const status = await currentAuthStatus(cookie);
    if (!status.authenticated) throw new Error('Cookie 已失效或无法验证');
    await authStore.save(cookie);
    const nextStatus = { ...status, persistence: authStore.getPersistence() };
    notifyAuth(nextStatus);
    return nextStatus;
  });
  handle('netease:logout', async () => {
    await authStore.clear();
    const status = await currentAuthStatus();
    notifyAuth(status);
  });
}

function createMainWindow() {
  const windowOptions = {
    width: 1500,
    height: 960,
    minWidth: 1040,
    minHeight: 700,
    backgroundColor: '#0c0d0d',
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: process.platform === 'darwin' ? { x: 18, y: 18 } : undefined,
    titleBarOverlay: process.platform === 'win32' ? { color: '#0c0d0d', symbolColor: '#d7d1c8', height: 40 } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  };
  mainWindow = new BrowserWindow(windowOptions);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = new URL(isDevelopment ? process.env.VITE_DEV_SERVER_URL : localServer.url).origin;
    if (new URL(url).origin !== allowed) event.preventDefault();
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  const notifyFullscreen = () => mainWindow?.webContents.send('app:fullscreen-changed', Boolean(mainWindow?.isFullScreen()));
  mainWindow.on('enter-full-screen', notifyFullscreen);
  mainWindow.on('leave-full-screen', notifyFullscreen);
  mainWindow.on('closed', () => { mainWindow = null; });
  void mainWindow.loadURL(isDevelopment ? process.env.VITE_DEV_SERVER_URL : localServer.url).catch(() => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.destroy();
    app.quit();
  });
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

void app.whenReady().then(async () => {
  diagnostics = createDiagnostics({ userDataPath: app.getPath('userData'), appVersion: app.getVersion() });
  await diagnostics.load();
  appState = createAppState({
    userDataPath: app.getPath('userData'),
    log: (level, event, details) => diagnostics.record(level, event, details),
  });
  await appState.load();
  localLibrary = createLocalLibrary({
    userDataPath: app.getPath('userData'),
    log: (level, event, details) => diagnostics.record(level, event, details),
  });
  await localLibrary.load();
  authStore = createAuthStore({ safeStorage, userDataPath: app.getPath('userData') });
  await authStore.load();
  localServer = await startLocalServer({
    distDir: path.join(__dirname, '..', 'dist'),
    dev: isDevelopment,
    getCookie: authStore.getCookie,
    getPersistence: authStore.getPersistence,
    localLibrary,
    log: (level, event, details) => diagnostics.record(level, event, details),
  });
  registerIpc();
  createMainWindow();
  registerMediaShortcuts();
}).catch((error) => {
  const message = error instanceof Error ? error.message : 'unknown startup error';
  console.error(`Sonic Atlas failed to start: ${message}`);
  app.quit();
});

process.on('uncaughtException', (error) => {
  diagnostics?.record(isExpectedCancellation(error) ? 'warn' : 'error', 'uncaught-exception', error);
  if (isExpectedCancellation(error)) return;
  if (app.isReady()) dialog.showErrorBox('Sonic Atlas 遇到问题', '应用已保存脱敏诊断信息，请重新启动。');
  app.exit(1);
});

process.on('unhandledRejection', (reason) => {
  diagnostics?.record(isExpectedCancellation(reason) ? 'warn' : 'error', 'unhandled-rejection', reason);
  if (isExpectedCancellation(reason)) return;
  console.error('Unhandled rejection in Sonic Atlas:', reason);
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('before-quit', (event) => {
  if (!localServer || closingServer) return;
  event.preventDefault();
  closingServer = true;
  void Promise.all([localServer.close(), appState?.flush()]).finally(() => app.quit());
});
