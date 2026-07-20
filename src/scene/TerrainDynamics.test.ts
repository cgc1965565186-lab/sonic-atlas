import {
  hotColorWeight,
  RipplePool,
  secondaryColorWeight,
  TERRAIN_HEIGHT_WEIGHTS,
  TerrainDynamics,
  tertiaryColorWeight,
} from './TerrainDynamics';

describe('ordered terrain dynamics', () => {
  it('uses attack/release envelopes without allowing upper bands to add height', () => {
    const dynamics = new TerrainDynamics();
    const gains = new Array<number>(8).fill(50);
    const target = new Float32Array(8).fill(1);
    dynamics.step(target, gains, 1 / 60);
    expect(dynamics.bands[0]).toBeGreaterThan(0);
    expect(TERRAIN_HEIGHT_WEIGHTS.slice(5)).toEqual([0, 0, 0]);
    const peak = dynamics.bands[0] ?? 0;
    dynamics.step(new Float32Array(8), gains, 1 / 60);
    expect(dynamics.bands[0]).toBeLessThan(peak);
    expect(dynamics.bands[0]).toBeGreaterThan(0);
  });

  it('keeps at most two ripples and merges triggers inside 260ms', () => {
    const ripples = new RipplePool();
    const first = ripples.trigger(1, 0.8, 1);
    const reinforced = ripples.trigger(1.2, 0.7, 2);
    expect(reinforced).toBe(first);
    expect(ripples.activeCount(1.2)).toBe(1);
    ripples.trigger(1.5, 0.8, 3);
    const startsBeforeSaturation = Array.from(ripples.starts);
    ripples.trigger(1.8, 0.8, 4);
    expect(ripples.activeCount(1.8)).toBe(2);
    expect(Array.from(ripples.starts)).toEqual(startsBeforeSaturation);
  });

  it('keeps secondary colour evenly restrained while its field drifts over time', () => {
    let total = 0;
    for (let index = 0; index < 1000; index += 1) {
      total += secondaryColorWeight(index * 0.71, index * 1.13, 5);
    }
    expect(total / 1000).toBeGreaterThan(0.23);
    expect(total / 1000).toBeLessThan(0.29);
    expect(secondaryColorWeight(1.2, 3.7, 0)).not.toBe(secondaryColorWeight(1.2, 3.7, 12));
  });

  it('only introduces the drifting hot colour on strong peaks', () => {
    expect(hotColorWeight(1, 4, 0.67)).toBe(0);
    expect(hotColorWeight(1.05, 4, 1)).toBeGreaterThan(0);
    expect(hotColorWeight(1.05, 4, 1)).toBeLessThanOrEqual(1);
  });

  it('adds a restrained third cover colour with an independent drift', () => {
    let total = 0;
    for (let index = 0; index < 1000; index += 1) {
      total += tertiaryColorWeight(index * 0.71, index * 1.13, 5);
    }
    expect(total / 1000).toBeGreaterThan(0.14);
    expect(total / 1000).toBeLessThan(0.19);
    expect(tertiaryColorWeight(1.2, 3.7, 0)).not.toBe(tertiaryColorWeight(1.2, 3.7, 12));
  });
});
