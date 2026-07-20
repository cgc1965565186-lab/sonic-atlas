export interface BeatState {
  beat: boolean;
  strength: number;
  bpm: number;
  beatCounter: number;
}

export class BeatDetector {
  private readonly fluxHistory = new Float32Array(43);
  private readonly intervals = new Float32Array(12);
  private readonly intervalScratch = new Float32Array(12);
  private fluxIndex = 0;
  private fluxCount = 0;
  private intervalIndex = 0;
  private intervalCount = 0;
  private previousLow = 0;
  private lastBeatAt = -Infinity;
  private bpm = 110;
  private beatCounter = 0;

  update(lowEnergy: number, nowMs: number): BeatState {
    const low = Math.max(0, Math.min(1, Number.isFinite(lowEnergy) ? lowEnergy : 0));
    const flux = Math.max(0, low - this.previousLow);
    this.previousLow += (low - this.previousLow) * 0.45;

    let mean = 0;
    for (let index = 0; index < this.fluxCount; index += 1) mean += this.fluxHistory[index] ?? 0;
    mean /= Math.max(1, this.fluxCount);
    const threshold = mean * 1.55 + 0.012;
    const isBeat = flux > threshold && low > 0.08 && nowMs - this.lastBeatAt >= 180;

    this.fluxHistory[this.fluxIndex] = flux;
    this.fluxIndex = (this.fluxIndex + 1) % this.fluxHistory.length;
    this.fluxCount = Math.min(this.fluxCount + 1, this.fluxHistory.length);

    if (isBeat) {
      if (Number.isFinite(this.lastBeatAt)) {
        let interval = nowMs - this.lastBeatAt;
        while (interval < 333) interval *= 2;
        while (interval > 1_000) interval /= 2;
        this.intervals[this.intervalIndex] = interval;
        this.intervalIndex = (this.intervalIndex + 1) % this.intervals.length;
        this.intervalCount = Math.min(this.intervalCount + 1, this.intervals.length);
        this.bpm = this.estimateBpm();
      }
      this.lastBeatAt = nowMs;
      this.beatCounter += 1;
    }

    return {
      beat: isBeat,
      strength: isBeat ? Math.min(1, flux / Math.max(threshold, 0.001)) : 0,
      bpm: this.bpm,
      beatCounter: this.beatCounter,
    };
  }

  private estimateBpm() {
    for (let index = 0; index < this.intervalCount; index += 1) {
      this.intervalScratch[index] = this.intervals[index] ?? 0;
    }
    for (let index = 1; index < this.intervalCount; index += 1) {
      const value = this.intervalScratch[index] ?? 0;
      let cursor = index - 1;
      while (cursor >= 0 && (this.intervalScratch[cursor] ?? 0) > value) {
        this.intervalScratch[cursor + 1] = this.intervalScratch[cursor] ?? 0;
        cursor -= 1;
      }
      this.intervalScratch[cursor + 1] = value;
    }
    const middle = this.intervalScratch[Math.floor((this.intervalCount - 1) / 2)] ?? 545;
    return Math.round(Math.max(60, Math.min(180, 60_000 / Math.max(1, middle))));
  }
}
