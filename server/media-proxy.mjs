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

export async function fetchWithHeaderTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('等待上游响应超时', 'TimeoutError')), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return { response, controller };
  } finally {
    clearTimeout(timer);
  }
}

async function pipeUpstream(upstream, controller, res) {
  if (!upstream.body) {
    res.end();
    return;
  }
  const abortOnClose = () => {
    if (!res.writableFinished) controller.abort(new DOMException('客户端已停止播放', 'AbortError'));
  };
  res.once('close', abortOnClose);
  let completed = false;
  try {
    await pipeWebBody(upstream.body, res);
    completed = true;
  } catch (error) {
    const expectedAbort = controller.signal.aborted
      && (error?.name === 'AbortError' || error?.name === 'TimeoutError' || error?.code === 'ERR_STREAM_PREMATURE_CLOSE');
    if (!expectedAbort) throw error;
  } finally {
    res.off('close', abortOnClose);
    if (!completed && !controller.signal.aborted) controller.abort(new DOMException('响应已停止', 'AbortError'));
  }
}

export async function proxyImage(source, res) {
  if (!isAllowedCoverUrl(source)) {
    res.status(400).json({ code: 'INVALID_IMAGE_SOURCE', message: '封面地址不在允许列表中', retryable: false });
    return;
  }
  const { response: upstream, controller } = await fetchWithHeaderTimeout(source, {
    headers: { Referer: 'https://music.163.com/', 'User-Agent': 'Mozilla/5.0 SonicAtlas/0.2' },
  }, 12_000);
  res.status(upstream.status);
  copyHeader(upstream, res, 'content-type');
  copyHeader(upstream, res, 'content-length');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  await pipeUpstream(upstream, controller, res);
}

export async function proxyAudio(url, range, res) {
  if (!isAllowedAudioUrl(url)) {
    res.status(502).json({ code: 'INVALID_AUDIO_SOURCE', message: '音频地址不在允许列表中', retryable: false });
    return;
  }
  const headers = {
    Referer: 'https://music.163.com/',
    'User-Agent': 'Mozilla/5.0 SonicAtlas/0.2',
  };
  if (range) headers.Range = range;

  const { response: upstream, controller } = await fetchWithHeaderTimeout(
    url,
    { headers, redirect: 'follow' },
    15_000,
  );
  res.status(upstream.status);
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
    copyHeader(upstream, res, name);
  }
  if (!res.getHeader('content-type')) res.setHeader('content-type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'no-store');
  await pipeUpstream(upstream, controller, res);
}
