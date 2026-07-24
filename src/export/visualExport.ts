import { audioEngine } from '../audio/AudioEngine';
import { usePlayerStore } from '../store/playerStore';
import { useUiStore } from '../store/uiStore';
import { useVisualStore } from '../store/visualStore';

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
  context.fillStyle = 'rgba(4, 5, 5, .16)';
  context.fillRect(0, 0, target.width, target.height);

  const ui = useUiStore.getState();
  const player = usePlayerStore.getState();
  const visual = useVisualStore.getState();
  const shouldDrawLyrics = (!ui.immersive && !ui.fullscreen) || ui.immersiveLyricsVisible;
  const active = player.lyrics[player.activeLyricIndex];
  if (shouldDrawLyrics && active?.text) {
    const fontSize = Math.round(Math.max(32, target.width * 0.034) * (visual.lyricSize / 58));
    context.save();
    context.textAlign = visual.lyricAlignment;
    context.textBaseline = 'middle';
    context.font = `600 ${fontSize}px "Noto Sans SC", sans-serif`;
    context.fillStyle = 'rgba(245, 242, 235, .94)';
    context.shadowColor = 'rgba(0,0,0,.7)';
    context.shadowBlur = 24;
    const x = visual.lyricAlignment === 'center' ? target.width / 2 : target.width * 0.09;
    const y = target.height * 0.44;
    context.fillText(active.text.slice(0, 72), x, y, target.width * 0.82);
    if (active.translation) {
      context.font = `400 ${Math.round(fontSize * 0.42)}px "Noto Sans SC", sans-serif`;
      context.fillStyle = 'rgba(245, 242, 235, .6)';
      context.fillText(active.translation.slice(0, 100), x, y + fontSize * 0.8, target.width * 0.82);
    }
    context.restore();
  }

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
  if (includeAudio) {
    const audioStream = await audioEngine.getCaptureStream();
    for (const track of audioStream.getAudioTracks()) videoStream.addTrack(track.clone());
  }
  const mp4Type = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2';
  const webmType = 'video/webm;codecs=vp9,opus';
  const mimeType = MediaRecorder.isTypeSupported(mp4Type) ? mp4Type : webmType;
  const format = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
  const recorder = new MediaRecorder(videoStream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  const completed = new Promise<Blob>((resolve, reject) => {
    recorder.onerror = () => reject(new Error('短片录制失败'));
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });
  let animationFrame = 0;
  const startedAt = performance.now();
  const draw = () => {
    renderExportFrame(canvas, options);
    onProgress(Math.min(1, (performance.now() - startedAt) / (duration * 1_000)));
    animationFrame = requestAnimationFrame(draw);
  };
  try {
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
    if (recorder.state !== 'inactive') recorder.stop();
    for (const track of videoStream.getTracks()) track.stop();
  }
}
