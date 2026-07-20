import { describe, expect, it } from 'vitest';
import { VISUAL_THEMES } from './visual';

describe('visual presets', () => {
  it('ships eight distinct built-in palettes', () => {
    const themes = Object.values(VISUAL_THEMES);
    expect(themes).toHaveLength(8);
    expect(new Set(themes.map((theme) => theme.id)).size).toBe(8);
    expect(new Set(themes.map((theme) => theme.accent)).size).toBe(8);
  });

  it('provides every scene color as a valid hex value', () => {
    const colorKeys = ['background', 'fog', 'base', 'secondary', 'tertiary', 'accent', 'hot', 'uiAccent'] as const;
    for (const theme of Object.values(VISUAL_THEMES)) {
      for (const key of colorKeys) expect(theme[key]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
