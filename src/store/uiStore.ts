import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type DrawerId =
  | 'library'
  | 'queue'
  | 'visual'
  | 'export'
  | 'account'
  | 'help'
  | null;

export type MusicSection = 'search' | 'local' | 'netease';

interface UiState {
  drawer: DrawerId;
  musicSection: MusicSection;
  immersive: boolean;
  fullscreen: boolean;
  immersiveLyricsVisible: boolean;
  introComplete: boolean;
  introReady: boolean;
  openDrawer: (drawer: Exclude<DrawerId, null>) => void;
  openMusic: (section: MusicSection) => void;
  setMusicSection: (section: MusicSection) => void;
  closeDrawer: () => void;
  toggleImmersive: () => void;
  setFullscreen: (value: boolean) => void;
  toggleImmersiveLyrics: () => void;
  hydrateIntro: (value: boolean) => void;
  setIntroComplete: (value: boolean) => void;
  restartIntro: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      drawer: null,
      musicSection: 'local',
      immersive: false,
      fullscreen: false,
      immersiveLyricsVisible: true,
      introComplete: false,
      introReady: false,
      openDrawer: (drawer) => set((state) => ({
        drawer: state.drawer === drawer ? null : drawer,
        immersive: false,
      })),
      openMusic: (musicSection) => set({ drawer: 'library', musicSection, immersive: false }),
      setMusicSection: (musicSection) => set({ musicSection }),
      closeDrawer: () => set({ drawer: null }),
      toggleImmersive: () => set((state) => ({ immersive: !state.immersive, drawer: null })),
      setFullscreen: (fullscreen) => set({ fullscreen }),
      toggleImmersiveLyrics: () => set((state) => ({ immersiveLyricsVisible: !state.immersiveLyricsVisible })),
      hydrateIntro: (introComplete) => set({ introComplete, introReady: true }),
      setIntroComplete: (introComplete) => set({ introComplete, introReady: true }),
      restartIntro: () => set({ introComplete: false, introReady: true, drawer: null, immersive: false }),
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
