import { presetPalette } from '../config/visual';
import { paletteFromPixels } from './CoverPaletteEngine';

function pixels(colors: Array<[number, number, number, number]>) {
  const data = new Uint8ClampedArray(colors.length * 4);
  colors.forEach((color, index) => data.set(color, index * 4));
  return data;
}

function saturation(hex: string) {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const maximum = Math.max(...channels);
  const minimum = Math.min(...channels);
  const lightness = (maximum + minimum) / 2;
  return maximum === minimum ? 0 : ((maximum - minimum) / (1 - Math.abs(2 * lightness - 1))) * 100;
}

describe('cover palette extraction', () => {
  const fallback = presetPalette('coal-amber');

  it('produces a deterministic restrained multicolour palette', () => {
    const source = pixels(Array.from({ length: 320 }, (_, index) => {
      if (index % 5 < 3) return [196, 74, 44, 255] as [number, number, number, number];
      if (index % 5 === 3) return [34, 104, 166, 255] as [number, number, number, number];
      return [214, 166, 65, 255] as [number, number, number, number];
    }));
    const first = paletteFromPixels(source, fallback);
    expect(paletteFromPixels(source, fallback)).toEqual(first);
    expect(first.accent).toMatch(/^#[0-9a-f]{6}$/);
    expect(first.secondary).not.toBe(first.accent);
    expect(first.tertiary).toMatch(/^#[0-9a-f]{6}$/);
    expect(first.tertiary).not.toBe(first.secondary);
    expect(saturation(first.accent)).toBeLessThanOrEqual(72.5);
    expect(saturation(first.hot)).toBeLessThanOrEqual(64.5);
  });

  it('derives an adjacent secondary for a near-monochrome cover', () => {
    const palette = paletteFromPixels(
      pixels(Array.from({ length: 160 }, () => [92, 112, 126, 255] as [number, number, number, number])),
      fallback,
    );
    expect(palette.secondary).not.toBe(palette.accent);
    expect(palette.tertiary).not.toBe(palette.secondary);
    expect(palette.background).not.toBe(fallback.background);
  });

  it('falls back for transparent, crushed-black and blown-white images', () => {
    expect(paletteFromPixels(pixels([[120, 80, 40, 0]]), fallback)).toEqual(fallback);
    expect(paletteFromPixels(pixels(Array.from({ length: 40 }, () => [1, 1, 1, 255])), fallback)).toEqual(fallback);
    expect(paletteFromPixels(pixels(Array.from({ length: 40 }, () => [254, 254, 254, 255])), fallback)).toEqual(fallback);
  });
});
