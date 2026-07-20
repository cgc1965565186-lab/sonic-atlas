import { TERRAIN_RESPONSE } from '../config/visual';

const ATTACK_SECONDS = [0.045, 0.055, 0.085, 0.09, 0.035, 0.028, 0.025, 0.022] as const;
const RELEASE_SECONDS = [0.28, 0.31, 0.42, 0.39, 0.2, 0.17, 0.15, 0.13] as const;

export const TERRAIN_HEIGHT_WEIGHTS = [1, 0.92, 0.62, 0.54, 0.34, 0, 0, 0] as const;

export function secondaryColorWeight(phaseA: number, phaseB: number, time: number) {
  const firstFlow = 0.5 + Math.sin(phaseA + time * 0.17) * 0.5;
  const secondFlow = 0.5 + Math.sin(phaseB - time * 0.11) * 0.5;
  const crossFlow = 0.5 + Math.sin((phaseA - phaseB) * 0.53 + time * 0.07) * 0.5;
  const field = firstFlow * 0.43 + secondFlow * 0.36 + crossFlow * 0.21;
  const softened = field * field * (3 - 2 * field);
  return 0.12 + softened * 0.27;
}

export function tertiaryColorWeight(phaseA: number, phaseB: number, time: number) {
  const firstFlow = 0.5 + Math.sin(phaseA * 0.61 - phaseB * 0.39 - time * 0.09 + 1.7) * 0.5;
  const secondFlow = 0.5 + Math.sin(phaseB * 0.47 + phaseA * 0.28 + time * 0.06 - 0.8) * 0.5;
  const field = firstFlow * 0.58 + secondFlow * 0.42;
  const softened = field * field * (3 - 2 * field);
  return 0.06 + softened * 0.2;
}

export function hotColorWeight(phase: number, time: number, brightness: number) {
  if (brightness <= 0.68) return 0;
  const drift = 0.5 + Math.sin(phase + time * 0.13) * 0.5;
  const spatialGate = Math.max(0, Math.min(1, (drift - 0.67) / 0.28));
  const energyGate = Math.max(0, Math.min(1, (brightness - 0.68) / 0.32));
  return spatialGate * spatialGate * energyGate;
}

export class TerrainDynamics {
  readonly bands = new Float32Array(8);

  step(targets: ArrayLike<number>, gains: ArrayLike<number>, delta: number) {
    const safeDelta = Math.min(0.1, Math.max(0, delta));
    for (let index = 0; index < this.bands.length; index += 1) {
      const gain = 0.35 + (gains[index] ?? 50) / 50;
      const target = Math.max(0, Math.min(1.8, (targets[index] ?? 0) * gain));
      const current = this.bands[index] ?? 0;
      const seconds = target > current ? ATTACK_SECONDS[index] : RELEASE_SECONDS[index];
      const blend = 1 - Math.exp(-safeDelta / (seconds ?? 0.2));
      this.bands[index] = current + (target - current) * blend;
    }
    return this.bands;
  }

  reset() {
    this.bands.fill(0);
  }
}

export class RipplePool {
  readonly starts = new Float32Array(TERRAIN_RESPONSE.rippleCount).fill(-100);
  readonly strengths = new Float32Array(TERRAIN_RESPONSE.rippleCount);
  readonly originsX = new Float32Array(TERRAIN_RESPONSE.rippleCount);
  readonly originsZ = new Float32Array(TERRAIN_RESPONSE.rippleCount);
  private cursor = 0;
  private latest = -1;
  private lastTrigger = -100;

  trigger(time: number, strength: number, beatCounter: number) {
    if (this.latest >= 0 && time - this.lastTrigger <= TERRAIN_RESPONSE.rippleMergeWindow) {
      this.strengths[this.latest] = Math.min(1.8, (this.strengths[this.latest] ?? 0) + strength * 0.48);
      this.lastTrigger = time;
      return this.latest;
    }
    let slot = -1;
    for (let offset = 0; offset < this.starts.length; offset += 1) {
      const candidate = (this.cursor + offset) % this.starts.length;
      const age = time - (this.starts[candidate] ?? -100);
      if (age < 0 || age > TERRAIN_RESPONSE.rippleDuration) {
        slot = candidate;
        break;
      }
    }
    if (slot < 0) {
      const reinforce = this.latest >= 0 ? this.latest : 0;
      this.strengths[reinforce] = Math.min(1.8, (this.strengths[reinforce] ?? 0) + strength * 0.34);
      this.lastTrigger = time;
      return reinforce;
    }
    const angle = beatCounter * 2.39996;
    const originRadius = Math.min(TERRAIN_RESPONSE.rippleOriginRadius, strength * 0.76);
    this.starts[slot] = time;
    this.strengths[slot] = Math.min(1.45, strength);
    this.originsX[slot] = Math.cos(angle) * originRadius;
    this.originsZ[slot] = Math.sin(angle) * originRadius;
    this.latest = slot;
    this.lastTrigger = time;
    this.cursor = (slot + 1) % this.starts.length;
    return slot;
  }

  activeCount(time: number) {
    let count = 0;
    for (let index = 0; index < this.starts.length; index += 1) {
      const age = time - (this.starts[index] ?? -100);
      if (age >= 0 && age <= TERRAIN_RESPONSE.rippleDuration) count += 1;
    }
    return count;
  }
}
