import { create } from 'zustand';
import { audioEngine, type AudioStatus } from '../audio/AudioEngine';
import { activeLyricIndex as findActiveLyricIndex, mergeLyrics } from '../netease/lrc';
import { neteaseApi } from '../netease/api';
import type { LyricLine, SongSummary } from '../netease/types';

interface PlayerState {
  queue: SongSummary[];
  currentIndex: number;
  currentTrack: SongSummary | null;
  mode: AudioStatus['mode'];
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  lyrics: LyricLine[];
  activeLyricIndex: number;
  lyricsLoading: boolean;
  error: string | null;
  playQueue: (songs: SongSummary[], index?: number) => Promise<void>;
  startDemo: () => Promise<void>;
  toggle: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  clearError: () => void;
}

let loadGeneration = 0;

export function nextQueueIndex(length: number, currentIndex: number, direction: 1 | -1) {
  if (length <= 0) return -1;
  return (currentIndex + direction + length) % length;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: -1,
  currentTrack: null,
  mode: 'idle',
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 0.72,
  lyrics: [],
  activeLyricIndex: -1,
  lyricsLoading: false,
  error: null,
  playQueue: async (songs, index = 0) => {
    const track = songs[index];
    if (!track) return;
    const generation = ++loadGeneration;
    set({
      queue: songs,
      currentIndex: index,
      currentTrack: track,
      lyrics: [],
      activeLyricIndex: -1,
      lyricsLoading: true,
      error: null,
      currentTime: 0,
    });
    void neteaseApi
      .lyrics(track.id)
      .then((payload) => {
        if (generation !== loadGeneration) return;
        const lyrics = payload.noLyric ? [] : mergeLyrics(payload.lyric, payload.translatedLyric);
        set((state) => ({
          lyrics,
          activeLyricIndex: findActiveLyricIndex(lyrics, state.currentTime * 1_000),
          lyricsLoading: false,
        }));
      })
      .catch(() => {
        if (generation === loadGeneration) set({ lyrics: [], activeLyricIndex: -1, lyricsLoading: false });
      });
    try {
      await audioEngine.loadStream(neteaseApi.streamUrl(track.id));
    } catch (error) {
      if (generation !== loadGeneration) return;
      set({
        playing: false,
        lyricsLoading: false,
        error: error instanceof Error ? error.message : '无法播放这首歌曲',
      });
    }
  },
  startDemo: async () => {
    loadGeneration += 1;
    set({ currentTrack: null, currentIndex: -1, lyrics: [], activeLyricIndex: -1, lyricsLoading: false, error: null });
    try {
      await audioEngine.startDemo();
    } catch {
      set({ error: '无法启动演示音频，请检查系统音频设置' });
    }
  },
  toggle: async () => {
    try {
      await audioEngine.toggle();
    } catch {
      set({ error: '播放操作失败，请重试' });
    }
  },
  next: async () => {
    const { queue, currentIndex, playQueue } = get();
    if (queue.length === 0) {
      await get().startDemo();
      return;
    }
    await playQueue(queue, nextQueueIndex(queue.length, currentIndex, 1));
  },
  previous: async () => {
    const { queue, currentIndex, currentTime, playQueue } = get();
    if (currentTime > 3) {
      audioEngine.seek(0);
      return;
    }
    if (queue.length === 0) return;
    await playQueue(queue, nextQueueIndex(queue.length, currentIndex, -1));
  },
  seek: (seconds) => audioEngine.seek(seconds),
  setVolume: (volume) => audioEngine.setVolume(volume),
  clearError: () => set({ error: null }),
}));

let lastEndedCounter = 0;
audioEngine.subscribe((status) => {
  const state = usePlayerStore.getState();
  const nextLyricIndex = state.lyrics.length > 0
    ? findActiveLyricIndex(state.lyrics, status.currentTime * 1_000)
    : -1;
  usePlayerStore.setState({
    mode: status.mode,
    playing: status.playing,
    currentTime: status.currentTime,
    duration: status.duration,
    volume: status.volume,
    error: status.error,
    ...(nextLyricIndex !== state.activeLyricIndex ? { activeLyricIndex: nextLyricIndex } : {}),
  });
  if (status.endedCounter !== lastEndedCounter) {
    lastEndedCounter = status.endedCounter;
    queueMicrotask(() => void usePlayerStore.getState().next());
  }
});
