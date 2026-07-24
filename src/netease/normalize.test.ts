import { normalizeSong } from '../../server/netease-service.mjs';

describe('Netease DTO normalization', () => {
  it('removes upstream shape details and proxies cover artwork', () => {
    const song = normalizeSong({
      id: 42,
      name: 'Night Index',
      ar: [{ name: 'Atlas' }],
      al: { id: 7, name: 'Field Notes', picUrl: 'https://p1.music.126.net/a.jpg' },
      dt: 183_000,
    });
    expect(song).toEqual({
      id: '42',
      source: 'netease',
      title: 'Night Index',
      artists: ['Atlas'],
      album: { id: '7', name: 'Field Notes' },
      durationMs: 183_000,
      coverUrl: '/api/media/image?source=https%3A%2F%2Fp1.music.126.net%2Fa.jpg',
      availability: 'unknown',
    });
    expect(song).not.toHaveProperty('url');
  });
});
