import { AUDIO_BANDS, frequencyBinRange } from './AudioEngine';

describe('frequency band mapping', () => {
  it('maps all eight logarithmic bands into a 2048 FFT without exceeding Nyquist', () => {
    const ranges = AUDIO_BANDS.map((band) => frequencyBinRange(band.minHz, band.maxHz, 48_000, 1_024));
    expect(ranges).toHaveLength(8);
    expect(ranges[0]).toEqual({ start: 0, end: 3 });
    expect(ranges.at(-1)?.end).toBeLessThanOrEqual(1_023);
    for (const range of ranges) expect(range.end).toBeGreaterThanOrEqual(range.start);
  });

  it('clamps frequencies beyond the available Nyquist range', () => {
    expect(frequencyBinRange(12_000, 20_000, 22_050, 1_024).end).toBe(1_023);
  });
});
