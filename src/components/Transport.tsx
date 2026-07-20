import { Pause, Play, SkipBack, SkipForward, SpeakerHigh } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePlayerStore } from '../store/playerStore';
import { GlassSurface } from './GlassSurface';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

export function Transport() {
  const track = usePlayerStore((state) => state.currentTrack);
  const mode = usePlayerStore((state) => state.mode);
  const playing = usePlayerStore((state) => state.playing);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const volume = usePlayerStore((state) => state.volume);
  const toggle = usePlayerStore((state) => state.toggle);
  const previous = usePlayerStore((state) => state.previous);
  const next = usePlayerStore((state) => state.next);
  const seek = usePlayerStore((state) => state.seek);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const title = track?.title ?? (mode === 'demo' ? 'Procedural Study No. 01' : '等待一次触碰');
  const artist = track?.artists.join(' / ') ?? (mode === 'demo' ? '110 BPM · GENERATED LOCALLY' : '点击播放启动声音地形');
  const position = duration > 0 ? currentTime : 0;

  return (
    <GlassSurface className="transport">
      <div className="track-identity">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            className="track-identity-transition"
            key={track?.id ?? mode}
            initial={{ opacity: 0, y: 5, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -4, filter: 'blur(4px)' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {track?.coverUrl ? <img src={track.coverUrl} alt="" draggable={false} /> : <span className="track-orb" aria-hidden="true" />}
            <div>
              <p>{title}</p>
              <span>{artist}</span>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="transport-center">
        <div className="playback-buttons">
          <motion.button type="button" className="icon-button" whileTap={{ scale: 0.92 }} onClick={() => void previous()} aria-label="上一首">
            <SkipBack weight="fill" />
          </motion.button>
          <motion.button
            type="button"
            className="play-button"
            whileTap={{ scale: 0.94 }}
            onClick={() => void toggle()}
            aria-label={playing ? '暂停' : '播放'}
          >
            {playing ? <Pause weight="fill" /> : <Play weight="fill" />}
          </motion.button>
          <motion.button type="button" className="icon-button" whileTap={{ scale: 0.92 }} onClick={() => void next()} aria-label="下一首">
            <SkipForward weight="fill" />
          </motion.button>
        </div>
        <div className="timeline">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(1, duration)}
            step={0.25}
            value={Math.min(position, Math.max(1, duration))}
            disabled={duration <= 0}
            onChange={(event) => seek(Number(event.currentTarget.value))}
            aria-label="播放进度"
            style={{ '--range-progress': `${duration > 0 ? (position / duration) * 100 : 0}%` } as React.CSSProperties}
          />
          <span>{duration > 0 ? formatTime(duration) : 'DEMO'}</span>
        </div>
      </div>
      <label className="volume-control">
        <SpeakerHigh />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => setVolume(Number(event.currentTarget.value))}
          aria-label="音量"
          style={{ '--range-progress': `${volume * 100}%` } as React.CSSProperties}
        />
        <span>{Math.round(volume * 100)}</span>
      </label>
    </GlassSurface>
  );
}
