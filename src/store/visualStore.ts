import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  presetPalette,
  type CameraPreset,
  type PaletteMode,
  type PaletteStatus,
  type ScenePalette,
  type ThemeId,
} from '../config/visual';

export type QualityMode = 'auto' | 'low' | 'medium' | 'high';
export type EffectiveQuality = Exclude<QualityMode, 'auto'>;
export type LyricMotionMode = 'cinematic' | 'breathe' | 'glow' | 'depth' | 'static';
export type LyricAlignment = 'left' | 'center';

export interface VisualState {
  themeId: ThemeId;
  paletteMode: PaletteMode;
  runtimePalette: ScenePalette;
  paletteStatus: PaletteStatus;
  gridSize: 32 | 48 | 64 | 80;
  bandGains: number[];
  motionSpeed: number;
  glowIntensity: number;
  ripplesEnabled: boolean;
  cameraPreset: CameraPreset;
  qualityMode: QualityMode;
  effectiveQuality: EffectiveQuality;
  lyricMotion: LyricMotionMode;
  lyricAlignment: LyricAlignment;
  lyricSize: number;
  lyricContextOpacity: number;
  lyricMotionIntensity: number;
  setTheme: (themeId: ThemeId) => void;
  setPaletteMode: (mode: PaletteMode) => void;
  applyCoverPalette: (palette: ScenePalette) => void;
  applyPresetPalette: () => void;
  setPaletteStatus: (status: PaletteStatus) => void;
  setGridSize: (gridSize: 32 | 48 | 64 | 80) => void;
  setBandGain: (index: number, value: number) => void;
  setMotionSpeed: (value: number) => void;
  setGlowIntensity: (value: number) => void;
  setRipplesEnabled: (value: boolean) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setQualityMode: (mode: QualityMode) => void;
  setEffectiveQuality: (quality: EffectiveQuality) => void;
  setLyricMotion: (mode: LyricMotionMode) => void;
  setLyricAlignment: (alignment: LyricAlignment) => void;
  setLyricSize: (value: number) => void;
  setLyricContextOpacity: (value: number) => void;
  setLyricMotionIntensity: (value: number) => void;
}

export const useVisualStore = create<VisualState>()(
  persist(
    (set) => ({
      themeId: 'coal-amber',
      paletteMode: 'cover',
      runtimePalette: presetPalette('coal-amber'),
      paletteStatus: 'idle',
      gridSize: 64,
      bandGains: new Array<number>(8).fill(50),
      motionSpeed: 54,
      glowIntensity: 58,
      ripplesEnabled: true,
      cameraPreset: 'orbit',
      qualityMode: 'auto',
      effectiveQuality: 'high',
      lyricMotion: 'depth',
      lyricAlignment: 'left',
      lyricSize: 58,
      lyricContextOpacity: 42,
      lyricMotionIntensity: 70,
      setTheme: (themeId) =>
        set({
          themeId,
          paletteMode: 'preset',
          runtimePalette: presetPalette(themeId),
          paletteStatus: 'ready',
        }),
      setPaletteMode: (paletteMode) =>
        set((state) => ({
          paletteMode,
          runtimePalette: paletteMode === 'preset' ? presetPalette(state.themeId) : state.runtimePalette,
          paletteStatus: paletteMode === 'cover' ? 'loading' : 'ready',
        })),
      applyCoverPalette: (runtimePalette) =>
        set((state) =>
          state.paletteMode === 'cover'
            ? { runtimePalette, paletteStatus: 'ready' }
            : state,
        ),
      applyPresetPalette: () =>
        set((state) => ({ runtimePalette: presetPalette(state.themeId), paletteStatus: 'fallback' })),
      setPaletteStatus: (paletteStatus) => set({ paletteStatus }),
      setGridSize: (gridSize) => set({ gridSize }),
      setBandGain: (index, value) =>
        set((state) => ({
          bandGains: state.bandGains.map((current, currentIndex) =>
            currentIndex === index ? Math.max(0, Math.min(100, value)) : current,
          ),
        })),
      setMotionSpeed: (motionSpeed) => set({ motionSpeed: Math.max(0, Math.min(100, motionSpeed)) }),
      setGlowIntensity: (glowIntensity) => set({ glowIntensity: Math.max(0, Math.min(100, glowIntensity)) }),
      setRipplesEnabled: (ripplesEnabled) => set({ ripplesEnabled }),
      setCameraPreset: (cameraPreset) => set({ cameraPreset }),
      setQualityMode: (qualityMode) =>
        set({
          qualityMode,
          ...(qualityMode === 'auto' ? {} : { effectiveQuality: qualityMode }),
        }),
      setEffectiveQuality: (effectiveQuality) => set((state) =>
        state.qualityMode === 'auto' ? { effectiveQuality } : state),
      setLyricMotion: (lyricMotion) => set({ lyricMotion }),
      setLyricAlignment: (lyricAlignment) => set({ lyricAlignment }),
      setLyricSize: (lyricSize) => set({ lyricSize: Math.max(35, Math.min(100, lyricSize)) }),
      setLyricContextOpacity: (lyricContextOpacity) =>
        set({ lyricContextOpacity: Math.max(10, Math.min(80, lyricContextOpacity)) }),
      setLyricMotionIntensity: (lyricMotionIntensity) =>
        set({ lyricMotionIntensity: Math.max(0, Math.min(100, lyricMotionIntensity)) }),
    }),
    {
      name: 'sonic-atlas-visual-v1',
      version: 3,
      migrate: (persisted) => {
        const previous = (persisted ?? {}) as Partial<VisualState>;
        return {
          themeId: previous.themeId ?? 'coal-amber',
          paletteMode: previous.paletteMode === 'preset' ? 'preset' : 'cover',
          gridSize: previous.gridSize ?? 64,
          bandGains: previous.bandGains ?? new Array<number>(8).fill(50),
          motionSpeed: previous.motionSpeed ?? 54,
          glowIntensity: previous.glowIntensity ?? 58,
          ripplesEnabled: previous.ripplesEnabled ?? true,
          cameraPreset: previous.cameraPreset ?? 'orbit',
          qualityMode: previous.qualityMode ?? 'auto',
          effectiveQuality: previous.effectiveQuality ?? 'high',
          lyricMotion: previous.lyricMotion ?? 'depth',
          lyricAlignment: previous.lyricAlignment ?? 'left',
          lyricSize: previous.lyricSize ?? 58,
          lyricContextOpacity: previous.lyricContextOpacity ?? 42,
          lyricMotionIntensity: previous.lyricMotionIntensity ?? 70,
        };
      },
      partialize: (state) => ({
        themeId: state.themeId,
        paletteMode: state.paletteMode,
        gridSize: state.gridSize,
        bandGains: state.bandGains,
        motionSpeed: state.motionSpeed,
        glowIntensity: state.glowIntensity,
        ripplesEnabled: state.ripplesEnabled,
        cameraPreset: state.cameraPreset,
        qualityMode: state.qualityMode,
        effectiveQuality: state.effectiveQuality,
        lyricMotion: state.lyricMotion,
        lyricAlignment: state.lyricAlignment,
        lyricSize: state.lyricSize,
        lyricContextOpacity: state.lyricContextOpacity,
        lyricMotionIntensity: state.lyricMotionIntensity,
      }),
    },
  ),
);
