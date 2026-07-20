import { memo, useEffect, useRef } from 'react';

const PARTICLE_COUNT = 96;
const PARTICLE_STRIDE = 8;

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split('').map((part) => part + part).join('')
    : normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function seeded(index: number, salt: number) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43_758.5453;
  return value - Math.floor(value);
}

export const LyricParticles = memo(function LyricParticles({
  lineKey,
  text,
  secondary,
  hot,
  reducedMotion,
}: {
  lineKey: number;
  text: string;
  secondary: string;
  hot: string;
  reducedMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef(new Float32Array(PARTICLE_COUNT * PARTICLE_STRIDE));
  const candidates = useRef(new Int16Array(16_384));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context || reducedMotion || !text) {
      context?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    let animationFrame = 0;
    let cancelled = false;
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(1.5, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    const mask = document.createElement('canvas');
    mask.width = width;
    mask.height = height;
    const maskContext = mask.getContext('2d', { willReadFrequently: true });
    if (!maskContext) return;
    const fontSize = Math.max(24, Math.min(48, width / Math.max(7, text.length * 0.62)));
    maskContext.font = `650 ${fontSize}px "Noto Sans SC Variable", "Noto Sans SC", sans-serif`;
    maskContext.textAlign = 'center';
    maskContext.textBaseline = 'middle';
    maskContext.fillStyle = '#fff';
    maskContext.fillText(text.slice(0, 42), width / 2, height / 2);
    const image = maskContext.getImageData(0, 0, width, height).data;
    let candidateCount = 0;
    for (let y = 2; y < height - 2 && candidateCount < candidates.current.length / 2; y += 3) {
      for (let x = 2; x < width - 2 && candidateCount < candidates.current.length / 2; x += 3) {
        if ((image[(y * width + x) * 4 + 3] ?? 0) > 48) {
          candidates.current[candidateCount * 2] = x;
          candidates.current[candidateCount * 2 + 1] = y;
          candidateCount += 1;
        }
      }
    }

    const values = particles.current;
    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      const base = index * PARTICLE_STRIDE;
      const angle = seeded(index, lineKey) * Math.PI * 2;
      const radius = 54 + seeded(index, lineKey + 19) * Math.max(60, width * 0.34);
      const candidateIndex = candidateCount > 0 ? (index * 97 + lineKey) % candidateCount : 0;
      const targetX = candidateCount > 0 ? candidates.current[candidateIndex * 2] ?? width / 2 : width / 2;
      const targetY = candidateCount > 0 ? candidates.current[candidateIndex * 2 + 1] ?? height / 2 : height / 2;
      values[base] = width / 2 + Math.cos(angle) * radius;
      values[base + 1] = height / 2 + Math.sin(angle) * radius * 0.5;
      values[base + 2] = targetX;
      values[base + 3] = targetY;
      values[base + 4] = targetX + Math.cos(angle) * (34 + seeded(index, 7) * 72);
      values[base + 5] = targetY + Math.sin(angle) * (22 + seeded(index, 11) * 48);
      values[base + 6] = 0.65 + seeded(index, 3) * 1.2;
      values[base + 7] = seeded(index, 5) > 0.76 ? 1 : 0;
    }

    const secondaryColor = colorWithAlpha(secondary, 0.34);
    const hotColor = colorWithAlpha(hot, 0.43);
    const startedAt = performance.now();
    const draw = (now: number) => {
      if (cancelled) return;
      const elapsed = (now - startedAt) / 1000;
      context.clearRect(0, 0, width, height);
      for (let index = 0; index < PARTICLE_COUNT; index += 1) {
        const base = index * PARTICLE_STRIDE;
        const startX = values[base] ?? 0;
        const startY = values[base + 1] ?? 0;
        const targetX = values[base + 2] ?? 0;
        const targetY = values[base + 3] ?? 0;
        const endX = values[base + 4] ?? 0;
        const endY = values[base + 5] ?? 0;
        let x = targetX;
        let y = targetY;
        let alpha = 0.42;
        if (elapsed < 0.32) {
          const progress = Math.min(1, elapsed / 0.32);
          const eased = 1 - (1 - progress) ** 3;
          x = startX + (targetX - startX) * eased;
          y = startY + (targetY - startY) * eased;
          alpha = progress * 0.42;
        } else if (elapsed > 0.4) {
          const progress = Math.min(1, (elapsed - 0.4) / 0.42);
          const eased = progress * progress;
          x = targetX + (endX - targetX) * eased;
          y = targetY + (endY - targetY) * eased;
          alpha = (1 - progress) * 0.42;
        }
        context.globalAlpha = alpha;
        context.fillStyle = (values[base + 7] ?? 0) > 0.5 ? hotColor : secondaryColor;
        context.beginPath();
        context.arc(x, y, values[base + 6] ?? 1, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;
      if (elapsed < 0.84) animationFrame = requestAnimationFrame(draw);
      else context.clearRect(0, 0, width, height);
    };
    animationFrame = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      context.clearRect(0, 0, width, height);
    };
  }, [hot, lineKey, reducedMotion, secondary, text]);

  return <canvas ref={canvasRef} className="lyric-particles" aria-hidden="true" />;
});
