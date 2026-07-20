import type { ScenePalette } from '../config/visual';

const ANALYSIS_SIZE = 64;
const CLUSTER_COUNT = 5;
const CACHE_LIMIT = 64;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

interface Cluster {
  l: number;
  a: number;
  b: number;
  count: number;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function srgbToLinear(value: number) {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number) {
  const channel = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.round(clamp(channel, 0, 1) * 255);
}

function rgbToOklab(rgb: Rgb) {
  const r = srgbToLinear(rgb.r);
  const g = srgbToLinear(rgb.g);
  const b = srgbToLinear(rgb.b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

function oklabToRgb(cluster: Pick<Cluster, 'l' | 'a' | 'b'>): Rgb {
  const l = (cluster.l + 0.3963377774 * cluster.a + 0.2158037573 * cluster.b) ** 3;
  const m = (cluster.l - 0.1055613458 * cluster.a - 0.0638541728 * cluster.b) ** 3;
  const s = (cluster.l - 0.0894841775 * cluster.a - 1.291485548 * cluster.b) ** 3;
  return {
    r: linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

function rgbToHsl(rgb: Rgb): Hsl {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  let h = 0;
  if (delta > 0) {
    if (maximum === r) h = 60 * (((g - b) / delta) % 6);
    else if (maximum === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  const l = (maximum + minimum) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number) {
  const normalizedHue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = normalizedHue / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (section < 1) [r, g] = [chroma, x];
  else if (section < 2) [r, g] = [x, chroma];
  else if (section < 3) [g, b] = [chroma, x];
  else if (section < 4) [g, b] = [x, chroma];
  else if (section < 5) [r, b] = [x, chroma];
  else [r, b] = [chroma, x];
  const match = lightness - chroma / 2;
  return `#${[r, g, b]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function colorDistance(first: Cluster, second: Cluster) {
  return Math.hypot(first.l - second.l, first.a - second.a, first.b - second.b);
}

function hueDistance(first: number, second: number) {
  const delta = Math.abs(first - second) % 360;
  return Math.min(delta, 360 - delta);
}

function clusterPixels(data: Uint8ClampedArray) {
  const pixels: Array<{ l: number; a: number; b: number }> = [];
  for (let index = 0; index + 3 < data.length; index += 4) {
    const alpha = data[index + 3] ?? 0;
    if (alpha < 170) continue;
    const rgb = { r: data[index] ?? 0, g: data[index + 1] ?? 0, b: data[index + 2] ?? 0 };
    const luminance = (rgb.r * 0.2126 + rgb.g * 0.7152 + rgb.b * 0.0722) / 255;
    if (luminance < 0.025 || luminance > 0.975) continue;
    pixels.push(rgbToOklab(rgb));
  }
  if (pixels.length < 24) return [];

  const centers: Cluster[] = [];
  let firstIndex = 0;
  let firstScore = -1;
  for (let index = 0; index < pixels.length; index += 1) {
    const pixel = pixels[index];
    if (!pixel) continue;
    const chroma = Math.hypot(pixel.a, pixel.b);
    const midtone = 1 - Math.abs(pixel.l - 0.57);
    const score = chroma * 3.2 + midtone * 0.48;
    if (score > firstScore) {
      firstScore = score;
      firstIndex = index;
    }
  }
  const first = pixels[firstIndex];
  if (!first) return [];
  centers.push({ ...first, count: 0 });

  while (centers.length < CLUSTER_COUNT) {
    let chosen = pixels[centers.length % pixels.length];
    let farthest = -1;
    for (const pixel of pixels) {
      let nearest = Number.POSITIVE_INFINITY;
      for (const center of centers) {
        nearest = Math.min(nearest, colorDistance({ ...pixel, count: 0 }, center));
      }
      const score = nearest * (0.78 + Math.hypot(pixel.a, pixel.b) * 1.7);
      if (score > farthest) {
        farthest = score;
        chosen = pixel;
      }
    }
    if (!chosen) break;
    centers.push({ ...chosen, count: 0 });
  }

  const assignments = new Uint8Array(pixels.length);
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const sums = new Float64Array(centers.length * 3);
    const counts = new Uint32Array(centers.length);
    for (let index = 0; index < pixels.length; index += 1) {
      const pixel = pixels[index];
      if (!pixel) continue;
      let closest = 0;
      let minimum = Number.POSITIVE_INFINITY;
      for (let centerIndex = 0; centerIndex < centers.length; centerIndex += 1) {
        const center = centers[centerIndex];
        if (!center) continue;
        const distance = colorDistance({ ...pixel, count: 0 }, center);
        if (distance < minimum) {
          minimum = distance;
          closest = centerIndex;
        }
      }
      assignments[index] = closest;
      sums[closest * 3] = (sums[closest * 3] ?? 0) + pixel.l;
      sums[closest * 3 + 1] = (sums[closest * 3 + 1] ?? 0) + pixel.a;
      sums[closest * 3 + 2] = (sums[closest * 3 + 2] ?? 0) + pixel.b;
      counts[closest] = (counts[closest] ?? 0) + 1;
    }
    for (let centerIndex = 0; centerIndex < centers.length; centerIndex += 1) {
      const count = counts[centerIndex] ?? 0;
      const center = centers[centerIndex];
      if (!center || count === 0) continue;
      center.l = (sums[centerIndex * 3] ?? 0) / count;
      center.a = (sums[centerIndex * 3 + 1] ?? 0) / count;
      center.b = (sums[centerIndex * 3 + 2] ?? 0) / count;
      center.count = count;
    }
  }
  return centers.filter((center) => center.count > 0);
}

export function paletteFromPixels(data: Uint8ClampedArray, fallback: ScenePalette): ScenePalette {
  const clusters = clusterPixels(data);
  if (clusters.length === 0) return { ...fallback };
  clusters.sort((first, second) => {
    const firstScore = first.count * (0.72 + Math.hypot(first.a, first.b) * 1.6) * (0.78 + first.l * 0.22);
    const secondScore = second.count * (0.72 + Math.hypot(second.a, second.b) * 1.6) * (0.78 + second.l * 0.22);
    return secondScore - firstScore;
  });
  const primaryCluster = clusters[0];
  if (!primaryCluster) return { ...fallback };
  let secondaryCluster = clusters[1] ?? primaryCluster;
  let bestSecondaryScore = -1;
  for (let index = 1; index < clusters.length; index += 1) {
    const candidate = clusters[index];
    if (!candidate) continue;
    const score = colorDistance(primaryCluster, candidate) * Math.sqrt(candidate.count);
    if (score > bestSecondaryScore) {
      bestSecondaryScore = score;
      secondaryCluster = candidate;
    }
  }

  let tertiaryCluster = primaryCluster;
  let bestTertiaryScore = -1;
  for (let index = 1; index < clusters.length; index += 1) {
    const candidate = clusters[index];
    if (!candidate || candidate === secondaryCluster) continue;
    const separation = Math.min(
      colorDistance(primaryCluster, candidate),
      colorDistance(secondaryCluster, candidate),
    );
    const score = separation * Math.sqrt(candidate.count);
    if (score > bestTertiaryScore) {
      bestTertiaryScore = score;
      tertiaryCluster = candidate;
    }
  }

  const primary = rgbToHsl(oklabToRgb(primaryCluster));
  const secondary = rgbToHsl(oklabToRgb(secondaryCluster));
  const tertiary = rgbToHsl(oklabToRgb(tertiaryCluster));
  primary.s = clamp(primary.s, 18, 72);
  primary.l = clamp(primary.l, 38, 62);
  secondary.s = clamp(secondary.s, 20, 68);
  secondary.l = clamp(secondary.l, 36, 62);
  if (hueDistance(primary.h, secondary.h) < 20 || bestSecondaryScore < 0.45) {
    const direction = primary.h < 180 ? 1 : -1;
    secondary.h = (primary.h + direction * 34 + 360) % 360;
    secondary.s = clamp(primary.s * 0.78, 32, 62);
    secondary.l = clamp(primary.l - 4, 39, 54);
  }
  tertiary.s = clamp(tertiary.s, 18, 64);
  tertiary.l = clamp(tertiary.l, 38, 64);
  if (
    bestTertiaryScore < 0.3 ||
    (hueDistance(primary.h, tertiary.h) < 16 && hueDistance(secondary.h, tertiary.h) < 16)
  ) {
    const direction = secondary.h >= primary.h ? -1 : 1;
    tertiary.h = (primary.h + direction * 52 + 360) % 360;
    tertiary.s = clamp(primary.s * 0.68, 24, 58);
    tertiary.l = clamp(primary.l + 3, 41, 61);
  }
  const hotSource = hueDistance(primary.h, tertiary.h) > hueDistance(primary.h, secondary.h) ? tertiary : secondary;
  const hotHue = hueDistance(primary.h, hotSource.h) > 54
    ? hotSource.h
    : primary.h + (hotSource.h - primary.h) * 0.25;
  return {
    background: hslToHex(primary.h, primary.s * 0.2, 4.8),
    fog: hslToHex(primary.h, primary.s * 0.28, 10.5),
    base: hslToHex(primary.h, primary.s * 0.34, 7.2),
    secondary: hslToHex(secondary.h, secondary.s, secondary.l),
    tertiary: hslToHex(tertiary.h, tertiary.s, tertiary.l),
    accent: hslToHex(primary.h, primary.s, primary.l),
    hot: hslToHex(hotHue, clamp(Math.max(primary.s, secondary.s, tertiary.s) * 0.76, 30, 64), 79),
    uiAccent: hslToHex(primary.h, clamp(primary.s * 0.82, 30, 62), clamp(primary.l + 7, 50, 67)),
  };
}

function loadImage(url: string, signal?: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const abort = () => {
      image.src = '';
      reject(new DOMException('Palette analysis aborted', 'AbortError'));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    image.onload = () => {
      signal?.removeEventListener('abort', abort);
      resolve(image);
    };
    image.onerror = () => {
      signal?.removeEventListener('abort', abort);
      reject(new Error('Cover image could not be analysed'));
    };
    image.src = url;
  });
}

export class CoverPaletteEngine {
  private readonly cache = new Map<string, ScenePalette>();

  async analyse(url: string, fallback: ScenePalette, signal?: AbortSignal) {
    const cached = this.cache.get(url);
    if (cached) {
      this.cache.delete(url);
      this.cache.set(url, cached);
      return { ...cached };
    }
    const image = await loadImage(url, signal);
    if (signal?.aborted) throw new DOMException('Palette analysis aborted', 'AbortError');
    const canvas = document.createElement('canvas');
    canvas.width = ANALYSIS_SIZE;
    canvas.height = ANALYSIS_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return { ...fallback };
    context.drawImage(image, 0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE);
    const palette = paletteFromPixels(
      context.getImageData(0, 0, ANALYSIS_SIZE, ANALYSIS_SIZE).data,
      fallback,
    );
    if (signal?.aborted) throw new DOMException('Palette analysis aborted', 'AbortError');
    this.cache.set(url, palette);
    if (this.cache.size > CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value as string | undefined;
      if (oldest) this.cache.delete(oldest);
    }
    return { ...palette };
  }
}

export const coverPaletteEngine = new CoverPaletteEngine();
