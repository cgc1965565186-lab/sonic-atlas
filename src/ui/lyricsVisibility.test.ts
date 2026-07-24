import { shouldShowLyrics } from './lyricsVisibility';

describe('fullscreen lyric visibility', () => {
  it('always shows lyrics in the normal window and respects the immersive preference', () => {
    expect(shouldShowLyrics(false, false)).toBe(true);
    expect(shouldShowLyrics(true, true)).toBe(true);
    expect(shouldShowLyrics(true, false)).toBe(false);
  });
});
