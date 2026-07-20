import { activeLyricIndex, mergeLyrics, parseLrc } from './lrc';

describe('parseLrc', () => {
  it('parses multiple tags and offset', () => {
    expect(parseLrc('[offset:100]\n[00:01.50][00:03.250]Line')).toEqual([
      { timeMs: 1600, text: 'Line' },
      { timeMs: 3350, text: 'Line' },
    ]);
  });

  it('merges translated lines within tolerance', () => {
    expect(mergeLyrics('[00:01.00]Hello', '[00:01.12]你好')).toEqual([
      { timeMs: 1000, text: 'Hello', translation: '你好' },
    ]);
  });

  it('finds the active line', () => {
    const lines = parseLrc('[00:01]A\n[00:02]B\n[00:03]C');
    expect(activeLyricIndex(lines, 2500)).toBe(1);
    expect(activeLyricIndex(lines, 500)).toBe(-1);
  });
});
