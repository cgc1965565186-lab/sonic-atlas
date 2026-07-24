import { resolveAuthMedia, resolveMediaUrl, resolvePlaylistMedia, resolveSongMedia, setApiBaseUrl } from './api';
import type { AuthStatus, PlaylistSummary, SongSummary } from './types';

const song: SongSummary = {
  id: '1',
  source: 'netease',
  title: 'Atlas',
  artists: ['Sonic'],
  album: { id: '2', name: 'Field' },
  durationMs: 120_000,
  coverUrl: '/api/media/image?source=cover',
  availability: 'unknown',
};

describe('runtime media URL resolution', () => {
  beforeEach(() => setApiBaseUrl('http://127.0.0.1:43127/'));
  afterEach(() => setApiBaseUrl(''));

  it('binds relative proxy URLs to the Electron runtime port', () => {
    expect(resolveMediaUrl('/api/media/image?source=cover')).toBe(
      'http://127.0.0.1:43127/api/media/image?source=cover',
    );
    expect(resolveMediaUrl('javascript:alert(1)')).toBe('');
  });

  it('resolves song, playlist and account artwork without mutating DTOs', () => {
    const playlist: PlaylistSummary = {
      id: '3',
      title: 'List',
      coverUrl: '/api/media/image?source=list',
      trackCount: 1,
      creator: 'Sonic',
      owned: true,
    };
    const auth: AuthStatus = {
      authenticated: true,
      persistence: 'encrypted',
      user: { id: '4', nickname: 'Atlas', avatarUrl: '/api/media/image?source=avatar' },
    };

    expect(resolveSongMedia(song).coverUrl).toContain('127.0.0.1:43127');
    expect(resolvePlaylistMedia(playlist).coverUrl).toContain('127.0.0.1:43127');
    expect(resolveAuthMedia(auth).user?.avatarUrl).toContain('127.0.0.1:43127');
    expect(song.coverUrl).toBe('/api/media/image?source=cover');
  });
});
