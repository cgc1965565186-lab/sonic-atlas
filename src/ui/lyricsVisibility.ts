export function shouldShowLyrics(focusedVisualMode: boolean, immersiveLyricsVisible: boolean) {
  return !focusedVisualMode || immersiveLyricsVisible;
}
