import type { LyricLine } from '../netease/types';
import { characterDrift, lyricLineDuration, lyricWindow, segmentGraphemes } from './lyricsMotion';

describe('cinematic lyric helpers', () => {
  const lines: LyricLine[] = Array.from({ length: 7 }, (_, index) => ({ timeMs: index * 1000, text: `Line ${index}` }));

  it('returns the active line with two neighbours on either side', () => {
    const window = lyricWindow(lines, 3);
    expect(window.map((entry) => entry.index)).toEqual([1, 2, 3, 4, 5]);
    expect(window.map((entry) => entry.offset)).toEqual([-2, -1, 0, 1, 2]);
  });

  it('keeps a clipped five-line window at timeline edges', () => {
    expect(lyricWindow(lines, 0).map((entry) => entry.index)).toEqual([0, 1, 2]);
    expect(lyricWindow(lines, 6).map((entry) => entry.index)).toEqual([4, 5, 6]);
  });

  it('segments composed graphemes and generates stable exit drift', () => {
    expect(segmentGraphemes('你Á好')).toEqual(['你', 'Á', '好']);
    expect(characterDrift('星河', 1)).toEqual(characterDrift('星河', 1));
  });

  it('uses the next timestamp for lyric motion without extreme durations', () => {
    expect(lyricLineDuration(lines, 2)).toBe(1_200);
    expect(lyricLineDuration([{ timeMs: 0, text: 'A' }, { timeMs: 15_000, text: 'B' }], 0)).toBe(9_000);
    expect(lyricLineDuration(lines, 6)).toBe(3_600);
  });
});
