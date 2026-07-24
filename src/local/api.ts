import { request, resolveMediaUrl, resolveApiUrl } from '../netease/api';
import type { LocalTrack, LyricPayload } from '../netease/types';

export interface ImportResult {
  tracks: LocalTrack[];
  imported: number;
  updated: number;
  failures: Array<{ name: string; message: string }>;
}

export function resolveLocalTrack(track: LocalTrack): LocalTrack {
  return { ...track, coverUrl: resolveMediaUrl(track.coverUrl) };
}

function unavailable(): Promise<never> {
  return Promise.reject(new Error('本地音乐功能仅在桌面版中可用'));
}

function resolveResult(result: ImportResult): ImportResult {
  return { ...result, tracks: result.tracks.map(resolveLocalTrack) };
}

export const localApi = {
  list: async () => {
    if (window.sonicAtlas) return (await window.sonicAtlas.listLocalTracks()).map(resolveLocalTrack);
    const result = await request<{ tracks: LocalTrack[] }>('/api/local/tracks');
    return result.tracks.map(resolveLocalTrack);
  },
  importFiles: async () => window.sonicAtlas ? resolveResult(await window.sonicAtlas.importLocalFiles()) : unavailable(),
  importFolder: async () => window.sonicAtlas ? resolveResult(await window.sonicAtlas.importLocalFolder()) : unavailable(),
  rescan: async () => window.sonicAtlas ? resolveResult(await window.sonicAtlas.rescanLocalTracks()) : unavailable(),
  relocate: async (id: string) => {
    if (!window.sonicAtlas) return unavailable();
    const track = await window.sonicAtlas.relocateLocalTrack(id);
    return track ? resolveLocalTrack(track) : null;
  },
  remove: async (id: string) => window.sonicAtlas ? window.sonicAtlas.removeLocalTrack(id) : unavailable(),
  lyrics: (id: string, signal?: AbortSignal) =>
    request<LyricPayload>(`/api/local/tracks/${encodeURIComponent(id)}/lyrics`, signal),
  streamUrl: (id: string) => resolveApiUrl(`/api/local/tracks/${encodeURIComponent(id)}/stream`),
};
