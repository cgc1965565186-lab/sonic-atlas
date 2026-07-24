import { memo, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LyricLine } from '../netease/types';
import { usePlayerStore } from '../store/playerStore';
import { useVisualStore, type LyricMotionMode } from '../store/visualStore';
import { LyricParticles } from './LyricParticles';
import {
  characterDrift,
  lyricLineDuration,
  lyricWindow,
  segmentGraphemes,
} from './lyricsMotion';

function lineTarget(
  mode: LyricMotionMode,
  offset: number,
  contextOpacity: number,
  intensity: number,
  staticMotion: boolean,
) {
  const distance = Math.abs(offset);
  const opacity = offset === 0 ? 1 : (distance === 1 ? 0.9 : 0.42) * contextOpacity;
  if (staticMotion) return { opacity, y: 0, x: 0, scale: offset === 0 ? 1 : distance === 1 ? 0.95 : 0.9, filter: 'blur(0px)', rotateX: 0 };
  if (mode === 'depth') {
    return {
      opacity,
      y: offset * (11 + intensity * 8),
      x: offset * intensity * -4,
      scale: offset === 0 ? 1 : distance === 1 ? 0.93 : 0.86,
      filter: offset === 0 ? 'blur(0px)' : `blur(${distance * (1.2 + intensity * 2.3)}px)`,
      rotateX: offset * -2.6 * intensity,
    };
  }
  if (mode === 'cinematic') {
    return {
      opacity,
      y: offset * 7,
      x: 0,
      scale: offset === 0 ? 1 : distance === 1 ? 0.96 : 0.91,
      filter: offset === 0 ? 'blur(0px)' : `blur(${distance * 0.6}px)`,
      rotateX: 0,
    };
  }
  return {
    opacity,
    y: offset * 5,
    x: 0,
    scale: offset === 0 ? 1 : distance === 1 ? 0.95 : 0.9,
    filter: 'blur(0px)',
    rotateX: 0,
  };
}

