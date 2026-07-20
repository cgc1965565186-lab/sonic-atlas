import { useEffect } from 'react';
import { presetPalette } from '../config/visual';
import { usePlayerStore } from '../store/playerStore';
import { useVisualStore } from '../store/visualStore';
import { coverPaletteEngine } from './CoverPaletteEngine';

export function CoverPaletteController() {
  const track = usePlayerStore((state) => state.currentTrack);
  const mode = usePlayerStore((state) => state.mode);
  const paletteMode = useVisualStore((state) => state.paletteMode);
  const themeId = useVisualStore((state) => state.themeId);

  useEffect(() => {
    const visual = useVisualStore.getState();
    const fallback = presetPalette(themeId);
    if (paletteMode !== 'cover') {
      visual.applyPresetPalette();
      visual.setPaletteStatus('ready');
      return;
    }
    if (!track?.coverUrl || mode === 'demo') {
      visual.applyPresetPalette();
      visual.setPaletteStatus('idle');
      return;
    }

    const controller = new AbortController();
    visual.setPaletteStatus('loading');
    void coverPaletteEngine
      .analyse(track.coverUrl, fallback, controller.signal)
      .then((palette) => {
        if (!controller.signal.aborted) useVisualStore.getState().applyCoverPalette(palette);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        const latest = useVisualStore.getState();
        if (latest.paletteMode === 'cover') {
          latest.applyPresetPalette();
          latest.setPaletteStatus('fallback');
        }
      });
    return () => controller.abort();
  }, [mode, paletteMode, themeId, track?.coverUrl, track?.id]);

  return null;
}
