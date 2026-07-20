import path from 'node:path';
import express from 'express';
import { createNeteaseService, NeteaseError } from './netease-service.mjs';
import { proxyAudio, proxyImage } from './media-proxy.mjs';

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function sendError(res, error) {
  if (error instanceof NeteaseError) {
    res.status(error.status).json({ code: error.code, message: error.message, retryable: error.retryable });
    return;
  }
  res.status(500).json({ code: 'INTERNAL_ERROR', message: '本地服务处理请求时发生错误', retryable: true });
}

export async function startLocalServer({ distDir, dev = false, getCookie, getPersistence }) {
  const app = express();
  const netease = createNeteaseService({ getCookie, getPersistence });
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use((req, res, next) => {
    const origin = String(req.headers.origin ?? '');
    if (dev && /^http:\/\/127\.0\.0\.1:5173$/.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'sonic-atlas' }));

  app.get('/api/netease/auth/status', async (_req, res) => {
    res.json(await netease.getAuthStatus());
  });

  app.get('/api/netease/search', async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (!q) {
      res.status(400).json({ code: 'MISSING_QUERY', message: '请输入歌曲或歌手名称', retryable: false });
      return;
    }
    try {
      res.json(await netease.search({
        q,
        limit: clampInteger(req.query.limit, 30, 1, 50),
        offset: clampInteger(req.query.offset, 0, 0, 10_000),
      }));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/netease/playlists', async (req, res) => {
    try {
      res.json(await netease.playlists({
        limit: clampInteger(req.query.limit, 50, 1, 100),
        offset: clampInteger(req.query.offset, 0, 0, 10_000),
      }));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/netease/playlists/:id/tracks', async (req, res) => {
    try {
      res.json(await netease.playlistTracks({
        id: String(req.params.id),
        limit: clampInteger(req.query.limit, 100, 1, 200),
        offset: clampInteger(req.query.offset, 0, 0, 50_000),
      }));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/netease/tracks/:id/playback', async (req, res) => {
    try {
      const playback = await netease.playback(String(req.params.id));
      res.json({ ...playback, upstreamUrl: undefined, streamUrl: `/api/netease/tracks/${encodeURIComponent(req.params.id)}/stream` });
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/netease/tracks/:id/stream', async (req, res) => {
    try {
      const playback = await netease.playback(String(req.params.id));
      await proxyAudio(playback.upstreamUrl, req.headers.range, res);
    } catch (error) {
      if (!res.headersSent) sendError(res, error);
      else res.destroy();
    }
  });

  app.get('/api/netease/tracks/:id/lyrics', async (req, res) => {
    try {
      res.json(await netease.lyrics(String(req.params.id)));
    } catch (error) {
      sendError(res, error);
    }
  });

  app.get('/api/media/image', async (req, res) => {
    try {
      await proxyImage(String(req.query.source ?? ''), res);
    } catch {
      if (!res.headersSent) {
        res.status(502).json({ code: 'IMAGE_PROXY_FAILED', message: '封面加载失败', retryable: true });
      } else {
        res.destroy();
      }
    }
  });

  if (!dev) {
    app.use(express.static(distDir, { maxAge: '1h', index: false }));
    app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
    instance.on('error', reject);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    url: `http://127.0.0.1:${port}`,
    netease,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
