import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useVisualStore } from '../store/visualStore';

const PALETTE_DAMPING = 2.35;

export function SceneAtmosphere() {
  const palette = useVisualStore((state) => state.runtimePalette);
  const backgroundRef = useRef<THREE.Color>(null);
  const fogRef = useRef<THREE.Fog>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const directionalRef = useRef<THREE.DirectionalLight>(null);
  const floorRef = useRef<THREE.MeshStandardMaterial>(null);
  const currentBackground = useRef(new THREE.Color(palette.background));
  const currentFog = useRef(new THREE.Color(palette.fog));
  const currentAccent = useRef(new THREE.Color(palette.accent));
  const currentHot = useRef(new THREE.Color(palette.hot));
  const targetBackground = useMemo(() => new THREE.Color(palette.background), [palette.background]);
  const targetFog = useMemo(() => new THREE.Color(palette.fog), [palette.fog]);
  const targetAccent = useMemo(() => new THREE.Color(palette.accent), [palette.accent]);
  const targetHot = useMemo(() => new THREE.Color(palette.hot), [palette.hot]);

  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-delta * PALETTE_DAMPING);
    currentBackground.current.lerp(targetBackground, blend);
    currentFog.current.lerp(targetFog, blend);
    currentAccent.current.lerp(targetAccent, blend);
    currentHot.current.lerp(targetHot, blend);
    backgroundRef.current?.copy(currentBackground.current);
    fogRef.current?.color.copy(currentFog.current);
    if (ambientRef.current) ambientRef.current.color.copy(currentHot.current);
    if (directionalRef.current) directionalRef.current.color.copy(currentAccent.current);
    if (floorRef.current) floorRef.current.color.copy(currentBackground.current);
  });

  return (
    <>
      <color ref={backgroundRef} attach="background" args={[palette.background]} />
      <fog ref={fogRef} attach="fog" args={[palette.fog, 19, 68]} />
      <ambientLight ref={ambientRef} intensity={0.38} color={palette.hot} />
      <directionalLight ref={directionalRef} position={[6, 16, 9]} intensity={1.3} color={palette.accent} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.22, 0]}>
        <planeGeometry args={[70, 70]} />
        <meshStandardMaterial ref={floorRef} color={palette.background} roughness={0.86} metalness={0.12} />
      </mesh>
    </>
  );
}
