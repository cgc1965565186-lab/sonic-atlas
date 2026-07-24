import { audioEngine } from '../audio/AudioEngine';
import { usePlayerStore } from '../store/playerStore';
import { useUiStore } from '../store/uiStore';
import { useVisualStore } from '../store/visualStore';
import type { LyricMotionMode } from '../store/visualStore';

export type ExportAspect = 'window' | '16:9' | '9:16' | '1:1';
export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ExportOptions {
  aspect: ExportAspect;
  customText: string;
  watermarkPosition: WatermarkPosition;
  watermarkOpacity: number;
}

function outputSize(aspect: ExportAspect, source: HTMLCanvasElement) {
  if (aspect === '16:9') return { width: 1920, height: 1080 };
  if (aspect === '9:16') return { width: 1080, height: 1920 };
  if (aspect === '1:1') return { width: 1440, height: 1440 };
  const scale = Math.min(1, 1920 / source.width, 1080 / source.height);
  return { width: Math.max(640, Math.round(source.width * scale)), height: Math.max(360, Math.round(source.height * scale)) };
}

function sceneCanvas() {
  const canvas = document.querySelector<HTMLCanvasElement>('.scene-shell canvas');
  if (!canvas) throw new Error('声音地形尚未准备好');
  return canvas;
}

function drawCover(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, context: CanvasRenderingContext2D, width: number, height: number) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

export function lyricExportMotion(
  mode: LyricMotionMode,
  elapsedMs: number,
  durationMs: number,
  intensity: number,
) {
  const progress = clamp(elapsedMs / Math.max(1, durationMs));
  const entry = easeOutCubic(clamp(progress / 0.2));
  const strength = clamp(intensity);
  if (mode === 'breathe') {
    const pulse = (Math.sin(progress * Math.PI * 4) + 1) / 2;
    return { opacity: 0.82 + pulse * 0.18, y: -pulse * 3 * strength, scale: 0.994 + pulse * 0.024 * strength, blur: 0, highlight: pulse };
  }
  if (mode === 'glow') {
    return { opacity: 0.78 + entry * 0.22, y: (1 - entry) * 10, scale: 1, blur: (1 - entry) * 3, highlight: progress };
  }
  if (mode === 'depth') {
    const drift = Math.sin(progress * Math.PI * 2);
    return { opacity: 0.68 + entry * 0.32, y: (1 - entry) * 18 - drift * 3 * strength, scale: 0.98 + entry * 0.02, blur: (1 - entry) * 7, highlight: entry };
  }
  if (mode === 'cinematic') {
    return { opacity: entry, y: (1 - entry) * 22 * strength, scale: 0.985 + entry * 0.015, blur: (1 - entry) * 8, highlight: clamp(progress / 0.72) };
  }
  return { opacity: 1, y: 0, scale: 1, blur: 0, highlight: 1 };
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}

