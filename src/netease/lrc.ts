import type { LyricLine } from './types';

const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const OFFSET_TAG = /\[offset:([+-]?\d+)\]/i;

function fractionToMs(value: string | undefined) {
  if (!value) return 0;
  if (value.length === 1) return Number(value) * 100;
  if (value.length === 2) return Number(value) * 10;
  return Number(value.slice(0, 3));
}

export function parseLrc(raw: string): LyricLine[] {
  const offset = Number(raw.match(OFFSET_TAG)?.[1] ?? 0);
  const lines: LyricLine[] = [];
  for (const sourceLine of raw.split(/\r?\n/)) {
    const text = sourceLine.replace(TIME_TAG, '').trim();
    if (!text) continue;
    TIME_TAG.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = TIME_TAG.exec(sourceLine))) {
      const minutes = Number(match[1] ?? 0);
      const seconds = Number(match[2] ?? 0);
      const timeMs = Math.max(0, minutes * 60_000 + seconds * 1_000 + fractionToMs(match[3]) + offset);
      lines.push({ timeMs, text });
    }
  }
  return lines.sort((a, b) => a.timeMs - b.timeMs);
}

export function mergeLyrics(original: string, translated: string): LyricLine[] {
  const base = parseLrc(original);
  const translations = parseLrc(translated);
  let translationIndex = 0;
  return base.map((line) => {
    while (
      translationIndex + 1 < translations.length &&
      Math.abs((translations[translationIndex + 1]?.timeMs ?? 0) - line.timeMs) <=
        Math.abs((translations[translationIndex]?.timeMs ?? 0) - line.timeMs)
    ) {
      translationIndex += 1;
    }
    const candidate = translations[translationIndex];
    return candidate && Math.abs(candidate.timeMs - line.timeMs) <= 220
      ? { ...line, translation: candidate.text }
      : line;
  });
}

export function activeLyricIndex(lines: LyricLine[], timeMs: number) {
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if ((lines[middle]?.timeMs ?? Number.POSITIVE_INFINITY) <= timeMs) {
      result = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return result;
}
