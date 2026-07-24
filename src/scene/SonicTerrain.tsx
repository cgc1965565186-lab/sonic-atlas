import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { audioEngine } from '../audio/AudioEngine';
import { openingSignal, TERRAIN_RESPONSE } from '../config/visual';
import { useVisualStore } from '../store/visualStore';
import { centerEnvelope, gaussianRing, softLimitHeight } from './terrainMath';
import {
  hotColorWeight,
  RipplePool,
  secondaryColorWeight,
  TerrainDynamics,
  tertiaryColorWeight,
} from './TerrainDynamics';
import { terrainFragmentShader, terrainVertexShader } from './terrainShaders';

interface CellMap {
  x: Float32Array;
  z: Float32Array;
  radius: Float32Array;
  angle: Float32Array;
  seed: Float32Array;
  macroNoise: Float32Array;
  detailNoise: Float32Array;
  colorPhaseA: Float32Array;
  colorPhaseB: Float32Array;
  colorPhaseHot: Float32Array;
  spikeMask: Uint8Array;
  count: number;
  spacing: number;
}

function hashGrid(x: number, z: number) {
  const value = Math.sin(x * 127.17 + z * 311.71) * 43_758.5453;
  return value - Math.floor(value);
}

function valueNoise(x: number, z: number) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hashGrid(x0, z0);
  const b = hashGrid(x0 + 1, z0);
  const c = hashGrid(x0, z0 + 1);
  const d = hashGrid(x0 + 1, z0 + 1);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, sx), THREE.MathUtils.lerp(c, d, sx), sz);
}

function fractalNoise(x: number, z: number) {
  let amplitude = 0.58;
  let frequency = 1;
  let sum = 0;
  let normalization = 0;
  for (let octave = 0; octave < 3; octave += 1) {
    sum += valueNoise(x * frequency, z * frequency) * amplitude;
    normalization += amplitude;
    frequency *= 2.04;
    amplitude *= 0.5;
  }
  return sum / normalization;
}

function createCellMap(gridSize: number): CellMap {
  const count = gridSize * gridSize;
  const x = new Float32Array(count);
  const z = new Float32Array(count);
  const radius = new Float32Array(count);
  const angle = new Float32Array(count);
  const seed = new Float32Array(count);
  const macroNoise = new Float32Array(count);
  const detailNoise = new Float32Array(count);
  const colorPhaseA = new Float32Array(count);
  const colorPhaseB = new Float32Array(count);
  const colorPhaseHot = new Float32Array(count);
  const spikeMask = new Uint8Array(count);
  const terrainSize = TERRAIN_RESPONSE.size;
  const spacing = terrainSize / gridSize;
  const offset = ((gridSize - 1) * spacing) / 2;
  const maxRadius = Math.hypot(offset, offset);
  let index = 0;
  for (let column = 0; column < gridSize; column += 1) {
    for (let row = 0; row < gridSize; row += 1) {
      const px = column * spacing - offset;
      const pz = row * spacing - offset;
      x[index] = px;
      z[index] = pz;
      radius[index] = Math.hypot(px, pz) / maxRadius;
      angle[index] = Math.atan2(pz, px);
      seed[index] = hashGrid(column * 1.73 + 17, row * 1.37 - 9);
      macroNoise[index] = fractalNoise(px * 0.16 + 13.7, pz * 0.16 - 8.3);
      detailNoise[index] = fractalNoise(px * 0.37 - 21.1, pz * 0.37 + 17.4);
      colorPhaseA[index] =
        px * 0.41 + pz * 0.19 + (macroNoise[index] ?? 0.5) * 7.1 + (seed[index] ?? 0.5) * 2.3;
      colorPhaseB[index] =
        -px * 0.13 + pz * 0.37 + (detailNoise[index] ?? 0.5) * 8.7 + (seed[index] ?? 0.5) * 5.1;
      colorPhaseHot[index] =
        px * 0.09 - pz * 0.16 + (detailNoise[index] ?? 0.5) * 5.4 + hashGrid(column + 41, row - 23) * 6.283;
      spikeMask[index] = (seed[index] ?? 0) > 0.97 ? 1 : 0;
      index += 1;
    }
  }
  return {
    x,
    z,
    radius,
    angle,
    seed,
    macroNoise,
    detailNoise,
    colorPhaseA,
    colorPhaseB,
    colorPhaseHot,
    spikeMask,
    count,
    spacing,
  };
}

