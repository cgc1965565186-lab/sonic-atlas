export function centerEnvelope(normalizedRadius: number, falloff: number) {
  return Math.exp(-normalizedRadius * normalizedRadius * falloff);
}

export function softLimitHeight(value: number, maximum: number) {
  if (maximum <= 0 || value <= 0) return 0;
  return maximum * Math.tanh(value / maximum);
}

export function gaussianRing(distance: number, radius: number, sharpness: number) {
  const delta = distance - radius;
  return Math.exp(-delta * delta * sharpness);
}
