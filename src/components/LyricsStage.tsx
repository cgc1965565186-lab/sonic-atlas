import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePlayerStore } from '../store/playerStore';
import { useVisualStore } from '../store/visualStore';
import { LyricParticles } from './LyricParticles';
import { characterDrift, lyricWindow, segmentGraphemes } from './lyricsMotion';

export function LyricsStage({ immersive, reducedMotion }: { immersive: boolean; reducedMotion: boolean }) {
  const lyrics = usePlayerStore((state) => state.lyrics);
  const activeIndex = usePlayerStore((state) => state.activeLyricIndex);
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const palette = useVisualStore((state) => state.runtimePalette);
  const motionMode = useVisualStore((state) => state.lyricMotion);
  const alignment = useVisualStore((state) => state.lyricAlignment);
  const lyricSize = useVisualStore((state) => state.lyricSize);
  const contextOpacity = useVisualStore((state) => state.lyricContextOpacity);
  const motionIntensity = useVisualStore((state) => state.lyricMotionIntensity);
  const staticMotion = reducedMotion || motionMode === 'static';
  const visibleLines = useMemo(() => lyricWindow(lyrics, activeIndex), [activeIndex, lyrics]);
  const activeLine = activeIndex >= 0 ? lyrics[activeIndex] : undefined;
  const graphemes = useMemo(() => segmentGraphemes(activeLine?.text ?? ''), [activeLine?.text]);

  if (!currentTrack || lyrics.length === 0) return null;
  return (
    <motion.section
      className={`lyrics-stage ${immersive ? 'is-immersive' : ''}`}
      data-motion={staticMotion ? 'static' : motionMode}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.2 : 0.42 }}
      aria-label="同步歌词"
      style={{
        '--lyric-size': lyricSize,
        '--lyric-context-opacity': contextOpacity / 100,
        '--lyric-motion-intensity': motionIntensity / 100,
        textAlign: alignment,
      } as React.CSSProperties}
    >
      <LyricParticles
        lineKey={activeLine?.timeMs ?? -1}
        text={activeLine?.text ?? ''}
        secondary={palette.secondary}
        hot={palette.hot}
        reducedMotion={staticMotion}
      />
      <div className="lyrics-depth-stack" aria-hidden="true">
        {visibleLines.map(({ line, offset }) => {
          const isActive = offset === 0;
          return (
            <motion.div
              layout="position"
              className={`lyric-depth-line ${isActive ? 'is-active' : ''}`}
              key={line.timeMs}
              initial={{ opacity: 0, y: offset > 0 ? 16 : -16, filter: 'blur(8px)' }}
              animate={{
                opacity: isActive ? 1 : (Math.abs(offset) === 1 ? 1 : 0.48) * (contextOpacity / 100),
                y: 0,
                scale: isActive
                  ? motionMode === 'breathe' && !staticMotion ? 1.025 : 1
                  : Math.abs(offset) === 1 ? 0.91 : 0.84,
                filter: staticMotion || motionMode === 'cinematic' || motionMode === 'breathe'
                  ? 'blur(0px)'
                  : isActive ? 'blur(0px)' : `blur(${Math.abs(offset) * 1.8 * motionIntensity / 100}px)`,
              }}
              transition={{ duration: staticMotion ? 0.12 : motionMode === 'cinematic' ? 0.72 : 0.46, ease: [0.22, 1, 0.36, 1] }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {isActive ? (
                  <motion.p className="lyric-current" key={line.timeMs}>
                    {staticMotion || motionMode === 'cinematic' || motionMode === 'breathe'
                      ? line.text
                      : graphemes.map((grapheme, index) => {
                          const drift = characterDrift(line.text, index);
                          return (
                            <motion.span
                              key={`${line.timeMs}-${index}`}
                              initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                              exit={{ opacity: 0, x: drift.x, y: drift.y, rotate: drift.rotate, filter: 'blur(5px)' }}
                              transition={{
                                opacity: { duration: 0.28, delay: index * 0.018 },
                                y: { duration: 0.4, delay: index * 0.018, ease: [0.22, 1, 0.36, 1] },
                                filter: { duration: 0.32, delay: index * 0.018 },
                              }}
                            >
                              {grapheme === ' ' ? '\u00a0' : grapheme}
                            </motion.span>
                          );
                        })}
                  </motion.p>
                ) : <motion.p key={`context-${line.timeMs}`}>{line.text}</motion.p>}
              </AnimatePresence>
              {isActive && line.translation ? <span className="lyric-translation">{line.translation}</span> : null}
            </motion.div>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">{activeLine?.text ?? ''}{activeLine?.translation ? `，${activeLine.translation}` : ''}</p>
    </motion.section>
  );
}
