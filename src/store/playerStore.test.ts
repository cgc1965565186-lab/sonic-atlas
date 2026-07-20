import { nextQueueIndex } from './playerStore';

describe('queue boundaries', () => {
  it('wraps next and previous at either edge', () => {
    expect(nextQueueIndex(3, 2, 1)).toBe(0);
    expect(nextQueueIndex(3, 0, -1)).toBe(2);
  });

  it('returns no selection for an empty queue', () => {
    expect(nextQueueIndex(0, 0, 1)).toBe(-1);
  });
});
