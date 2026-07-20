import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useVisualStore } from '../store/visualStore';
import { AirParticles } from './AirParticles';
import { CameraRig } from './CameraRig';
import { SceneAtmosphere } from './SceneAtmosphere';
import { SonicTerrain } from './SonicTerrain';

export default function SonicScene({ reducedMotion }: { reducedMotion: boolean }) {
  const glow = useVisualStore((state) => state.glowIntensity);
  return (
    <div className="scene-shell" aria-hidden="true">
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 20, 38], fov: 44, near: 0.1, far: 140 }}
        gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.9;
        }}
      >
        <Suspense fallback={null}>
          <SceneAtmosphere />
          <group rotation={[0, -0.12, 0]}>
            <SonicTerrain />
            <AirParticles />
          </group>
          <CameraRig reducedMotion={reducedMotion} />
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <Bloom intensity={0.28 + glow / 145} luminanceThreshold={0.58} luminanceSmoothing={0.68} mipmapBlur />
            <Vignette eskil={false} offset={0.18} darkness={0.66} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
