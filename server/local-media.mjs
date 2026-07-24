import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const AUDIO_TYPES = new Map([
  ['.mp3', 'audio/mpeg'],
  ['.m4a', 'audio/mp4'],
  ['.aac', 'audio/aac'],
  ['.flac', 'audio/flac'],
  ['.wav', 'audio/wav'],
  ['.wave', 'audio/wav'],
  ['.ogg', 'audio/ogg'],
  ['.opus', 'audio/ogg'],
]);

function parseRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(String(value ?? '').trim());
  if (!match) return null;
  let start = match[1] ? Number(match[1]) : null;
  let end = match[2] ? Number(match[2]) : null;
  if (start === null && end === null) return null;
  if (start === null) {
    const suffix = Math.min(size, end ?? 0);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    end = end === null ? size - 1 : Math.min(end, size - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= size) return null;
  return { start, end };
}

export async function streamLocalAudio(entry, rangeHeader, res) {
  if (!entry || entry.missing) {
    res.status(404).json({ code: 'LOCAL_TRACK_MISSING', message: '本地音乐文件已移动或删除', retryable: false });
    return;
  }
  let stat;
  try {
    stat = await fsp.stat(entry.filePath);
  } catch {
    res.status(404).json({ code: 'LOCAL_TRACK_MISSING', message: '本地音乐文件已移动或删除', retryable: false });
    return;
  }
  const type = AUDIO_TYPES.get(path.extname(entry.filePath).toLowerCase()) ?? 'application/octet-stream';
  res.setHeader('Content-Type', type);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-store');
  let options;
  if (rangeHeader) {
    const range = parseRange(rangeHeader, stat.size);
    if (!range) {
      res.status(416).setHeader('Content-Range', `bytes */${stat.size}`);
      res.end();
      return;
    }
    options = range;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`);
    res.setHeader('Content-Length', range.end - range.start + 1);
  } else {
    res.status(200);
    res.setHeader('Content-Length', stat.size);
  }
  const stream = fs.createReadStream(entry.filePath, options);
  const close = () => stream.destroy();
  res.once('close', close);
  try {
    await pipeline(stream, res);
  } finally {
    res.off('close', close);
  }
}

export async function streamLocalCover(coverPath, res) {
  if (!coverPath) {
    res.status(404).end();
    return;
  }
  try {
    const stat = await fsp.stat(coverPath);
    const extension = path.extname(coverPath).toLowerCase();
    const type = extension === '.png' ? 'image/png'
      : extension === '.webp' ? 'image/webp'
        : extension === '.gif' ? 'image/gif'
          : 'image/jpeg';
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    await pipeline(fs.createReadStream(coverPath), res);
  } catch {
    if (!res.headersSent) res.status(404).end();
    else res.destroy();
  }
}

export function localLyrics(entry) {
  const lyric = String(entry?.lyrics ?? '');
  return { lyric, translatedLyric: '', noLyric: !lyric.trim() };
}

export const __test = { parseRange };
