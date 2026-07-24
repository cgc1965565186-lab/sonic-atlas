import { BeatDetector } from './BeatDetector';

export const AUDIO_BANDS = [
  { id: 'subBass', label: 'SUB BASS', personality: '中心抬升', minHz: 20, maxHz: 60 },
  { id: 'bass', label: 'BASS', personality: '低频重量', minHz: 60, maxHz: 150 },
  { id: 'lowMid', label: 'LOW MID', personality: '慢波流动', minHz: 150, maxHz: 400 },
  { id: 'mid', label: 'MID', personality: '方向流', minHz: 400, maxHz: 2_000 },
  { id: 'highMid', label: 'HIGH MID', personality: '尖峰', minHz: 2_000, maxHz: 4_000 },
  { id: 'presence', label: 'PRESENCE', personality: '闪光触发', minHz: 4_000, maxHz: 6_000 },
  { id: 'brilliance', label: 'BRILLIANCE', personality: '边缘微闪', minHz: 6_000, maxHz: 12_000 },
  { id: 'air', label: 'AIR', personality: '空气颗粒', minHz: 12_000, maxHz: 20_000 },
] as const;

export interface AudioFrame {
  bands: Float32Array;
  energy: number;
  lowEnergy: number;
  beat: boolean;
  beatStrength: number;
  beatCounter: number;
  bpm: number;
}

export interface AudioStatus {
  mode: 'idle' | 'demo' | 'stream';
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  endedCounter: number;
  error: string | null;
}

type AudioListener = (status: AudioStatus) => void;

export function frequencyBinRange(minHz: number, maxHz: number, sampleRate: number, binCount: number) {
  const nyquist = sampleRate / 2;
  const binHz = nyquist / binCount;
  return {
    start: Math.max(0, Math.floor(minHz / binHz)),
    end: Math.min(binCount - 1, Math.ceil(Math.min(maxHz, nyquist) / binHz)),
  };
}

class AudioEngine {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private media: HTMLAudioElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private demoSource: AudioBufferSourceNode | null = null;
  private demoBuffer: AudioBuffer | null = null;
  private captureDestination: MediaStreamAudioDestinationNode | null = null;
  private readonly frequencyData = new Uint8Array(1_024);
  private readonly smoothedBands = new Float32Array(8);
  private readonly frame: AudioFrame = {
    bands: this.smoothedBands,
    energy: 0,
    lowEnergy: 0,
    beat: false,
    beatStrength: 0,
    beatCounter: 0,
    bpm: 110,
  };
  private readonly beatDetector = new BeatDetector();
  private readonly listeners = new Set<AudioListener>();
  private lastAnalysisAt = 0;
  private status: AudioStatus = {
    mode: 'idle',
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: 0.72,
    endedCounter: 0,
    error: null,
  };