export const SonicTerrain = memo(function SonicTerrain() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const palette = useVisualStore((state) => state.runtimePalette);
  const gridSize = useVisualStore((state) => state.gridSize);
  const quality = useVisualStore((state) => state.effectiveQuality);
  const bandGains = useVisualStore((state) => state.bandGains);
  const motionSpeed = useVisualStore((state) => state.motionSpeed);
  const glowIntensity = useVisualStore((state) => state.glowIntensity);
  const ripplesEnabled = useVisualStore((state) => state.ripplesEnabled);
  const effectiveGridSize = Math.min(gridSize, quality === 'low' ? 48 : quality === 'medium' ? 64 : 80);
  const cells = useMemo(() => createCellMap(effectiveGridSize), [effectiveGridSize]);
  const heights = useMemo(() => new Float32Array(cells.count), [cells.count]);
  const glowLevels = useMemo(() => new Float32Array(cells.count), [cells.count]);
  const glowAttribute = useMemo(() => {
    const attribute = new THREE.InstancedBufferAttribute(glowLevels, 1);
    attribute.setUsage(THREE.DynamicDrawUsage);
    return attribute;
  }, [glowLevels]);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const baseColor = useRef(new THREE.Color(palette.base));
  const secondaryColor = useRef(new THREE.Color(palette.secondary));
  const tertiaryColor = useRef(new THREE.Color(palette.tertiary));
  const accentColor = useRef(new THREE.Color(palette.accent));
  const hotColor = useRef(new THREE.Color(palette.hot));
  const targetBase = useMemo(() => new THREE.Color(palette.base), [palette.base]);
  const targetSecondary = useMemo(() => new THREE.Color(palette.secondary), [palette.secondary]);
  const targetTertiary = useMemo(() => new THREE.Color(palette.tertiary), [palette.tertiary]);
  const targetAccent = useMemo(() => new THREE.Color(palette.accent), [palette.accent]);
  const targetHot = useMemo(() => new THREE.Color(palette.hot), [palette.hot]);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const position = useMemo(() => new THREE.Vector3(), []);
  const scale = useMemo(() => new THREE.Vector3(), []);
  const rotation = useMemo(() => new THREE.Quaternion(), []);
  const color = useMemo(() => new THREE.Color(), []);
  const lastBeat = useRef(0);
  const beatPulse = useRef(0);
  const dynamics = useMemo(() => new TerrainDynamics(), []);
  const ripples = useMemo(() => new RipplePool(), []);
  const uniforms = useRef({
    uGlow: { value: 0.45 + glowIntensity / 100 },
    uAccent: { value: accentColor.current },
    uHot: { value: hotColor.current },
    uMaxHeight: { value: TERRAIN_RESPONSE.maxHeight },
    uTerrainRadius: { value: (TERRAIN_RESPONSE.size * Math.SQRT2) / 2 },
  }).current;

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let index = 0; index < cells.count; index += 1) {
      position.set(cells.x[index] ?? 0, -0.1, cells.z[index] ?? 0);
      scale.set(cells.spacing * 0.82, 0.05, cells.spacing * 0.82);
      matrix.compose(position, rotation, scale);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, baseColor.current);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor.needsUpdate = true;
    }
  }, [cells, matrix, position, rotation, scale]);

  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const frame = audioEngine.getFrame();
    const time = clock.getElapsedTime();
    if (frame.beatCounter !== lastBeat.current) {
      lastBeat.current = frame.beatCounter;
      beatPulse.current = Math.max(beatPulse.current, 0.35 + frame.beatStrength * 0.65);
      if (ripplesEnabled) {
        ripples.trigger(time, 0.35 + frame.beatStrength * 0.9, frame.beatCounter);
      }
    }
    beatPulse.current *= Math.exp(-delta * 5.5);

    const paletteBlend = 1 - Math.exp(-delta * 2.35);
    baseColor.current.lerp(targetBase, paletteBlend);
    secondaryColor.current.lerp(targetSecondary, paletteBlend);
    tertiaryColor.current.lerp(targetTertiary, paletteBlend);
    accentColor.current.lerp(targetAccent, paletteBlend);
    hotColor.current.lerp(targetHot, paletteBlend);
    if (materialRef.current) {
      const glowUniform = materialRef.current.uniforms.uGlow;
      const accentUniform = materialRef.current.uniforms.uAccent;
      const hotUniform = materialRef.current.uniforms.uHot;
      if (glowUniform) glowUniform.value = 0.45 + glowIntensity / 100;
      if (accentUniform) (accentUniform.value as THREE.Color).copy(accentColor.current);
      if (hotUniform) (hotUniform.value as THREE.Color).copy(hotColor.current);
    }

    const bands = dynamics.step(frame.bands, bandGains, delta);
    const b0 = bands[0] ?? 0;
    const b1 = bands[1] ?? 0;
    const b2 = bands[2] ?? 0;
    const b3 = bands[3] ?? 0;
    const b4 = bands[4] ?? 0;
    const b5 = bands[5] ?? 0;
    const b6 = bands[6] ?? 0;
    const b7 = bands[7] ?? 0;
    const response = 1 - Math.exp(-delta * THREE.MathUtils.lerp(3.2, 17, motionSpeed / 100));
    const intro = openingSignal.value;
    const glow = glowIntensity / 100;

    for (let index = 0; index < cells.count; index += 1) {
      const px = cells.x[index] ?? 0;
      const pz = cells.z[index] ?? 0;
      const radius = cells.radius[index] ?? 0;
      const angle = cells.angle[index] ?? 0;
      const seed = cells.seed[index] ?? 0;
      const macroNoise = cells.macroNoise[index] ?? 0.5;
      const detailNoise = cells.detailNoise[index] ?? 0.5;
      const warpedRadius = Math.max(0, radius + (macroNoise - 0.5) * 0.2 + (detailNoise - 0.5) * 0.055);
      const wideFocus = centerEnvelope(warpedRadius, TERRAIN_RESPONSE.wideFocusFalloff);
      const middleFocus = centerEnvelope(warpedRadius, TERRAIN_RESPONSE.middleFocusFalloff);
      const coreFocus = centerEnvelope(warpedRadius, TERRAIN_RESPONSE.coreFocusFalloff);
      const coreTexture = THREE.MathUtils.smoothstep(macroNoise * 0.68 + detailNoise * 0.32, 0.5, 0.82);
      const bassIslands = THREE.MathUtils.smoothstep(
        macroNoise * 0.62 + detailNoise * 0.38 + wideFocus * 0.14,
        0.46,
        0.82,
      );
      const fieldMask = THREE.MathUtils.smoothstep(
        macroNoise * 0.58 + detailNoise * 0.42 + wideFocus * 0.12,
        0.42,
        0.88,
      );
      const subDrive = b0 * 0.3 + beatPulse.current * 0.92;
      const bassDrive = b1 * 0.3 + beatPulse.current * 0.38;
      const centerLift = (coreFocus * 0.56 + middleFocus * 0.44) * coreTexture * subDrive * (1.1 + macroNoise * 2.45);
      const bassWeight =
        bassIslands * bassDrive * (0.15 + wideFocus * 0.85) * (1.2 + detailNoise * 1.2);
      const motionTime = time * THREE.MathUtils.lerp(0.56, 1.12, motionSpeed / 100);
      const sharedPhase = px * 0.22 + pz * 0.13 + macroNoise * 2.7 - motionTime * 0.78;
      const slowField = 0.5 + Math.sin(sharedPhase) * 0.5;
      const companionField = 0.5 + Math.sin(sharedPhase * 0.68 + angle * 0.52 + 1.15) * 0.5;
      const slowWave = Math.pow(slowField, 1.72) * b2 * 0.86 * fieldMask * (0.16 + wideFocus * 0.84);
      const directional = Math.pow(companionField, 1.9) * b3 * 0.68 * fieldMask * (0.12 + middleFocus * 0.88);
      const spikePulse = Math.pow(Math.max(0, Math.sin(time * 2.75 + seed * 6.283)), 3.4);
      const spikeNoise =
        (cells.spikeMask[index] ?? 0) * spikePulse * b4 * (1.35 + detailNoise * 1.4) * (0.16 + middleFocus * 0.84);
      const presenceFlash =
        b5 * (0.28 + beatPulse.current * 1.15) *
        (0.15 + wideFocus * 0.85);
      const edge = THREE.MathUtils.smoothstep(radius, 0.5, 1);
      const edgeSpark = edge * (0.3 + Math.pow(Math.max(0, Math.sin(seed * 31 + time * 2.4)), 8) * 0.7) * b6;
      const air = Math.pow(Math.max(0, Math.sin(seed * 47 - time * 3.2 + angle)), 10) * b7;
      let rippleHeight = 0;
      let rippleGlow = 0;
      if (ripplesEnabled) {
        for (let ripple = 0; ripple < ripples.starts.length; ripple += 1) {
          const age = time - (ripples.starts[ripple] ?? -100);
          if (age < 0 || age > TERRAIN_RESPONSE.rippleDuration) continue;
          const distance = Math.hypot(px - (ripples.originsX[ripple] ?? 0), pz - (ripples.originsZ[ripple] ?? 0));
          const ringRadius = age * TERRAIN_RESPONSE.rippleSpeed;
          const crest = gaussianRing(distance, ringRadius, TERRAIN_RESPONSE.rippleCrestSharpness);
          const halo = gaussianRing(distance, ringRadius, TERRAIN_RESPONSE.rippleHaloSharpness);
          const fade = Math.exp(-age * 0.78) * Math.max(0, 1 - ringRadius / 18.5);
          const strength = (ripples.strengths[ripple] ?? 0) * fade;
          rippleHeight += crest * strength * 0.3;
          rippleGlow += (crest + halo * 0.24) * strength;
        }
        rippleHeight /= 1 + rippleHeight * 0.5;
        rippleGlow /= 1 + rippleGlow * 0.32;
      }
      const revealStart = radius * 0.63;
      const reveal = THREE.MathUtils.smoothstep(intro, revealStart, Math.min(1, revealStart + 0.28));
      const lowContribution = centerLift + bassWeight;
      const midContribution = slowWave + directional;
      const transientContribution = spikeNoise + rippleHeight;
      const normalizedHeight =
        lowContribution / (1 + lowContribution / 3.5) +
        midContribution / (1 + midContribution / 2.35) +
        transientContribution / (1 + transientContribution / 1.8);
      const rawHeight = Math.max(
        0.04,
        TERRAIN_RESPONSE.baseHeight +
          (macroNoise * 0.055 + detailNoise * 0.025) * (0.35 + frame.energy * 0.65) +
          normalizedHeight,
      ) * reveal;
      const target = softLimitHeight(rawHeight, TERRAIN_RESPONSE.maxHeight);
      const current = THREE.MathUtils.lerp(heights[index] ?? 0, target, response);
      heights[index] = current;
      position.set(px, current * 0.5 - 0.18, pz);
      scale.set(cells.spacing * 0.82, Math.max(0.02, current), cells.spacing * 0.82);
      matrix.compose(position, rotation, scale);
      mesh.setMatrixAt(index, matrix);

      const heightEnergy = Math.min(1, current / TERRAIN_RESPONSE.maxHeight);
      const audioGlow = Math.min(
        1,
        (centerLift + bassWeight + slowWave * 0.5 + directional * 0.36 + spikeNoise * 0.46) / 3.8,
      );
      const brightness = Math.min(1, audioGlow * 0.72 + rippleGlow * 0.35 + presenceFlash * 0.18);
      const instanceGlow = Math.min(
        1.65,
        audioGlow * 0.16 +
          rippleGlow * (0.64 + glow * 0.5) +
          presenceFlash * 0.24 +
          edgeSpark * 0.42 +
          air * 0.32 +
          beatPulse.current * coreFocus * 0.12,
      );
      glowLevels[index] = instanceGlow;
      const colorStrength = Math.min(0.86, 0.16 + audioGlow * 0.58 + rippleGlow * 0.12);
      const secondaryWeight = secondaryColorWeight(
        cells.colorPhaseA[index] ?? 0,
        cells.colorPhaseB[index] ?? 0,
        time,
      );
      const hotWeight = hotColorWeight(cells.colorPhaseHot[index] ?? 0, time, brightness);
      const tertiaryWeight = tertiaryColorWeight(
        cells.colorPhaseA[index] ?? 0,
        cells.colorPhaseB[index] ?? 0,
        time,
      );
      color
        .copy(baseColor.current)
        .lerp(accentColor.current, colorStrength * (0.7 - secondaryWeight * 0.07 - tertiaryWeight * 0.04))
        .lerp(secondaryColor.current, colorStrength * secondaryWeight)
        .lerp(tertiaryColor.current, colorStrength * tertiaryWeight);
      if (hotWeight > 0) color.lerp(hotColor.current, Math.min(0.78, hotWeight * 0.72 + rippleGlow * 0.08));
      color.multiplyScalar(0.7 + heightEnergy * glow * 0.34);
      mesh.setColorAt(index, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    glowAttribute.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, cells.count]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]}>
        <primitive attach="attributes-instanceGlow" object={glowAttribute} />
      </boxGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexColors
        vertexShader={terrainVertexShader}
        fragmentShader={terrainFragmentShader}
        uniforms={uniforms}
        toneMapped={false}
      />
    </instancedMesh>
  );
});
