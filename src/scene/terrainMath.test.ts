import { centerEnvelope, gaussianRing, softLimitHeight } from './terrainMath';

describe('centered terrain response', () => {
  it('keeps a broad center focus while tapering the outer field', () => {
    expect(centerEnvelope(0, 2.15)).toBe(1);
    expect(centerEnvelope(0.5, 1.65)).toBeGreaterThan(0.6);
    expect(centerEnvelope(1, 1.65)).toBeLessThan(0.2);
  });

  it('soft-limits peaks without introducing a hard clipping shelf', () => {
    expect(softLimitHeight(0, 5.6)).toBe(0);
    expect(softLimitHeight(6, 5.6)).toBeGreaterThan(3.6);
    expect(softLimitHeight(20, 5.6)).toBeLessThan(5.6);
  });

  it('creates a smooth ripple crest with a symmetric falloff', () => {
    expect(gaussianRing(5, 5, 2.9)).toBe(1);
    expect(gaussianRing(4.5, 5, 2.9)).toBeCloseTo(gaussianRing(5.5, 5, 2.9));
    expect(gaussianRing(3, 5, 2.9)).toBeLessThan(0.001);
  });
});
