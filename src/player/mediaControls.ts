export type MediaCommand = 'previous' | 'toggle' | 'next';

export function mediaCommandFromKey(event: Pick<KeyboardEvent, 'code' | 'key'>): MediaCommand | null {
  if (event.code === 'F7' || event.key === 'F7' || event.key === 'MediaTrackPrevious') return 'previous';
  if (event.code === 'F8' || event.key === 'F8' || event.key === 'MediaPlayPause') return 'toggle';
  if (event.code === 'F9' || event.key === 'F9' || event.key === 'MediaTrackNext') return 'next';
  return null;
}
