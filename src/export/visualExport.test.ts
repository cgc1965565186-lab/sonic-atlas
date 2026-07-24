import { lyricExportMotion } from './visualExport';

describe('visual export lyric motion', () => {
  it('keeps every motion mode visually distinct after the entry transition', () => {
    const elapsed = 2_400;
    const duration = 4_800;
    const cinematic = lyricExportMotion('cinematic', elapsed, duration, 0.7);
    const breathe = lyricExportMotion('breathe', elapsed, duration, 0.7);
    const glow = lyricExportMotion('glow', elapsed, duration, 0.7);
    const depth = lyricExportMotion('depth', elapsed, duration, 0.7);
    const staticFrame = lyricExportMotion('static', elapsed, duration, 0.7);

    expect(new Set([
      JSON.stringify(cinematic),
      JSON.stringify(breathe),
      JSON.stringify(glow),
      JSON.stringify(depth),
      JSON.stringify(staticFrame),
    ]).size).toBe(5);
    expect(glow.highlight).toBeCloseTo(0.5);
    expect(staticFrame).toEqual({ opacity: 1, y: 0, scale: 1, blur: 0, highlight: 1 });
  });

  it('restarts entry motion for each newly active lyric line', () => {
    const beginning = lyricExportMotion('cinematic', 0, 5_000, 0.6);
    const settled = lyricExportMotion('cinematic', 1_000, 5_000, 0.6);
    expect(beginning.opacity).toBe(0);
    expect(beginning.y).toBeGreaterThan(settled.y);
    expect(settled.opacity).toBe(1);
  });
});
