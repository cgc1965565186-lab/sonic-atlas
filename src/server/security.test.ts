import { normalizeCookie } from '../../desktop/auth-store.mjs';
import { isAllowedAudioUrl, isAllowedCoverUrl, normalizeCoverSource } from '../../server/media-proxy.mjs';

describe('local proxy allowlists', () => {
  it('accepts official media hosts and their subdomains', () => {
    expect(isAllowedCoverUrl('https://p1.music.126.net/cover.jpg')).toBe(true);
    expect(isAllowedAudioUrl('http://m801.music.126.net/song.mp3')).toBe(true);
    expect(isAllowedAudioUrl('https://music.163.com/song.mp3')).toBe(true);
  });

  it('rejects lookalike, insecure image and non-http sources', () => {
    expect(isAllowedCoverUrl('https://music.126.net.evil.example/cover.jpg')).toBe(false);
    expect(isAllowedCoverUrl('http://p1.music.126.net/cover.jpg')).toBe(false);
    expect(isAllowedAudioUrl('file:///private/data/song.mp3')).toBe(false);
  });

  it('canonicalizes official legacy cover URLs to HTTPS only', () => {
    expect(normalizeCoverSource('http://p1.music.126.net/cover.jpg')).toBe('https://p1.music.126.net/cover.jpg');
    expect(normalizeCoverSource('//p2.music.126.net/avatar.jpg')).toBe('https://p2.music.126.net/avatar.jpg');
    expect(normalizeCoverSource('https://music.126.net.evil.example/cover.jpg')).toBe('');
  });
});

describe('credential normalization', () => {
  it('joins multiline cookie input without exposing or transforming values', () => {
    expect(normalizeCookie('MUSIC_U=one;\n__csrf=two;;;')).toBe('MUSIC_U=one; __csrf=two');
  });
});
