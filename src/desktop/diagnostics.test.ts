import { isExpectedCancellation, sanitizeDiagnosticValue } from '../../desktop/diagnostics.mjs';

describe('diagnostic privacy', () => {
  it('removes credentials, URLs and absolute paths', () => {
    const result = sanitizeDiagnosticValue({
      cookie: 'MUSIC_U=secret',
      note: 'open https://music.163.com/song at /Users/alice/Music/song.mp3',
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('music.163.com');
    expect(JSON.stringify(result)).not.toContain('/Users/alice');
  });

  it('classifies expected stream cancellations', () => {
    expect(isExpectedCancellation({ name: 'TimeoutError' })).toBe(true);
    expect(isExpectedCancellation({ code: 'ERR_STREAM_PREMATURE_CLOSE' })).toBe(true);
    expect(isExpectedCancellation(new Error('boom'))).toBe(false);
  });
});
