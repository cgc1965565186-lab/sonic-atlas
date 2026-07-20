interface UpstreamArtist { name?: unknown }
interface UpstreamAlbum { id?: unknown; name?: unknown; picUrl?: unknown }
interface UpstreamSong {
  id?: unknown;
  name?: unknown;
  ar?: UpstreamArtist[];
  artists?: UpstreamArtist[];
  al?: UpstreamAlbum;
  album?: UpstreamAlbum;
  picUrl?: unknown;
  dt?: unknown;
  duration?: unknown;
}

export function normalizeSong(song: UpstreamSong): {
  id: string;
  title: string;
  artists: string[];
  album: { id: string; name: string };
  durationMs: number;
  coverUrl: string;
  availability: 'unknown';
};
