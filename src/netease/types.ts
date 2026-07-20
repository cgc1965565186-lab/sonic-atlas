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

export interface SongSummary {
  id: string;
  title: string;
  artists: string[];
  album: { id: string; name: string };
  durationMs: number;
  coverUrl: string;
  availability: 'unknown' | 'available' | 'preview' | 'unavailable';
}

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
