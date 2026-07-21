/// <reference types="vite/client" />

import type { AuthStatus } from './netease/types';
import type { MediaCommand } from './player/mediaControls';

interface SonicAtlasDesktop {
  getRuntimeConfig(): Promise<{ apiBaseUrl: string; platform: string }>;
  openInstallHelp(): Promise<void>;
  getAuthStatus(): Promise<AuthStatus>;
  openNeteaseLogin(): Promise<AuthStatus>;
  saveManualCookie(cookie: string): Promise<AuthStatus>;
  logoutNetease(): Promise<void>;
  onAuthChanged(listener: (status: AuthStatus) => void): () => void;
  onMediaCommand(listener: (command: MediaCommand) => void): () => void;
}

declare global {
  interface Window {
    sonicAtlas?: SonicAtlasDesktop;
  }
}

export {};
