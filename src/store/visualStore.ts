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
    }),
    {
      name: 'sonic-atlas-visual-v1',
      version: 2,
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
      }),
    },
  ),
);
