import type { EffectiveQuality } from '../store/visualStore';

export function lowerQuality(value: EffectiveQuality): EffectiveQuality {
  return value === 'high' ? 'medium' : 'low';
}

export function higherQuality(value: EffectiveQuality): EffectiveQuality {
  return value === 'low' ? 'medium' : 'high';
}