function drawBackdrop(context: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, 'rgba(2,3,3,.36)');
  gradient.addColorStop(0.48, 'rgba(2,3,3,.04)');
  gradient.addColorStop(1, 'rgba(2,3,3,.42)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  const vignette = context.createRadialGradient(width * 0.5, height * 0.44, height * 0.12, width * 0.5, height * 0.44, Math.max(width, height) * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,.52)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}

function drawSonicHud(context: CanvasRenderingContext2D, width: number, height: number) {
  const player = usePlayerStore.getState();
  const visual = useVisualStore.getState();
  const track = player.currentTrack;
  if (!track) return;
  const scale = Math.max(0.8, Math.min(1.5, width / 1440));
  const x = width * 0.06;
  const y = height * 0.068;
  const boxWidth = Math.min(width * 0.54, 620 * scale);
  const boxHeight = 92 * scale;
  context.save();
  context.fillStyle = 'rgba(6,8,8,.54)';
  context.strokeStyle = 'rgba(255,255,255,.13)';
  context.lineWidth = Math.max(1, scale);
  context.beginPath();
  context.roundRect(x, y, boxWidth, boxHeight, 18 * scale);
  context.fill();
  context.stroke();

  const orbX = x + 28 * scale;
  const orbY = y + boxHeight / 2;
  const orb = context.createRadialGradient(orbX - 5 * scale, orbY - 6 * scale, 1, orbX, orbY, 19 * scale);
  orb.addColorStop(0, visual.runtimePalette.hot);
  orb.addColorStop(0.35, visual.runtimePalette.accent);
  orb.addColorStop(1, visual.runtimePalette.base);
  context.fillStyle = orb;
  context.beginPath();
  context.arc(orbX, orbY, 19 * scale, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(255,255,255,.18)';
  context.stroke();

  const copyX = x + 62 * scale;
  context.textAlign = 'left';
  context.textBaseline = 'top';
  context.fillStyle = 'rgba(246,243,235,.96)';
  context.font = `600 ${15 * scale}px "Noto Sans SC", sans-serif`;
  context.fillText(track.title.slice(0, 42), copyX, y + 17 * scale, boxWidth - 82 * scale);
  context.fillStyle = 'rgba(238,235,228,.55)';
  context.font = `500 ${9 * scale}px "Noto Sans SC", sans-serif`;
  context.fillText(`${track.artists.join(' / ').slice(0, 52)}  ·  ${track.source === 'local' ? 'LOCAL' : 'NETEASE'}`, copyX, y + 43 * scale, boxWidth - 82 * scale);
  const progress = player.duration > 0 ? clamp(player.currentTime / player.duration) : 0;
  const progressY = y + 68 * scale;
  const progressWidth = boxWidth - 92 * scale;
  context.fillStyle = 'rgba(255,255,255,.12)';
  context.fillRect(copyX, progressY, progressWidth, 2 * scale);
  context.fillStyle = visual.runtimePalette.hot;
  context.fillRect(copyX, progressY, progressWidth * progress, 2 * scale);
  context.fillStyle = 'rgba(238,235,228,.48)';
  context.font = `600 ${8 * scale}px Manrope, sans-serif`;
  context.fillText(`${formatTime(player.currentTime)}  /  ${formatTime(player.duration)}`, copyX, progressY + 7 * scale);
  context.restore();
}

function lyricTextX(alignment: 'left' | 'center', width: number) {
  return alignment === 'center' ? width / 2 : width * 0.085;
}

function drawLyrics(context: CanvasRenderingContext2D, width: number, height: number) {
  const player = usePlayerStore.getState();
  const visual = useVisualStore.getState();
  const active = player.lyrics[player.activeLyricIndex];
  if (!active?.text) return;
  const next = player.lyrics[player.activeLyricIndex + 1];
  const durationMs = clamp((next?.timeMs ?? active.timeMs + 3_600) - active.timeMs, 1_200, 9_000);
  const elapsedMs = Math.max(0, player.currentTime * 1_000 - active.timeMs);
  const motion = lyricExportMotion(visual.lyricMotion, elapsedMs, durationMs, visual.lyricMotionIntensity / 100);
  const portrait = height > width * 1.25;
  const fontSize = Math.round(Math.max(30, Math.min(width * (portrait ? 0.062 : 0.042), height * 0.066)) * (visual.lyricSize / 58));
  const x = lyricTextX(visual.lyricAlignment, width);
  const y = height * (portrait ? 0.31 : 0.36);
  const maxWidth = width * (portrait ? 0.84 : 0.74);

  context.save();
  context.textAlign = visual.lyricAlignment;
  context.textBaseline = 'middle';
  context.shadowColor = 'rgba(0,0,0,.78)';
  context.shadowBlur = 28;
  context.font = `600 ${fontSize}px "Noto Sans SC", sans-serif`;
  const contextLines = [
    { line: player.lyrics[player.activeLyricIndex - 1], offset: -1 },
    { line: player.lyrics[player.activeLyricIndex + 1], offset: 1 },
  ];
  for (const { line, offset } of contextLines) {
    if (!line?.text) continue;
    context.fillStyle = `rgba(241,238,231,${0.24 * (visual.lyricContextOpacity / 36)})`;
    context.font = `500 ${Math.round(fontSize * 0.34)}px "Noto Sans SC", sans-serif`;
    context.fillText(line.text.slice(0, 92), x, y + offset * fontSize * 1.42, maxWidth);
  }

  context.translate(x, y + motion.y);
  context.scale(motion.scale, motion.scale);
  context.globalAlpha = motion.opacity;
  context.filter = motion.blur > 0.1 ? `blur(${motion.blur}px)` : 'none';
  context.font = `600 ${fontSize}px "Noto Sans SC", sans-serif`;
  context.fillStyle = 'rgba(245,242,235,.94)';
  context.fillText(active.text.slice(0, 92), 0, 0, maxWidth);

  if (visual.lyricMotion === 'glow') {
    const measured = Math.min(maxWidth, context.measureText(active.text.slice(0, 92)).width);
    const left = visual.lyricAlignment === 'center' ? -measured / 2 : 0;
    context.save();
    context.beginPath();
    context.rect(left - fontSize * 0.08, -fontSize, (measured + fontSize * 0.16) * motion.highlight, fontSize * 2);
    context.clip();
    context.fillStyle = visual.runtimePalette.hot;
    context.shadowColor = visual.runtimePalette.accent;
    context.shadowBlur = 30;
    context.fillText(active.text.slice(0, 92), 0, 0, maxWidth);
    context.restore();
  } else if (visual.lyricMotion === 'cinematic') {
    const lineWidth = maxWidth * 0.6 * motion.highlight;
    const startX = visual.lyricAlignment === 'center' ? -lineWidth / 2 : 0;
    const sheen = context.createLinearGradient(startX, 0, startX + Math.max(1, lineWidth), 0);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.5, visual.runtimePalette.hot);
    sheen.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = sheen;
    context.globalAlpha = motion.opacity * 0.65;
    context.fillRect(startX, fontSize * 0.66, lineWidth, Math.max(2, fontSize * 0.035));
  }
  context.filter = 'none';
  if (active.translation) {
    context.globalAlpha = Math.min(0.68, motion.opacity);
    context.fillStyle = 'rgba(245,242,235,.68)';
    context.font = `450 ${Math.round(fontSize * 0.36)}px "Noto Sans SC", sans-serif`;
    context.fillText(active.translation.slice(0, 110), 0, fontSize * 0.92, maxWidth);
  }
  context.restore();
}

function drawAudioSignature(context: CanvasRenderingContext2D, width: number, height: number) {
  const frame = audioEngine.getFrame();
  const visual = useVisualStore.getState();
  const scale = Math.max(0.8, Math.min(1.5, width / 1440));
  const count = 28;
  const gap = 4 * scale;
  const barWidth = 3 * scale;
  const totalWidth = count * barWidth + (count - 1) * gap;
  const x = width * 0.06;
  const baseline = height * 0.88;
  context.save();
  context.fillStyle = 'rgba(240,237,230,.48)';
  context.font = `700 ${8 * scale}px Manrope, sans-serif`;
  context.textAlign = 'left';
  context.fillText('LIVE SONIC TOPOGRAPHY', x, baseline - 34 * scale);
  for (let index = 0; index < count; index += 1) {
    const band = frame.bands[index % frame.bands.length] ?? 0;
    const shaped = 0.16 + band * 0.84;
    const barHeight = (8 + shaped * 38) * scale;
    const gradient = context.createLinearGradient(0, baseline - barHeight, 0, baseline);
    gradient.addColorStop(0, visual.runtimePalette.hot);
    gradient.addColorStop(1, visual.runtimePalette.accent);
    context.fillStyle = gradient;
    context.globalAlpha = 0.46 + shaped * 0.5;
    context.fillRect(x + index * (barWidth + gap), baseline - barHeight, barWidth, barHeight);
  }
  context.globalAlpha = 0.3;
  context.fillStyle = 'rgba(240,237,230,.7)';
  context.fillRect(x, baseline + 8 * scale, totalWidth, Math.max(1, scale));
  context.restore();
}

function watermarkOrigin(position: WatermarkPosition, width: number, height: number, boxWidth: number, boxHeight: number) {
  const margin = Math.max(30, width * 0.035);
  return {
    x: position.endsWith('right') ? width - margin - boxWidth : margin,
    y: position.startsWith('bottom') ? height - margin - boxHeight : margin,
  };
}

export function renderExportFrame(target: HTMLCanvasElement, options: ExportOptions) {
  const source = sceneCanvas();
  const context = target.getContext('2d');
  if (!context) throw new Error('无法创建导出画布');
  context.fillStyle = '#0c0d0d';
  context.fillRect(0, 0, target.width, target.height);
  drawCover(source, source.width, source.height, context, target.width, target.height);
  drawBackdrop(context, target.width, target.height);

  const ui = useUiStore.getState();
  const shouldDrawLyrics = (!ui.immersive && !ui.fullscreen) || ui.immersiveLyricsVisible;
  drawSonicHud(context, target.width, target.height);
  if (shouldDrawLyrics) drawLyrics(context, target.width, target.height);
  drawAudioSignature(context, target.width, target.height);

  const brand = 'SONIC ATLAS';
  const custom = options.customText.trim().slice(0, 40);
  const scale = Math.max(1, target.width / 1440);
  const boxWidth = 250 * scale;
  const boxHeight = custom ? 72 * scale : 52 * scale;
  const origin = watermarkOrigin(options.watermarkPosition, target.width, target.height, boxWidth, boxHeight);
  context.save();
  context.globalAlpha = Math.max(0.35, Math.min(0.9, options.watermarkOpacity));
  context.fillStyle = 'rgba(9, 10, 10, .58)';
  context.strokeStyle = 'rgba(255, 255, 255, .18)';
  context.lineWidth = Math.max(1, scale);
  context.beginPath();
  context.roundRect(origin.x, origin.y, boxWidth, boxHeight, 14 * scale);
  context.fill();
  context.stroke();
  context.fillStyle = '#f0ede6';
  context.textAlign = 'left';
  context.textBaseline = 'middle';
  context.font = `700 ${14 * scale}px Manrope, sans-serif`;
  context.fillText(brand, origin.x + 18 * scale, origin.y + 24 * scale);
  if (custom) {
    context.fillStyle = 'rgba(240, 237, 230, .65)';
    context.font = `500 ${11 * scale}px "Noto Sans SC", sans-serif`;
    context.fillText(custom, origin.x + 18 * scale, origin.y + 49 * scale, boxWidth - 36 * scale);
  }
  context.restore();
}

function createOutputCanvas(options: ExportOptions) {
  const source = sceneCanvas();
  const size = outputSize(options.aspect, source);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  return canvas;
}

async function blobToBase64(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const step = 0x8000;
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step));
  }
  return btoa(binary);
}

