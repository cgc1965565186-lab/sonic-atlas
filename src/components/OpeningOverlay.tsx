import { useCallback, useEffect } from 'react';
import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { openingSignal } from '../config/visual';
import { usePlayerStore } from '../store/playerStore';

interface OpeningOverlayProps {
  reducedMotion: boolean;
  onComplete: () => void;
}

export function OpeningOverlay({ reducedMotion, onComplete }: OpeningOverlayProps) {
  const progress = useMotionValue(0);
  const blackout = useTransform(progress, [0, 0.12, 0.74, 1], [1, 0.94, 0.16, 0]);
  const titleOpacity = useTransform(progress, [0, 0.18, 0.7, 0.94], [0, 1, 1, 0]);
  const titleY = useTransform(progress, [0, 0.34, 1], [18, 0, -12]);
  const startDemo = usePlayerStore((state) => state.startDemo);

  const finish = useCallback(
    (unlockAudio: boolean) => {
      openingSignal.value = 1;
      progress.set(1);
      onComplete();
      if (unlockAudio) void startDemo();
    },
    [onComplete, progress, startDemo],
  );

  useEffect(() => {
    openingSignal.value = 0;
    const playback = animate(progress, 1, {
      duration: reducedMotion ? 0.25 : 4.2,
      ease: [0.2, 0.72, 0.18, 1],
      onUpdate: (value) => {
        openingSignal.value = value;
      },
      onComplete: () => finish(false),
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'Escape') {
        event.preventDefault();
        playback.stop();
        finish(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      playback.stop();
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [finish, progress, reducedMotion]);

  return (
    <motion.button
      type="button"
      className="opening-overlay"
      style={{ backgroundColor: 'rgb(6, 7, 7)', opacity: blackout }}
      onClick={() => finish(true)}
      aria-label="跳过开场并启动演示音频"
    >
      <motion.span className="opening-mark" style={{ opacity: titleOpacity, y: titleY }}>
        <span className="opening-kicker">A LISTENING LANDSCAPE</span>
        <span className="opening-title">SONIC ATLAS</span>
        <span className="opening-hint">点击任意处进入 · Space 跳过</span>
      </motion.span>
    </motion.button>
  );
}
