import { higherQuality, lowerQuality } from './adaptive';

describe('adaptive quality steps', () => {
  it('moves only one tier at a time and clamps the ends', () => {
    expect(lowerQuality('high')).toBe('medium');
    expect(lowerQuality('medium')).toBe('low');
    expect(lowerQuality('low')).toBe('low');
    expect(higherQuality('low')).toBe('medium');
    expect(higherQuality('medium')).toBe('high');
    expect(higherQuality('high')).toBe('high');
  });
});
