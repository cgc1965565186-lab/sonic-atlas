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
  const visibleLines = useMemo(() => lyricWindow(lyrics, activeIndex), [activeIndex, lyrics]);
  const activeLine = activeIndex >= 0 ? lyrics[activeIndex] : undefined;
  const graphemes = useMemo(() => segmentGraphemes(activeLine?.text ?? ''), [activeLine?.text]);

  if (!currentTrack || lyrics.length === 0) return null;
  return (
    <motion.section
      className={`lyrics-stage ${immersive ? 'is-immersive' : ''}`}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.2 : 0.42 }}
      aria-label="同步歌词"
    >
      <LyricParticles
        lineKey={activeLine?.timeMs ?? -1}
        text={activeLine?.text ?? ''}
        secondary={palette.secondary}
        hot={palette.hot}
        reducedMotion={reducedMotion}
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
                opacity: isActive ? 1 : Math.abs(offset) === 1 ? 0.42 : 0.2,
                y: 0,
                scale: isActive ? 1 : Math.abs(offset) === 1 ? 0.91 : 0.84,
                filter: isActive ? 'blur(0px)' : `blur(${Math.abs(offset) * 1.8}px)`,
              }}
              transition={{ duration: reducedMotion ? 0.2 : 0.46, ease: [0.22, 1, 0.36, 1] }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                {isActive ? (
                  <motion.p className="lyric-current" key={line.timeMs}>
                    {reducedMotion
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