  subscribe(listener: AudioListener) {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  getStatus() {
    return this.status;
  }

  private updateStatus(update: Partial<AudioStatus>) {
    this.status = { ...this.status, ...update };
    for (const listener of this.listeners) listener(this.status);
  }

  async initialize() {
    if (this.context) {
      if (this.context.state === 'suspended') await this.context.resume();
      return;
    }
    this.context = new AudioContext({ latencyHint: 'interactive' });
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2_048;
    this.analyser.smoothingTimeConstant = 0.78;
    this.analyser.minDecibels = -82;
    this.analyser.maxDecibels = -16;
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.status.volume;
    this.analyser.connect(this.masterGain);
    this.masterGain.connect(this.context.destination);
  }

  private ensureMedia() {
    if (this.media) return this.media;
    if (!this.context || !this.analyser) throw new Error('AudioEngine is not initialized');
    this.media = new Audio();
    this.media.crossOrigin = 'anonymous';
    this.media.preload = 'metadata';
    this.mediaSource = this.context.createMediaElementSource(this.media);
    this.mediaSource.connect(this.analyser);
    this.media.addEventListener('playing', () => this.updateStatus({ playing: true, error: null }));
    this.media.addEventListener('pause', () => this.updateStatus({ playing: false }));
    this.media.addEventListener('timeupdate', () => {
      this.updateStatus({ currentTime: this.media?.currentTime ?? 0, duration: this.media?.duration || 0 });
    });
    this.media.addEventListener('durationchange', () => this.updateStatus({ duration: this.media?.duration || 0 }));
    this.media.addEventListener('ended', () => {
      this.updateStatus({ playing: false, endedCounter: this.status.endedCounter + 1 });
    });
    this.media.addEventListener('error', () => {
      this.updateStatus({ playing: false, error: '音频流加载失败，请尝试其他曲目' });
    });
    return this.media;
  }

  async startDemo() {
    await this.initialize();
    if (!this.context || !this.analyser) return;
    if (this.media) this.media.pause();
    this.stopDemoSource();
    this.demoBuffer ??= this.createDemoBuffer(this.context);
    this.demoSource = this.context.createBufferSource();
    this.demoSource.buffer = this.demoBuffer;
    this.demoSource.loop = true;
    this.demoSource.connect(this.analyser);
    this.demoSource.start();
    this.updateStatus({ mode: 'demo', playing: true, currentTime: 0, duration: 0, error: null });
  }

  async loadStream(url: string, options: { autoplay?: boolean; startAt?: number } = {}) {
    await this.initialize();
    this.stopDemoSource();
    const media = this.ensureMedia();
    media.pause();
    media.src = url;
    const startAt = Math.max(0, options.startAt ?? 0);
    if (startAt > 0) {
      await new Promise<void>((resolve) => {
        const ready = () => {
          cleanup();
          media.currentTime = Math.min(startAt, Number.isFinite(media.duration) ? media.duration : startAt);
          resolve();
        };
        const failed = () => {
          cleanup();
          resolve();
        };
        const cleanup = () => {
          media.removeEventListener('loadedmetadata', ready);
          media.removeEventListener('error', failed);
        };
        media.addEventListener('loadedmetadata', ready);
        media.addEventListener('error', failed);
        media.load();
      });
    } else {
      media.currentTime = 0;
    }
    this.updateStatus({ mode: 'stream', playing: false, currentTime: startAt, duration: 0, error: null });
    if (options.autoplay === false) return;
    try {
      await media.play();
    } catch {
      this.updateStatus({ playing: false, error: '浏览器阻止了自动播放，请再次点击播放' });
    }
  }

  stop() {
    this.stopDemoSource();
    if (this.media) {
      this.media.pause();
      this.media.removeAttribute('src');
      this.media.load();
    }
    this.updateStatus({ mode: 'idle', playing: false, currentTime: 0, duration: 0, error: null });
  }

  async getCaptureStream() {
    await this.initialize();
    if (!this.context || !this.masterGain) throw new Error('音频引擎尚未就绪');
    if (!this.captureDestination) {
      this.captureDestination = this.context.createMediaStreamDestination();
      this.masterGain.connect(this.captureDestination);
    }
    return this.captureDestination.stream;
  }

  async toggle() {
    if (this.status.mode === 'idle') {
      await this.startDemo();
      return;
    }
    if (this.status.mode === 'demo') {
      if (!this.context) return;
      if (this.context.state === 'running') {
        await this.context.suspend();
        this.updateStatus({ playing: false });
      } else {
        await this.context.resume();
        this.updateStatus({ playing: true });
      }
      return;
    }
    const media = this.ensureMedia();
    if (media.paused) await media.play();
    else media.pause();
  }

  seek(seconds: number) {
    if (!this.media || this.status.mode !== 'stream') return;
    this.media.currentTime = Math.max(0, Math.min(this.media.duration || 0, seconds));
    this.updateStatus({ currentTime: this.media.currentTime });
  }

  setVolume(value: number) {
    const volume = Math.max(0, Math.min(1, value));
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(volume, this.context?.currentTime ?? 0, 0.02);
    this.updateStatus({ volume });
  }

  getFrame(): AudioFrame {
    this.frame.beat = false;
    this.frame.beatStrength = 0;
    const now = performance.now();
    // R3F has multiple consumers (terrain, particles and camera). Time-gating keeps
    // them on one shared ~30 Hz FFT sample instead of sampling once per consumer.
    if (!this.analyser || !this.context) {
      return this.frame;
    }
    if (this.context.state !== 'running') {
      for (let bandIndex = 0; bandIndex < this.smoothedBands.length; bandIndex += 1) {
        this.smoothedBands[bandIndex] = (this.smoothedBands[bandIndex] ?? 0) * 0.84;
      }
      this.frame.energy *= 0.84;
      this.frame.lowEnergy = (this.smoothedBands[0] ?? 0) * 0.58 + (this.smoothedBands[1] ?? 0) * 0.42;
      return this.frame;
    }
    if (now - this.lastAnalysisAt < 30) return this.frame;
    this.lastAnalysisAt = now;

    this.analyser.getByteFrequencyData(this.frequencyData);
    let energy = 0;
    for (let bandIndex = 0; bandIndex < AUDIO_BANDS.length; bandIndex += 1) {
      const band = AUDIO_BANDS[bandIndex];
      if (!band) continue;
      const { start, end } = frequencyBinRange(band.minHz, band.maxHz, this.context.sampleRate, this.analyser.frequencyBinCount);
      let sumSquares = 0;
      for (let index = start; index <= end; index += 1) {
        const value = (this.frequencyData[index] ?? 0) / 255;
        sumSquares += value * value;
      }
      const normalized = Math.sqrt(sumSquares / Math.max(1, end - start + 1));
      const gated = Math.max(0, normalized - 0.035) / 0.965;
      const target = Math.min(1, gated * 1.42);
      const current = this.smoothedBands[bandIndex] ?? 0;
      const blend = target > current ? 0.42 : 0.2;
      this.smoothedBands[bandIndex] = current + (target - current) * blend;
      energy += this.smoothedBands[bandIndex] ?? 0;
    }
    this.frame.energy += (energy / AUDIO_BANDS.length - this.frame.energy) * 0.28;
    this.frame.lowEnergy = (this.smoothedBands[0] ?? 0) * 0.58 + (this.smoothedBands[1] ?? 0) * 0.42;
    const beat = this.beatDetector.update(this.frame.lowEnergy, now);
    this.frame.beat = beat.beat;
    this.frame.beatStrength = beat.strength;
    this.frame.beatCounter = beat.beatCounter;
    this.frame.bpm = beat.bpm;
    return this.frame;
  }

  private stopDemoSource() {
    if (!this.demoSource) return;
    try {
      this.demoSource.stop();
    } catch {
      // It may already be stopped.
    }
    this.demoSource.disconnect();
    this.demoSource = null;
  }

  private createDemoBuffer(context: AudioContext) {
    const bpm = 110;
    const secondsPerBeat = 60 / bpm;
    const duration = secondsPerBeat * 32;
    const frameCount = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(2, frameCount, context.sampleRate);
    let seed = 0x5f3759df;
    const random = () => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed / 0xffff_ffff;
    };
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const samples = buffer.getChannelData(channel);
      for (let index = 0; index < samples.length; index += 1) {
        const time = index / context.sampleRate;
        const beatPhase = time % secondsPerBeat;
        const beatIndex = Math.floor(time / secondsPerBeat) % 4;
        const eighthPhase = time % (secondsPerBeat / 2);
        const kickEnvelope = Math.exp(-beatPhase * 18);
        const kick = Math.sin(Math.PI * 2 * (52 + 55 * Math.exp(-beatPhase * 32)) * time) * kickEnvelope * 0.68;
        const snareEnvelope = beatIndex % 2 === 1 ? Math.exp(-beatPhase * 22) : 0;
        const snare = (random() * 2 - 1) * snareEnvelope * 0.21;
        const hatEnvelope = Math.exp(-eighthPhase * 75);
        const hat = (random() * 2 - 1) * hatEnvelope * 0.055;
        const bassNote = beatIndex === 0 || beatIndex === 3 ? 55 : 73.42;
        const bass = Math.sin(Math.PI * 2 * bassNote * time) * 0.16 * (0.5 + kickEnvelope * 0.5);
        const pad =
          (Math.sin(Math.PI * 2 * 110 * time) + Math.sin(Math.PI * 2 * 164.81 * time) * 0.6) * 0.045;
        const stereo = channel === 0 ? Math.sin(time * 0.19) * 0.012 : Math.cos(time * 0.17) * 0.012;
        samples[index] = Math.tanh((kick + snare + hat + bass + pad + stereo) * 1.25);
      }
    }
    return buffer;
  }
}

export const audioEngine = new AudioEngine();
