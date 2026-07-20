import { memo, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { audioEngine } from '../audio/AudioEngine';
import { openingSignal } from '../config/visual';
import { useVisualStore } from '../store/visualStore';

export const CameraRig = memo(function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  const preset = useVisualStore((state) => state.cameraPreset);
  const { camera } = useThree();
  const targetPosition = useMemo(() => new THREE.Vector3(), []);
  const introPosition = useMemo(() => new THREE.Vector3(0, 24, 39), []);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);
  const beatPulse = useRef(0);
  const lastBeat = useRef(0);

  useFrame(({ clock }, delta) => {
    if (!(camera instanceof THREE.PerspectiveCamera) || preset === 'off' || reducedMotion) return;
    const frame = audioEngine.getFrame();
    if (frame.beatCounter !== lastBeat.current) {
      lastBeat.current = frame.beatCounter;
      beatPulse.current = 0.35 + frame.beatStrength * 0.65;
    }
    beatPulse.current *= Math.exp(-delta * 6);
    const time = clock.getElapsedTime();
    const energy = frame.energy;
    const low = frame.lowEnergy;
    if (preset === 'orbit') {
      const phase = time * 0.085;
      targetPosition.set(Math.sin(phase) * (22 - energy * 2.1), 10.5 + energy * 1.7, Math.cos(phase) * 28);
    } else if (preset === 'low-glide') {
      targetPosition.set(Math.sin(time * 0.11) * 12, 2.7 + low * 2.1, 13 + Math.cos(time * 0.08) * 4.2);
    } else {
      const dolly = (Math.sin(time * 0.12) + 1) * 2.2 + beatPulse.current * 0.7;
      targetPosition.set(Math.sin(time * 0.035) * 2.4, 7.5 + energy, 28 - dolly);
    }
    const intro = THREE.MathUtils.smoothstep(openingSignal.value, 0.2, 1);
    targetPosition.lerp(introPosition, 1 - intro);
    const jitter = 0.008 + beatPulse.current * 0.018;
    targetPosition.x += Math.sin(time * 7.1) * jitter;
    targetPosition.y += Math.cos(time * 6.4) * jitter;
    const blend = 1 - Math.exp(-delta * 1.35);
    camera.position.lerp(targetPosition, blend);
    lookTarget.set(0, 0.7 + low * 0.8, 0);
    camera.lookAt(lookTarget);
    camera.fov = THREE.MathUtils.lerp(camera.fov, 44 - energy * 1.8, 1 - Math.exp(-delta * 1.1));
    camera.updateProjectionMatrix();
  });

  return (
    <OrbitControls
      makeDefault
      enabled={preset === 'off' || reducedMotion}
      enableDamping
      dampingFactor={0.08}
      minDistance={8}
      maxDistance={50}
      maxPolarAngle={Math.PI * 0.48}
      target={[0, 0.8, 0]}
    />
  );
});
