import type { LyricLine } from '../netease/types';

const segmenter = typeof Intl.Segmenter === 'function'
  ? new Intl.Segmenter('zh-CN', { granularity: 'grapheme' })
  : null;

export function segmentGraphemes(value: string) {
  if (!segmenter) return Array.from(value);
  return Array.from(segmenter.segment(value), (entry) => entry.segment);
}

export function lyricWindow(lines: LyricLine[], activeIndex: number, radius = 2) {
  if (activeIndex < 0 || lines.length === 0) return [];
  const result: Array<{ line: LyricLine; index: number; offset: number }> = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    const index = activeIndex + offset;
    const line = lines[index];
    if (line) result.push({ line, index, offset });
  }
  return result;
}

export function characterDrift(text: string, index: number) {
  let hash = 2_166_136_261;
  for (let cursor = 0; cursor < text.length; cursor += 1) {
    hash ^= text.charCodeAt(cursor) + index * 17;
    hash = Math.imul(hash, 16_777_619);
  }
  const angle = ((hash >>> 0) % 6283) / 1000;
  const distance = 7 + ((hash >>> 8) % 9);
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance - 4,
    rotate: ((hash >>> 16) % 9) - 4,
  };
}
