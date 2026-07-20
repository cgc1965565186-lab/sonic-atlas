import { create } from 'zustand';

export type DrawerId = 'search' | 'library' | 'visual' | 'account' | null;

interface UiState {
  drawer: DrawerId;
  immersive: boolean;
  introComplete: boolean;
  openDrawer: (drawer: Exclude<DrawerId, null>) => void;
  closeDrawer: () => void;
  toggleImmersive: () => void;
  setIntroComplete: (value: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  drawer: null,
  immersive: false,
  introComplete: false,
  openDrawer: (drawer) => set((state) => ({ drawer: state.drawer === drawer ? null : drawer, immersive: false })),
  closeDrawer: () => set({ drawer: null }),
  toggleImmersive: () => set((state) => ({ immersive: !state.immersive, drawer: null })),
  setIntroComplete: (introComplete) => set({ introComplete }),
}));
