export interface AppStateSnapshot {
  version: 1;
  onboardingComplete: boolean;
  playerSession: Record<string, unknown> | null;
  visualPreferences: Record<string, unknown> | null;
}

export function normalizeAppState(value: unknown): AppStateSnapshot;

export function createAppState(options: {
  userDataPath: string;
  log?: (level: string, event: string, details?: unknown) => void;
}): {
  load(): Promise<AppStateSnapshot>;
  snapshot(): AppStateSnapshot;
  setOnboardingComplete(value: unknown): Promise<boolean>;
  setPlayerSession(value: unknown): boolean;
  setVisualPreferences(value: unknown): boolean;
  flush(): Promise<void>;
};
