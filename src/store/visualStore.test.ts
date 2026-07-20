import { presetPalette } from '../config/visual';
import { useVisualStore } from './visualStore';

describe('visual palette mode', () => {
  beforeEach(() => {
    useVisualStore.persist.setOptions({
      storage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    });
    useVisualStore.setState({
      themeId: 'coal-amber',
      paletteMode: 'cover',
      runtimePalette: presetPalette('coal-amber'),
      paletteStatus: 'idle',
    });
  });

  it('locks preset mode when a theme is selected', () => {
    useVisualStore.getState().setTheme('deep-sea');
    const state = useVisualStore.getState();
    expect(state.paletteMode).toBe('preset');
    expect(state.runtimePalette).toEqual(presetPalette('deep-sea'));
  });

  it('only accepts a cover result while automatic mode is active', () => {
    useVisualStore.getState().setTheme('red-screen');
    useVisualStore.getState().applyCoverPalette(presetPalette('deep-sea'));
    expect(useVisualStore.getState().runtimePalette).toEqual(presetPalette('red-screen'));
    useVisualStore.getState().setPaletteMode('cover');
    useVisualStore.getState().applyCoverPalette(presetPalette('deep-sea'));
    expect(useVisualStore.getState().runtimePalette).toEqual(presetPalette('deep-sea'));
  });
});
