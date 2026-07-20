import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { audioEngine } from '../audio/AudioEngine';
import { useVisualStore } from '../store/visualStore';

export const AirParticles = memo(function AirParticles() {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const palette = useVisualStore((state) => state.runtimePalette);
  const currentColor = useRef(new THREE.Color(palette.hot));
  const targetColor = useMemo(() => new THREE.Color(palette.hot), [palette.hot]);
  const positions = useMemo(() => {
    const count = 260;
    const values = new Float32Array(count * 3);
    let seed = 7;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) & 0x7fff_ffff;
      return seed / 0x7fff_ffff;
    };
    for (let index = 0; index < count; index += 1) {
      values[index * 3] = (random() - 0.5) * 38;
      values[index * 3 + 1] = random() * 15 + 1;
      values[index * 3 + 2] = (random() - 0.5) * 38;
    }
    return values;
  }, []);

  useFrame(({ clock }, delta) => {
    if (pointsRef.current) pointsRef.current.rotation.y += delta * 0.012;
    if (materialRef.current) {
      const air = audioEngine.getFrame().bands[7] ?? 0;
      currentColor.current.lerp(targetColor, 1 - Math.exp(-delta * 2.35));
      materialRef.current.color.copy(currentColor.current);
      materialRef.current.opacity = THREE.MathUtils.lerp(materialRef.current.opacity, 0.18 + air * 0.7, 0.1);
      materialRef.current.size = 0.025 + air * 0.045 + Math.sin(clock.getElapsedTime() * 0.4) * 0.002;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        color={palette.hot}
        size={0.028}
        transparent
        opacity={0.24}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
});
