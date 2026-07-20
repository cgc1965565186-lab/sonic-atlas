export type ThemeId =
  | 'coal-amber'
  | 'deep-sea'
  | 'red-screen'
  | 'forest-copper'
  | 'violet-dusk'
  | 'indigo-glacier'
  | 'sandstone-gold'
  | 'rose-noir';
export type CameraPreset = 'orbit' | 'low-glide' | 'slow-push' | 'off';
export type PaletteMode = 'cover' | 'preset';
export type PaletteStatus = 'idle' | 'loading' | 'ready' | 'fallback';

export interface ScenePalette {
  background: string;
  fog: string;
  base: string;
  secondary: string;
  tertiary: string;
  accent: string;
  hot: string;
  uiAccent: string;
}

export interface VisualTheme extends ScenePalette {
  id: ThemeId;
  name: string;
  label: string;
}

export const VISUAL_THEMES: Record<ThemeId, VisualTheme> = {
  'coal-amber': {
    id: 'coal-amber',
    name: 'Coal Amber',
    label: '煤黑琥珀',
    background: '#0c0d0d',
    fog: '#121311',
    base: '#11120f',
    secondary: '#542718',
    tertiary: '#8f7445',
    accent: '#c45f30',
    hot: '#ffd08a',
    uiAccent: '#df8a61',
  },
  'deep-sea': {
    id: 'deep-sea',
    name: 'Deep Sea',
    label: '深海青灰',
    background: '#0a1011',
    fog: '#102022',
    base: '#0c1718',
    secondary: '#25494b',
    tertiary: '#526b7c',
    accent: '#5b9a98',
    hot: '#c5e2da',
    uiAccent: '#79aaa5',
  },
  'red-screen': {
    id: 'red-screen',
    name: 'Red Screen',
    label: '暗红银幕',
    background: '#100c0c',
    fog: '#201414',
    base: '#1b100f',
    secondary: '#59251f',
    tertiary: '#827975',
    accent: '#a94836',
    hot: '#efb89e',
    uiAccent: '#c26d5c',
  },
  'forest-copper': {
    id: 'forest-copper',
    name: 'Forest Copper',
    label: '墨林铜金',
    background: '#09100d',
    fog: '#102019',
    base: '#0d1812',
    secondary: '#28513e',
    tertiary: '#9a6b3b',
    accent: '#5e9872',
    hot: '#e6c28b',
    uiAccent: '#78aa85',
  },
  'violet-dusk': {
    id: 'violet-dusk',
    name: 'Violet Dusk',
    label: '暮紫烟金',
    background: '#100c13',
    fog: '#1c1521',
    base: '#160f1a',
    secondary: '#503356',
    tertiary: '#8c5b55',
    accent: '#81638e',
    hot: '#e5c2ad',
    uiAccent: '#a27fa8',
  },
  'indigo-glacier': {
    id: 'indigo-glacier',
    name: 'Indigo Glacier',
    label: '冰川靛蓝',
    background: '#0b0e14',
    fog: '#141b27',
    base: '#101620',
    secondary: '#29445f',
    tertiary: '#6b778b',
    accent: '#547da1',
    hot: '#cbd6df',
    uiAccent: '#7696b2',
  },
  'sandstone-gold': {
    id: 'sandstone-gold',
    name: 'Sandstone Gold',
    label: '砂岩古金',
    background: '#100e09',
    fog: '#201b10',
    base: '#17130b',
    secondary: '#5d4822',
    tertiary: '#78604f',
    accent: '#ae8642',
    hot: '#ead7aa',
    uiAccent: '#c09c62',
  },
  'rose-noir': {
    id: 'rose-noir',
    name: 'Rose Noir',
    label: '黑玫瑰',
    background: '#110a0e',
    fog: '#21131a',
    base: '#190e14',
    secondary: '#5b293d',
    tertiary: '#755f75',
    accent: '#a84d68',
    hot: '#efbdc9',
    uiAccent: '#c8738a',
  },
};

export const GRID_SIZES = [32, 48, 64, 80] as const;

export function presetPalette(themeId: ThemeId): ScenePalette {
  const theme = VISUAL_THEMES[themeId];
  return {
    background: theme.background,
    fog: theme.fog,
    base: theme.base,
    secondary: theme.secondary,
    tertiary: theme.tertiary,
    accent: theme.accent,
    hot: theme.hot,
    uiAccent: theme.uiAccent,
  };
}

export const TERRAIN_RESPONSE = {
  size: 25,
  maxHeight: 5.8,
  baseHeight: 0.08,
  wideFocusFalloff: 1.65,
  middleFocusFalloff: 3.2,
  coreFocusFalloff: 6.3,
  rippleCount: 2,
  rippleMergeWindow: 0.26,
  rippleDuration: 2.75,
  rippleSpeed: 4.15,
  rippleOriginRadius: 2.2,
  rippleCrestSharpness: 2.9,
  rippleHaloSharpness: 0.48,
} as const;

export const CAMERA_PRESETS: Array<{ id: CameraPreset; label: string; description: string }> = [
  { id: 'orbit', label: '环绕巡航', description: '缓慢椭圆环绕' },
  { id: 'low-glide', label: '低空贴地', description: '低机位横向滑行' },
  { id: 'slow-push', label: '缓慢推近', description: '长周期推进与回撤' },
  { id: 'off', label: '手动镜头', description: '鼠标拖拽观察' },
];

export const openingSignal = { value: 0 };
