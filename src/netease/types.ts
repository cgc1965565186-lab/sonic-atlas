export interface UserProfile {
  id: string;
  nickname: string;
  avatarUrl: string;
}

export interface AuthStatus {
  authenticated: boolean;
  persistence: 'encrypted' | 'session';
  user: UserProfile | null;
}

export type TrackSource = 'netease' | 'local';

export interface Track {
  id: string;
  source: TrackSource;
  title: string;
  artists: string[];
  album: { id: string; name: string };
  durationMs: number;
  coverUrl: string;
  availability: 'unknown' | 'available' | 'preview' | 'unavailable';
  missing?: boolean;
}

export type SongSummary = Track;
export type LocalTrack = Track & { source: 'local' };

export interface PlaylistSummary {
  id: string;
  title: string;
  coverUrl: string;
  trackCount: number;
  creator: string;
  owned: boolean;
}

export interface LyricPayload {
  lyric: string;
  translatedLyric: string;
  noLyric: boolean;
}

export interface LyricLine {
  timeMs: number;
  text: string;
  translation?: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  retryable: boolean;
}
