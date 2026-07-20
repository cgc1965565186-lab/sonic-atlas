import { mediaCommandFromKey } from './mediaControls';

describe('macOS media key mapping', () => {
  it('maps the F7, F8 and F9 function row', () => {
    expect(mediaCommandFromKey({ code: 'F7', key: 'F7' })).toBe('previous');
    expect(mediaCommandFromKey({ code: 'F8', key: 'F8' })).toBe('toggle');
    expect(mediaCommandFromKey({ code: 'F9', key: 'F9' })).toBe('next');
  });

  it('maps dedicated media key events and ignores unrelated keys', () => {
    expect(mediaCommandFromKey({ code: '', key: 'MediaTrackPrevious' })).toBe('previous');
    expect(mediaCommandFromKey({ code: '', key: 'MediaPlayPause' })).toBe('toggle');
    expect(mediaCommandFromKey({ code: '', key: 'MediaTrackNext' })).toBe('next');
    expect(mediaCommandFromKey({ code: 'KeyK', key: 'k' })).toBeNull();
  });
});
