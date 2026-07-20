import { BeatDetector } from './BeatDetector';

describe('BeatDetector', () => {
  it('uses a cooldown and estimates a bounded bpm', () => {
    const detector = new BeatDetector();
    let beatCount = 0;
    for (let time = 0; time <= 3_000; time += 50) {
      const phase = time % 550;
      const result = detector.update(phase < 50 ? 0.95 : 0.04, time);
      if (result.beat) beatCount += 1;
      expect(result.bpm).toBeGreaterThanOrEqual(60);
      expect(result.bpm).toBeLessThanOrEqual(180);
    }
    expect(beatCount).toBeGreaterThanOrEqual(4);
    expect(beatCount).toBeLessThanOrEqual(7);
  });
});
