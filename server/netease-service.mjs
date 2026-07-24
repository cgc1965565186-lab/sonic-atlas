import { createRequire } from 'node:module';
import { normalizeCoverSource } from './media-proxy.mjs';

const require = createRequire(import.meta.url);
const neteaseApi = require('NeteaseCloudMusicApi');

export class NeteaseError extends Error {
  constructor(code, message, status = 502, retryable = true) {
    super(message);
    this.name = 'NeteaseError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

function getApi(name) {
  const handler = neteaseApi[name];
  if (typeof handler !== 'function') {
    throw new NeteaseError('API_UNAVAILABLE', `网易云接口 ${name} 当前不可用`, 501, false);
  }
  return handler;
}

async function callApi(name, query) {
  try {
    const response = await getApi(name)({ ...query, timestamp: Date.now() });
    if (response.status >= 400) {
      throw new NeteaseError('UPSTREAM_REJECTED', '网易云拒绝了本次请求', response.status, response.status >= 500);
    }
    return response.body ?? {};
  } catch (error) {
    if (error instanceof NeteaseError) throw error;
    const status = Number(error?.status ?? error?.response?.status ?? 502);
    throw new NeteaseError(
      'UPSTREAM_ERROR',
      status === 401 || status === 301 ? '网易云登录已失效，请重新扫码' : '网易云服务暂时不可用',
      status,
      status >= 500,
    );
  }
}

function imageProxyUrl(source) {
  const normalized = normalizeCoverSource(source);
  return normalized ? `/api/media/image?source=${encodeURIComponent(normalized)}` : '';
}

export function normalizeSong(song) {
  const artists = song.ar ?? song.artists ?? [];
  const album = song.al ?? song.album ?? {};
  const coverSource = album.picUrl ?? song.picUrl ?? '';
  return {
    id: String(song.id ?? ''),
    source: 'netease',
    title: String(song.name ?? '未知曲目'),
    artists: artists.map((artist) => String(artist.name ?? '')).filter(Boolean),
    album: {
      id: String(album.id ?? ''),
      name: String(album.name ?? ''),
    },
    durationMs: Number(song.dt ?? song.duration ?? 0),
    coverUrl: imageProxyUrl(coverSource),
    availability: 'unknown',
  };
}

function extractProfile(body) {
  const profile = body?.data?.profile ?? body?.profile ?? body?.account?.profile ?? null;
  const account = body?.data?.account ?? body?.account ?? null;
  const id = profile?.userId ?? account?.id ?? null;
  if (!id) return null;
  return {
    id: String(id),
    nickname: String(profile?.nickname ?? '网易云用户'),
    avatarUrl: imageProxyUrl(profile?.avatarUrl ?? ''),
  };
}

export function createNeteaseService({ getCookie, getPersistence }) {
  async function getAuthStatus(cookieOverride) {
    const cookie = cookieOverride ?? getCookie();
    if (!cookie) {
      return { authenticated: false, persistence: getPersistence(), user: null };
    }
    try {
      const body = await callApi('login_status', { cookie });
      const user = extractProfile(body);
      return { authenticated: Boolean(user), persistence: getPersistence(), user };
    } catch {
      return { authenticated: false, persistence: getPersistence(), user: null };
    }
  }

  async function search({ q, limit, offset }) {
    const body = await callApi('cloudsearch', {
      keywords: q,
      type: 1,
      limit,
      offset,
      cookie: getCookie(),
    });
    const songs = (body?.result?.songs ?? []).map(normalizeSong);
    return {
      songs,
      total: Number(body?.result?.songCount ?? songs.length),
      hasMore: offset + songs.length < Number(body?.result?.songCount ?? songs.length),
    };
  }

  async function playlists({ limit, offset }) {
    const auth = await getAuthStatus();
    if (!auth.authenticated || !auth.user) {
      throw new NeteaseError('AUTH_REQUIRED', '请先扫码登录网易云音乐', 401, false);
    }
    const body = await callApi('user_playlist', {
      uid: auth.user.id,
      limit,
      offset,
      cookie: getCookie(),
    });
    const list = (body?.playlist ?? []).map((playlist) => ({
      id: String(playlist.id ?? ''),
      title: String(playlist.name ?? '未命名歌单'),
      coverUrl: imageProxyUrl(playlist.coverImgUrl ?? ''),
      trackCount: Number(playlist.trackCount ?? 0),
      creator: String(playlist.creator?.nickname ?? ''),
      owned: String(playlist.creator?.userId ?? '') === auth.user.id,
    }));
    return {
      playlists: list,
      hasMore: Boolean(body?.more),
    };
  }

  async function playlistTracks({ id, limit, offset }) {
    const body = await callApi('playlist_track_all', {
      id,
      limit,
      offset,
      cookie: getCookie(),
    });
    const songs = (body?.songs ?? []).map(normalizeSong);
    return {
      songs,
      total: Number(body?.count ?? offset + songs.length),
      hasMore: Boolean(body?.more) || songs.length === limit,
    };
  }

  async function playback(id) {
    const body = await callApi('song_url_v1', {
      id,
      level: 'standard',
      cookie: getCookie(),
    });
    const data = body?.data?.[0] ?? null;
    const url = data?.url ?? '';
    if (!url) {
      throw new NeteaseError(
        'TRACK_UNAVAILABLE',
        '当前账号无法播放该曲目，可能受会员、版权或地区限制',
        404,
        false,
      );
    }
    return {
      id: String(id),
      upstreamUrl: String(url),
      type: String(data?.type ?? 'mp3'),
      size: Number(data?.size ?? 0),
      fee: Number(data?.fee ?? 0),
      level: String(data?.level ?? 'standard'),
    };
  }

  async function lyrics(id) {
    const body = await callApi('lyric', { id, cookie: getCookie() });
    return {
      lyric: String(body?.lrc?.lyric ?? ''),
      translatedLyric: String(body?.tlyric?.lyric ?? ''),
      noLyric: Boolean(body?.nolyric || body?.uncollected),
    };
  }

  return { getAuthStatus, search, playlists, playlistTracks, playback, lyrics };
}
