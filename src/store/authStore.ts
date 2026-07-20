import { create } from 'zustand';
import { neteaseApi, resolveAuthMedia } from '../netease/api';
import type { AuthStatus } from '../netease/types';

interface AuthState extends AuthStatus {
  loading: boolean;
  error: string | null;
  desktopAvailable: boolean;
  initialize: () => Promise<void>;
  openLogin: () => Promise<void>;
  saveManualCookie: (cookie: string) => Promise<void>;
  logout: () => Promise<void>;
  applyStatus: (status: AuthStatus) => void;
}

const EMPTY_AUTH: AuthStatus = { authenticated: false, persistence: 'session', user: null };

export const useAuthStore = create<AuthState>((set) => ({
  ...EMPTY_AUTH,
  loading: true,
  error: null,
  desktopAvailable: Boolean(window.sonicAtlas),
  applyStatus: (status) => set({ ...resolveAuthMedia(status), loading: false, error: null }),
  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const status = window.sonicAtlas
        ? await window.sonicAtlas.getAuthStatus()
        : await neteaseApi.authStatus();
      set({ ...resolveAuthMedia(status), loading: false });
    } catch {
      set({ ...EMPTY_AUTH, loading: false });
    }
  },
  openLogin: async () => {
    if (!window.sonicAtlas) {
      set({ error: '扫码登录仅在 Electron 桌面版可用' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const status = await window.sonicAtlas.openNeteaseLogin();
      set({ ...resolveAuthMedia(status), loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : '登录窗口打开失败' });
    }
  },
  saveManualCookie: async (cookie) => {
    if (!window.sonicAtlas) {
      set({ error: '手动 Cookie 仅在 Electron 桌面版可用' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const status = await window.sonicAtlas.saveManualCookie(cookie);
      set({ ...resolveAuthMedia(status), loading: false });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Cookie 验证失败' });
    }
  },
  logout: async () => {
    if (window.sonicAtlas) await window.sonicAtlas.logoutNetease();
    set({ ...EMPTY_AUTH, loading: false, error: null });
  },
}));
