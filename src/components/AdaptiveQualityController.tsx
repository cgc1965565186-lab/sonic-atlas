import { useEffect, useRef } from 'react';
import { higherQuality, lowerQuality } from '../quality/adaptive';
import { useVisualStore } from '../store/visualStore';

export function AdaptiveQualityController() {
  const qualityMode = useVisualStore((state) => state.qualityMode);
  const setEffectiveQuality = useVisualStore((state) => state.setEffectiveQuality);
  const frameCount = useRef(0);
  const sampleStarted = useRef(0);
  const lowSeconds = useRef(0);
  const highSeconds = useRef(0);
  const lastChange = useRef(0);

  useEffect(() => {
    if (qualityMode !== 'auto') return;
    let frame = 0;
    let cancelled = false;
    sampleStarted.current = performance.now();
    const tick = () => {
      if (cancelled) return;
      frameCount.current += 1;
      const now = performance.now();
      const elapsed = now - sampleStarted.current;
      if (elapsed >= 1_000) {
        if (elapsed > 2_500) {
          frameCount.current = 0;
          sampleStarted.current = now;
          frame = requestAnimationFrame(tick);
          return;
        }
        const fps = frameCount.current * 1_000 / elapsed;
        const sampleSeconds = elapsed / 1_000;
        lowSeconds.current = fps < 38 ? lowSeconds.current + sampleSeconds : 0;
        highSeconds.current = fps > 55 ? highSeconds.current + sampleSeconds : 0;
        const current = useVisualStore.getState().effectiveQuality;
        if (lowSeconds.current >= 10 && now - lastChange.current > 20_000) {
          setEffectiveQuality(lowerQuality(current));
          lowSeconds.current = 0;
          highSeconds.current = 0;
          lastChange.current = now;
        } else if (highSeconds.current >= 20 && now - lastChange.current > 20_000) {
          setEffectiveQuality(higherQuality(current));
          lowSeconds.current = 0;
          highSeconds.current = 0;
          lastChange.current = now;
        }
        frameCount.current = 0;
        sampleStarted.current = now;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [qualityMode, setEffectiveQuality]);

  return null;
}
