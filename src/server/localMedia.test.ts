import { __test } from '../../server/local-media.mjs';

describe('local media ranges', () => {
  it('normalizes bounded and suffix ranges', () => {
    expect(__test.parseRange('bytes=100-199', 1_000)).toEqual({ start: 100, end: 199 });
    expect(__test.parseRange('bytes=-100', 1_000)).toEqual({ start: 900, end: 999 });
    expect(__test.parseRange('bytes=100-', 1_000)).toEqual({ start: 100, end: 999 });
  });

  it('rejects invalid or out-of-bounds ranges', () => {
    expect(__test.parseRange('bytes=1000-', 1_000)).toBeNull();
    expect(__test.parseRange('items=0-2', 1_000)).toBeNull();
  });
});
