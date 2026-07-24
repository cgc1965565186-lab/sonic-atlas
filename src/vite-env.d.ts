/// <reference types="vite/client" />

import type { AuthStatus, LocalTrack } from './netease/types';
import type { MediaCommand } from './player/mediaControls';
import type { ImportResult } from './local/api';

interface DiagnosticStatus {
  audioStatus?: string;
  quality?: string;
  authenticated?: boolean;
}

interface DiagnosticReport {
  generatedAt: string;
  app: { name: string; version: string };
  system: { platform: string; release: string; arch: string; electron?: string; chromium?: string };
  status: Record<string, unknown>;
  privacy: string;
  events: Array<Record<string, unknown>>;
}

interface SonicAtlasDesktop {
  getRuntimeConfig(): Promise<{
    apiBaseUrl: string;
    platform: string;
    version: string;
    fullscreen: boolean;
    onboardingComplete: boolean;
    playerSession: Record<string, unknown> | null;
    visualPreferences: Record<string, unknown> | null;
  }>;
  openInstallHelp(): Promise<void>;
  setOnboardingComplete(value: boolean): Promise<boolean>;
  savePlayerSession(value: unknown): Promise<boolean>;
  saveVisualPreferences(value: unknown): Promise<boolean>;
  importLocalFiles(): Promise<ImportResult>;
  importLocalFolder(): Promise<ImportResult>;
  listLocalTracks(): Promise<LocalTrack[]>;
  rescanLocalTracks(): Promise<ImportResult>;
  relocateLocalTrack(id: string): Promise<LocalTrack | null>;
  removeLocalTrack(id: string): Promise<boolean>;
  getDiagnostics(status: DiagnosticStatus): Promise<DiagnosticReport>;
  exportDiagnostics(status: DiagnosticStatus): Promise<boolean>;
  openFeedback(status: DiagnosticStatus): Promise<boolean>;
  saveExport(payload: { format: 'png' | 'mp4' | 'webm'; base64: string }): Promise<boolean>;
  getAuthStatus(): Promise<AuthStatus>;
  openNeteaseLogin(): Promise<AuthStatus>;
  saveManualCookie(cookie: string): Promise<AuthStatus>;
  logoutNetease(): Promise<void>;
  onAuthChanged(listener: (status: AuthStatus) => void): () => void;
  onMediaCommand(listener: (command: MediaCommand) => void): () => void;
  onFullscreenChanged(listener: (fullscreen: boolean) => void): () => void;
}

declare global {
  interface Window {
    sonicAtlas?: SonicAtlasDesktop;
  }
}

export {};
