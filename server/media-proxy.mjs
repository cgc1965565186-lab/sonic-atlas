import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const COVER_HOSTS = ['music.126.net', 'music.163.com'];

function isAllowedHost(hostname) {
  return COVER_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export function isAllowedCoverUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && isAllowedHost(url.hostname);
  } catch {
    return false;
  }
}

export function normalizeCoverSource(value) {
  try {
    const candidate = String(value ?? '').startsWith('//') ? `https:${value}` : String(value ?? '');
    const url = new URL(candidate);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !isAllowedHost(url.hostname)) return '';
    url.protocol = 'https:';
    return url.href;
  } catch {
    return '';
  }
}

export function isAllowedAudioUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && isAllowedHost(url.hostname);
  } catch {
    return false;
  }
}

function copyHeader(from, to, name) {
  const value = from.headers.get(name);
  if (value) to.setHeader(name, value);
}

export async function pipeWebBody(body, destination) {
  await pipeline(Readable.fromWeb(body), destination);
}

export async function proxyImage(source, res) {
  if (!isAllowedCoverUrl(source)) {
    res.status(400).json({ code: 'INVALID_IMAGE_SOURCE', message: '封面地址不在允许列表中', retryable: false });
    return;
  }
  const upstream = await fetch(source, {
    headers: { Referer: 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0 SonicAtlas/0.1' },
    signal: AbortSignal.timeout(12_000),
  });
  res.status(upstream.status);
  copyHeader(upstream, res, 'content-type');
  copyHeader(upstream, res, 'content-length');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  if (!upstream.body) {
    res.end();
    return;
  }
  await pipeWebBody(upstream.body, res);
}

export async function proxyAudio(url, range, res) {
  if (!isAllowedAudioUrl(url)) {
    res.status(502).json({ code: 'INVALID_AUDIO_SOURCE', message: '音频地址不在允许列表中', retryable: false });
    return;
  }
  const headers = {
    Referer: 'https://music.163.com/',
    'User-Agent': 'Mozilla/5.0 SonicAtlas/0.1',
  };
  if (range) headers.Range = range;

  const upstream = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(15_000) });
  res.status(upstream.status);
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    copyHeader(upstream, res, name);
  }
  if (!res.getHeader('content-type')) res.setHeader('content-type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-store');
  if (!upstream.body) {
    res.end();
    return;
  }
  await pipeWebBody(upstream.body, res);
}
