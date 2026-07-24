import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DrawerId =
  | 'search'
  | 'library'
  | 'queue'
  | 'visual'
  | 'export'
  | 'diagnostics'
  | 'account'
  | 'help'
  | null;

interface UiState {
  drawer: DrawerId;
  immersive: boolean;
  fullscreen: boolean;
  immersiveLyricsVisible: boolean;
  introComplete: boolean;
  openDrawer: (drawer: Exclude<DrawerId, null>) => void;
  closeDrawer: () => void;
  toggleImmersive: () => void;
  setFullscreen: (value: boolean) => void;
  toggleImmersiveLyrics: () => void;
  setIntroComplete: (value: boolean) => void;
  restartIntro: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      drawer: null,
      immersive: false,
      fullscreen: false,
      immersiveLyricsVisible: true,
      introComplete: false,
      openDrawer: (drawer) => set((state) => ({
        drawer: state.drawer === drawer ? null : drawer,
        immersive: false,
      })),
      closeDrawer: () => set({ drawer: null }),
      toggleImmersive: () => set((state) => ({ immersive: !state.immersive, drawer: null })),
      setFullscreen: (fullscreen) => set({ fullscreen }),
      toggleImmersiveLyrics: () => set((state) => ({ immersiveLyricsVisible: !state.immersiveLyricsVisible })),
      setIntroComplete: (introComplete) => set({ introComplete }),
      restartIntro: () => set({ introComplete: false, drawer: null, immersive: false }),
    }),
    {
      name: 'sonic-atlas-ui-v2',
      version: 1,
      partialize: (state) => ({
        introComplete: state.introComplete,
        immersiveLyricsVisible: state.immersiveLyricsVisible,
      }),
    },
  ),
);
