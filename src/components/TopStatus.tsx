import { motion } from 'framer-motion';
import { audioEngine } from '../audio/AudioEngine';
import { CAMERA_PRESETS } from '../config/visual';
import { usePlayerStore } from '../store/playerStore';
import { useVisualStore } from '../store/visualStore';

export function TopStatus() {
  const mode = usePlayerStore((state) => state.mode);
  const playing = usePlayerStore((state) => state.playing);
  const camera = useVisualStore((state) => state.cameraPreset);
  const cameraLabel = CAMERA_PRESETS.find((item) => item.id === camera)?.label ?? '手动';
  const bpm = Math.round(audioEngine.getFrame().bpm);
  return (
    <header className="top-status app-drag-region">
      <div className="wordmark">
        <strong>SONIC ATLAS</strong>
        <span>DESKTOP LISTENING FIELD</span>
      </div>
      <div className="status-readout">
        <span>{cameraLabel}</span>
        <span>{mode === 'stream' ? `${bpm} BPM` : '110 BPM'}</span>
        <span className={playing ? 'live-state is-live' : 'live-state'}>{playing ? 'LIVE' : 'STILL'}</span>
      </div>
      <motion.span className="drag-glint" animate={{ opacity: [0.25, 0.5, 0.25] }} transition={{ duration: 4, repeat: Infinity }} />
    </header>
  );
}
