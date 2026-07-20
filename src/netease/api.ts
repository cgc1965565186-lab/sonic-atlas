import type { AuthStatus, LyricPayload, PlaylistSummary, SongSummary } from './types';

let apiBaseUrl = '';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
    public readonly status = 500,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function setApiBaseUrl(value: string) {
  apiBaseUrl = value.replace(/\/$/, '');
}

export function getApiBaseUrl() {
  return apiBaseUrl;
}

export function resolveApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${apiBaseUrl}${path}`;
}

export function resolveMediaUrl(value: string) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return value.startsWith('/') ? resolveApiUrl(value) : '';
}

export function resolveSongMedia(song: SongSummary): SongSummary {
  return { ...song, coverUrl: resolveMediaUrl(song.coverUrl) };
}

export function resolvePlaylistMedia(playlist: PlaylistSummary): PlaylistSummary {
  return { ...playlist, coverUrl: resolveMediaUrl(playlist.coverUrl) };
}

export function resolveAuthMedia(status: AuthStatus): AuthStatus {
  if (!status.user) return status;
  return { ...status, user: { ...status.user, avatarUrl: resolveMediaUrl(status.user.avatarUrl) } };
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(resolveApiUrl(path), { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('NETWORK_ERROR', '无法连接本地音乐服务', true, 0);
  }
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    throw new ApiError(
      String(body?.code ?? 'REQUEST_FAILED'),
      String(body?.message ?? '请求未能完成'),
      Boolean(body?.retryable),
      response.status,
    );
  }
  return body as T;
}

export const neteaseApi = {
  authStatus: async () => resolveAuthMedia(await request<AuthStatus>('/api/netease/auth/status')),
  search: async (query: string, offset = 0, signal?: AbortSignal) => {
    const result = await request<{ songs: SongSummary[]; total: number; hasMore: boolean }>(
      `/api/netease/search?q=${encodeURIComponent(query)}&limit=30&offset=${offset}`,
      signal,
    );
    return { ...result, songs: result.songs.map(resolveSongMedia) };
  },
  playlists: async (offset = 0, signal?: AbortSignal) => {
    const result = await request<{ playlists: PlaylistSummary[]; hasMore: boolean }>(
      `/api/netease/playlists?limit=50&offset=${offset}`,
      signal,
    );
    return { ...result, playlists: result.playlists.map(resolvePlaylistMedia) };
  },
  playlistTracks: async (id: string, offset = 0, signal?: AbortSignal) => {
    const result = await request<{ songs: SongSummary[]; total: number; hasMore: boolean }>(
      `/api/netease/playlists/${encodeURIComponent(id)}/tracks?limit=100&offset=${offset}`,
      signal,
    );
    return { ...result, songs: result.songs.map(resolveSongMedia) };
  },
  lyrics: (id: string, signal?: AbortSignal) =>
    request<LyricPayload>(`/api/netease/tracks/${encodeURIComponent(id)}/lyrics`, signal),
  streamUrl: (id: string) => resolveApiUrl(`/api/netease/tracks/${encodeURIComponent(id)}/stream`),
};
