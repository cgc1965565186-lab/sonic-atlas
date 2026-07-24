import { normalizeAppState } from '../../desktop/app-state.mjs';

describe('desktop app state', () => {
  it('keeps the first-run flag and supported renderer snapshots', () => {
    const state = normalizeAppState({
      onboardingComplete: true,
      playerSession: { version: 2, currentIndex: 1 },
      visualPreferences: { lyricMotion: 'cinematic' },
      ignored: 'value',
    });

    expect(state).toEqual({
      version: 1,
      onboardingComplete: true,
      playerSession: { version: 2, currentIndex: 1 },
      visualPreferences: { lyricMotion: 'cinematic' },
    });
  });

  it('rejects invalid nested snapshots without losing onboarding state', () => {
    const state = normalizeAppState({
      onboardingComplete: true,
      playerSession: 'invalid',
      visualPreferences: [],
    });

    expect(state.onboardingComplete).toBe(true);
    expect(state.playerSession).toBeNull();
    expect(state.visualPreferences).toBeNull();
  });
});
