import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, globalShortcut, ipcMain, safeStorage, session, shell } from 'electron';
import { createAuthStore, normalizeCookie } from './auth-store.mjs';
import { startLocalServer } from '../server/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDevelopment = Boolean(process.env.VITE_DEV_SERVER_URL);
let mainWindow = null;
let localServer = null;
let authStore = null;
let loginWindow = null;
let closingServer = false;
const installHelpUrl = 'https://cgc1965565186-lab.github.io/sonic-atlas/#macos-install';

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
  handle('runtime:get-config', async () => ({ apiBaseUrl: localServer.url, platform: process.platform }));
  handle('app:open-install-help', () => shell.openExternal(installHelpUrl));
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
  authStore = createAuthStore({ safeStorage, userDataPath: app.getPath('userData') });
  await authStore.load();
  localServer = await startLocalServer({
    distDir: path.join(__dirname, '..', 'dist'),
    dev: isDevelopment,
    getCookie: authStore.getCookie,
    getPersistence: authStore.getPersistence,
  });
  registerIpc();
  createMainWindow();
  registerMediaShortcuts();
}).catch((error) => {
  const message = error instanceof Error ? error.message : 'unknown startup error';
  console.error(`Sonic Atlas failed to start: ${message}`);
  app.quit();
});

app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('before-quit', (event) => {
  if (!localServer || closingServer) return;
  event.preventDefault();
  closingServer = true;
  void localServer.close().finally(() => app.quit());
});