async function save(blob: Blob, format: 'png' | 'mp4' | 'webm') {
  if (window.sonicAtlas) {
    return window.sonicAtlas.saveExport({ format, base64: await blobToBase64(blob) });
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `Sonic-Atlas-${Date.now()}.${format}`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
  return true;
}

export async function exportScreenshot(options: ExportOptions) {
  const canvas = createOutputCanvas(options);
  renderExportFrame(canvas, options);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('截图生成失败')), 'image/png'));
  return save(blob, 'png');
}

export async function recordVisualClip(
  options: ExportOptions,
  durationSeconds: 5 | 10 | 15,
  includeAudio: boolean,
  onProgress: (progress: number) => void,
) {
  const duration = Math.min(15, Math.max(5, durationSeconds));
  const canvas = createOutputCanvas(options);
  const videoStream = canvas.captureStream(30);
  let restorePausedState = false;
  let animationFrame = 0;
  let recorder: MediaRecorder | null = null;
  try {
    if (includeAudio) {
      const audioStream = await audioEngine.getCaptureStream();
      const sourceTracks = audioStream.getAudioTracks().filter((track) => track.readyState === 'live');
      if (sourceTracks.length === 0) throw new Error('无法建立音频录制通道');
      if (!audioEngine.getStatus().playing) {
        if (!usePlayerStore.getState().currentTrack) throw new Error('请先选择一首歌曲');
        restorePausedState = true;
        await usePlayerStore.getState().toggle();
        const playbackStartedAt = performance.now();
        while (!audioEngine.getStatus().playing && performance.now() - playbackStartedAt < 4_000) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
        }
        if (!audioEngine.getStatus().playing) throw new Error('歌曲未能开始播放，已取消无声视频');
      }
      for (const track of sourceTracks) videoStream.addTrack(track.clone());
    }
    const mp4Type = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2';
    const webmType = 'video/webm;codecs=vp9,opus';
    const mimeType = MediaRecorder.isTypeSupported(mp4Type) ? mp4Type : webmType;
    const format = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
    recorder = new MediaRecorder(videoStream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    const completed = new Promise<Blob>((resolve, reject) => {
      if (!recorder) return reject(new Error('短片录制失败'));
      recorder.onerror = () => reject(new Error('短片录制失败'));
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });
    const startedAt = performance.now();
    const draw = () => {
      renderExportFrame(canvas, options);
      onProgress(Math.min(1, (performance.now() - startedAt) / (duration * 1_000)));
      animationFrame = requestAnimationFrame(draw);
    };
    recorder.start(500);
    animationFrame = requestAnimationFrame(draw);
    await new Promise<void>((resolve) => window.setTimeout(resolve, duration * 1_000));
    cancelAnimationFrame(animationFrame);
    recorder.stop();
    const blob = await completed;
    onProgress(1);
    await save(blob, format);
    return format;
  } finally {
    cancelAnimationFrame(animationFrame);
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    for (const track of videoStream.getTracks()) track.stop();
    if (restorePausedState && audioEngine.getStatus().playing) {
      await audioEngine.toggle().catch(() => undefined);
    }
  }
}