const ActiveLyric = memo(function ActiveLyric({
  line,
  mode,
  reducedMotion,
  intensity,
  durationMs,
}: {
  line: LyricLine;
  mode: LyricMotionMode;
  reducedMotion: boolean;
  intensity: number;
  durationMs: number;
}) {
  const graphemes = useMemo(() => segmentGraphemes(line.text), [line.text]);
  const staticMotion = reducedMotion || mode === 'static';

  if (staticMotion) return <p className="lyric-current">{line.text}</p>;

  if (mode === 'glow') {
    return (
      <motion.p
        className="lyric-current lyric-glow-line"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      >
        {graphemes.map((grapheme, index) => (
          <motion.span
            className="lyric-glow-grapheme"
            key={`${line.timeMs}-${index}`}
            initial={{
              color: 'rgba(237, 235, 230, .72)',
              opacity: 1,
              textShadow: '0 0 0 rgba(255, 208, 138, 0)',
            }}
            animate={{
              color: '#fff8ea',
              opacity: 1,
              textShadow: '0 0 22px rgba(255, 208, 138, .7)',
            }}
            transition={{
              delay: (index / Math.max(1, graphemes.length)) * Math.max(0.8, durationMs / 1_000 - 0.45),
              duration: 0.34,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            {grapheme === ' ' ? '\u00a0' : grapheme}
          </motion.span>
        ))}
      </motion.p>
    );
  }

  if (mode === 'depth') {
    return (
      <motion.p
        className="lyric-current lyric-depth-current"
        animate={{
          y: [0, -2.5 * intensity, 0],
          scale: [1, 1 + 0.006 * intensity, 1],
        }}
        transition={{
          duration: Math.max(2.8, Math.min(5.4, durationMs / 1_000)),
          ease: 'easeInOut',
          repeat: Infinity,
        }}
      >
        {graphemes.map((grapheme, index) => {
          const drift = characterDrift(line.text, index);
          const delay = Math.min(0.34, index * 0.014);
          return (
            <motion.span
              key={`${line.timeMs}-${index}`}
              initial={{
                opacity: 0,
                x: drift.x * intensity,
                y: 8 + Math.abs(drift.y) * intensity,
                rotate: drift.rotate * intensity,
                filter: `blur(${3 + intensity * 4}px)`,
              }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 0, filter: 'blur(0px)' }}
              exit={{
                opacity: 0,
                x: drift.x * intensity,
                y: drift.y * intensity,
                rotate: drift.rotate * intensity,
                filter: `blur(${2 + intensity * 3}px)`,
              }}
              transition={{ duration: 0.42 + intensity * 0.18, delay, ease: [0.16, 1, 0.3, 1] }}
            >
              {grapheme === ' ' ? '\u00a0' : grapheme}
            </motion.span>
          );
        })}
      </motion.p>
    );
  }

  if (mode === 'breathe') {
    return (
      <motion.p
        className="lyric-current lyric-breathe-current"
        initial={{ opacity: 0, y: 8, filter: 'blur(4px)', scale: 0.992 }}
        animate={{
          opacity: [0.82, 1, 0.9],
          y: [0, -2.2 * intensity, 0],
          scale: [0.994, 1 + intensity * 0.018, 0.998],
          filter: [
            'blur(0px) brightness(.96)',
            `blur(0px) brightness(${1.04 + intensity * 0.08})`,
            'blur(0px) brightness(1)',
          ],
          textShadow: [
            '0 8px 30px rgba(0,0,0,.72)',
            '0 0 30px rgba(255,208,138,.28)',
            '0 8px 30px rgba(0,0,0,.72)',
          ],
        }}
        exit={{
          opacity: 0,
          y: -9,
          filter: 'blur(5px)',
          scale: 1.008,
          transition: { duration: 0.32, ease: [0.4, 0, 1, 1], repeat: 0 },
        }}
        transition={{
          duration: Math.max(2.6, Math.min(4.8, durationMs / 1_000)),
          ease: 'easeInOut',
          repeat: Infinity,
        }}
      >
        <span>{line.text}</span>
      </motion.p>
    );
  }

  return (
    <motion.p
      className="lyric-current lyric-cinematic-current"
      initial={{ opacity: 0, y: 16 + intensity * 8, filter: `blur(${5 + intensity * 5}px)`, clipPath: 'inset(0 0 34% 0)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)', clipPath: 'inset(0 0 0% 0)' }}
      exit={{ opacity: 0, y: -8, filter: 'blur(5px)' }}
      transition={{ duration: 0.62 + intensity * 0.24, ease: [0.16, 1, 0.3, 1] }}
    >
      <span>{line.text}</span>
      <motion.i
        aria-hidden="true"
        className="lyric-cinematic-sheen"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 1, 1], opacity: [0, 0.62, 0] }}
        transition={{
          duration: Math.max(1.4, Math.min(3.4, durationMs / 1_000 * 0.72)),
          times: [0, 0.72, 1],
          ease: [0.16, 1, 0.3, 1],
        }}
      />
    </motion.p>
  );
});

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
  const durationMs = useMemo(() => lyricLineDuration(lyrics, activeIndex), [activeIndex, lyrics]);
  const intensity = motionIntensity / 100;

  if (!currentTrack || lyrics.length === 0 || !activeLine) return null;
  return (
    <motion.section
      className={`lyrics-stage ${immersive ? 'is-immersive' : ''}`}
      data-motion={staticMotion ? 'static' : motionMode}
      data-alignment={alignment}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.16 : 0.4 }}
      aria-label="同步歌词"
      style={{
        '--lyric-size': lyricSize,
        '--lyric-context-opacity': contextOpacity / 100,
        '--lyric-motion-intensity': intensity,
        '--lyric-breathe-scale': 1 + intensity * 0.018,
        textAlign: alignment,
      } as React.CSSProperties}
    >
      <LyricParticles
        lineKey={activeLine.timeMs}
        text={activeLine.text}
        secondary={palette.secondary}
        hot={palette.hot}
        reducedMotion={staticMotion || motionMode !== 'depth'}
      />
      <motion.div className="lyrics-depth-stack" aria-hidden="true" layout>
        <AnimatePresence mode="popLayout" initial={false}>
        {visibleLines.map(({ line, offset, index }) => {
          const isActive = offset === 0;
          return (
            <motion.div
              layout="position"
              className={`lyric-depth-line ${isActive ? 'is-active' : ''}`}
              key={`${index}-${isActive ? `active-${motionMode}` : 'context'}`}
              data-lyric-time={line.timeMs}
              data-active={isActive ? 'true' : 'false'}
              initial={staticMotion ? false : { opacity: 0, y: offset >= 0 ? 13 : -13, filter: 'blur(7px)' }}
              animate={lineTarget(motionMode, offset, contextOpacity / 100, intensity, staticMotion)}
              exit={staticMotion ? { opacity: 0 } : {
                opacity: 0,
                y: offset <= 0 ? -16 : 16,
                filter: 'blur(7px)',
                scale: 0.94,
              }}
              transition={{ duration: staticMotion ? 0.1 : motionMode === 'cinematic' ? 0.66 : 0.46, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformPerspective: 900 }}
            >
              {isActive ? (
                <ActiveLyric
                  line={line}
                  mode={motionMode}
                  reducedMotion={reducedMotion}
                  intensity={intensity}
                  durationMs={durationMs}
                />
              ) : <motion.p>{line.text}</motion.p>}
              {isActive && line.translation ? <span className="lyric-translation">{line.translation}</span> : null}
            </motion.div>
          );
        })}
        </AnimatePresence>
      </motion.div>
      <p className="sr-only" aria-live="polite">{activeLine.text}{activeLine.translation ? `，${activeLine.translation}` : ''}</p>
    </motion.section>
  );
}
