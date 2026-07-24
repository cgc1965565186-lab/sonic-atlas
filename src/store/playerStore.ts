import { create } from 'zustand';
import { audioEngine, type AudioStatus } from '../audio/AudioEngine';
import { localApi } from '../local/api';
import { activeLyricIndex as findActiveLyricIndex, mergeLyrics } from '../netease/lrc';
import { neteaseApi, resolveSongMedia } from '../netease/api';
import type { LyricLine, SongSummary } from '../netease/types';

export type RepeatMode = 'sequential' | 'list' | 'one' | 'shuffle';

interface PlayerSession {
  version: 2;
  queue: SongSummary[];
  currentIndex: number;
  currentTime: number;
  volume: number;
  repeatMode: RepeatMode;
}

interface PlayerState {
  queue: SongSummary[];
  currentIndex: number;
  currentTrack: SongSummary | null;
  mode: AudioStatus['mode'];
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  repeatMode: RepeatMode;
  lyrics: LyricLine[];
  activeLyricIndex: number;
  lyricsLoading: boolean;
  error: string | null;
  restoredPending: boolean;
  playQueue: (songs: SongSummary[], index?: number, startAt?: number) => Promise<void>;
  playTrack: (index: number, startAt?: number) => Promise<void>;
  addToQueue: (songs: SongSummary[]) => void;
  addNext: (song: SongSummary) => void;
  moveQueueItem: (from: number, to: number) => void;
  removeQueueItem: (index: number) => Promise<void>;
  clearQueue: () => void;
  setRepeatMode: (mode: RepeatMode) => void;
  startDemo: () => Promise<void>;
  toggle: () => Promise<void>;
  next: (fromEnded?: boolean) => Promise<void>;
  previous: () => Promise<void>;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  clearError: () => void;
  rebindMedia: () => void;
  syncLocalTracks: (tracks: SongSummary[]) => void;
}

const SESSION_KEY = 'sonic-atlas-player-v2';
let loadGeneration = 0;

export function trackKey(track: Pick<SongSummary, 'source' | 'id'>) {
  return `${track.source}:${track.id}`;
}

function readSession(): PlayerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PlayerSession>;
    const queue: SongSummary[] = Array.isArray(parsed.queue)
      ? parsed.queue.map((track) => ({
          ...track,
          source: track.source === 'local' ? 'local' as const : 'netease' as const,
        }))
      : [];
    const currentIndex = Math.max(-1, Math.min(Number(parsed.currentIndex ?? -1), queue.length - 1));
    return {
      version: 2,
      queue,
      currentIndex,
      currentTime: Math.max(0, Number(parsed.currentTime ?? 0)),
      volume: Math.max(0, Math.min(1, Number(parsed.volume ?? 0.72))),
      repeatMode: ['sequential', 'list', 'one', 'shuffle'].includes(String(parsed.repeatMode))
        ? parsed.repeatMode as RepeatMode
        : 'list',
    };
  } catch {
    return null;
  }
}

const restored = typeof localStorage === 'undefined' ? null : readSession();

export function persistPlayerSession() {
  if (typeof localStorage === 'undefined') return;
  const state = usePlayerStore.getState();
  const session: PlayerSession = {
    version: 2,
    queue: state.queue,
    currentIndex: state.currentIndex,
    currentTime: state.currentTime,
    volume: state.volume,
    repeatMode: state.repeatMode,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function nextQueueIndex(length: number, currentIndex: number, direction: 1 | -1) {
  if (length <= 0) return -1;
  return (currentIndex + direction + length) % length;
}

async function loadLyrics(track: SongSummary, generation: number) {
  try {
    const payload = track.source === 'local'
      ? await localApi.lyrics(track.id)
      : await neteaseApi.lyrics(track.id);
    if (generation !== loadGeneration) return;
    const lyrics = payload.noLyric ? [] : mergeLyrics(payload.lyric, payload.translatedLyric);
    usePlayerStore.setState((state) => ({
      lyrics,
      activeLyricIndex: findActiveLyricIndex(lyrics, state.currentTime * 1_000),
      lyricsLoading: false,
    }));
  } catch {
    if (generation === loadGeneration) {
      usePlayerStore.setState({ lyrics: [], activeLyricIndex: -1, lyricsLoading: false });
    }
  }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: restored?.queue ?? [],
  currentIndex: restored?.currentIndex ?? -1,
  currentTrack: restored && restored.currentIndex >= 0 ? restored.queue[restored.currentIndex] ?? null : null,
  mode: 'idle',
  playing: false,
  currentTime: restored?.currentTime ?? 0,
  duration: restored?.queue[restored.currentIndex]?.durationMs
    ? (restored.queue[restored.currentIndex]?.durationMs ?? 0) / 1_000
    : 0,
  volume: restored?.volume ?? 0.72,
  repeatMode: restored?.repeatMode ?? 'list',
  lyrics: [],
  activeLyricIndex: -1,
  lyricsLoading: false,
  error: null,
  restoredPending: Boolean(restored && restored.currentIndex >= 0),
  playQueue: async (songs, index = 0, startAt = 0) => {
    const track = songs[index];
    if (!track) return;
    set({ queue: songs, currentIndex: index });
    await get().playTrack(index, startAt);
  },
  playTrack: async (index, startAt = 0) => {
    const track = get().queue[index];
    if (!track) return;
    if (track.missing || track.availability === 'unavailable') {
      set({ error: track.source === 'local' ? '本地音乐文件已移动或删除' : '这首歌曲当前无法播放' });
      return;
    }
    const generation = ++loadGeneration;
    set({
      currentIndex: index,
      currentTrack: track,
      lyrics: [],
      activeLyricIndex: -1,
      lyricsLoading: true,
      error: null,
      currentTime: Math.max(0, startAt),
      restoredPending: false,
    });
    void loadLyrics(track, generation);
    try {
      const streamUrl = track.source === 'local' ? localApi.streamUrl(track.id) : neteaseApi.streamUrl(track.id);
      await audioEngine.loadStream(streamUrl, { startAt });
    } catch (error) {
      if (generation !== loadGeneration) return;
      set({
        playing: false,
        lyricsLoading: false,
        error: error instanceof Error ? error.message : '无法播放这首歌曲',
      });
    }
  },
  addToQueue: (songs) => set((state) => {
    const known = new Set(state.queue.map(trackKey));
    const additions = songs.filter((track) => {
      const key = trackKey(track);
      if (known.has(key)) return false;
      known.add(key);
      return true;
    });
    return { queue: [...state.queue, ...additions] };
  }),
  addNext: (song) => set((state) => {
    const queue = state.queue.filter((item, index) => index === state.currentIndex || trackKey(item) !== trackKey(song));
    const insertAt = Math.max(0, state.currentIndex + 1);
    queue.splice(insertAt, 0, song);
    return { queue };
  }),
  moveQueueItem: (from, to) => set((state) => {
    if (from === to || from < 0 || to < 0 || from >= state.queue.length || to >= state.queue.length) return state;
    const queue = [...state.queue];
    const [moved] = queue.splice(from, 1);
    if (!moved) return state;
    queue.splice(to, 0, moved);
    const currentKey = state.currentTrack ? trackKey(state.currentTrack) : '';
    return { queue, currentIndex: currentKey ? queue.findIndex((track) => trackKey(track) === currentKey) : -1 };
  }),
  removeQueueItem: async (index) => {
    const state = get();
    if (index < 0 || index >= state.queue.length) return;
    const removingCurrent = index === state.currentIndex;
    const queue = state.queue.filter((_, itemIndex) => itemIndex !== index);
    const nextIndex = queue.length === 0 ? -1 : Math.min(index, queue.length - 1);
    set({
      queue,
      currentIndex: removingCurrent ? nextIndex : index < state.currentIndex ? state.currentIndex - 1 : state.currentIndex,
      ...(queue.length === 0 ? { currentTrack: null, currentTime: 0, duration: 0, lyrics: [] } : {}),
    });
    if (removingCurrent && nextIndex >= 0) await get().playTrack(nextIndex);
    if (queue.length === 0) audioEngine.stop();
  },
  clearQueue: () => {
    loadGeneration += 1;
    audioEngine.stop();
    set({
      queue: [],
      currentIndex: -1,
      currentTrack: null,
      mode: 'idle',
      playing: false,
      currentTime: 0,
      duration: 0,
      lyrics: [],
      activeLyricIndex: -1,
      restoredPending: false,
    });
  },
  setRepeatMode: (repeatMode) => set({ repeatMode }),
  startDemo: async () => {
    loadGeneration += 1;
    set({
      currentTrack: null,
      currentIndex: -1,
      lyrics: [],
      activeLyricIndex: -1,
      lyricsLoading: false,
      error: null,
      restoredPending: false,
    });
    try {
      await audioEngine.startDemo();
    } catch {
      set({ error: '无法启动演示音频，请检查系统音频设置' });
    }
  },
  toggle: async () => {
    try {
      const state = get();
      if (state.restoredPending && state.currentIndex >= 0) {
        await state.playTrack(state.currentIndex, state.currentTime);
        return;
      }
      await audioEngine.toggle();
    } catch {
      set({ error: '播放操作失败，请重试' });
    }
  },
  next: async (fromEnded = false) => {
    const { queue, currentIndex, repeatMode, playTrack } = get();
    if (queue.length === 0) {
      if (!fromEnded) await get().startDemo();
      return;
    }
    if (repeatMode === 'one' && fromEnded) {
      await playTrack(Math.max(0, currentIndex));
      return;
    }
    if (repeatMode === 'shuffle' && queue.length > 1) {
      let nextIndex = currentIndex;
      while (nextIndex === currentIndex) nextIndex = Math.floor(Math.random() * queue.length);
      await playTrack(nextIndex);
      return;
    }
    if (repeatMode === 'sequential' && currentIndex >= queue.length - 1) {
      audioEngine.stop();
      set({ playing: false, currentTime: 0 });
      return;
    }
    await playTrack(nextQueueIndex(queue.length, currentIndex, 1));
  },
  previous: async () => {
    const { queue, currentIndex, currentTime, playTrack } = get();
    if (currentTime > 3) {
      audioEngine.seek(0);
      return;
    }
    if (queue.length === 0) return;
    await playTrack(nextQueueIndex(queue.length, currentIndex, -1));
  },
  seek: (seconds) => {
    if (get().restoredPending) {
      set({ currentTime: Math.max(0, seconds) });
      return;
    }
    audioEngine.seek(seconds);
  },
  setVolume: (volume) => {
    audioEngine.setVolume(volume);
    set({ volume: Math.max(0, Math.min(1, volume)) });
  },
  clearError: () => set({ error: null }),
  rebindMedia: () => set((state) => {
    const queue = state.queue.map(resolveSongMedia);
    return {
      queue,
      currentTrack: state.currentIndex >= 0 ? queue[state.currentIndex] ?? null : null,
    };
  }),
  syncLocalTracks: (tracks) => set((state) => {
    const local = new Map(tracks.filter((track) => track.source === 'local').map((track) => [track.id, track]));
    const queue = state.queue.map((track) => track.source === 'local' ? local.get(track.id) ?? { ...track, missing: true, availability: 'unavailable' as const } : track);
    return {
      queue,
      currentTrack: state.currentIndex >= 0 ? queue[state.currentIndex] ?? null : null,
    };
  }),
}));

audioEngine.setVolume(restored?.volume ?? 0.72);
let lastEndedCounter = 0;
audioEngine.subscribe((status) => {
  const state = usePlayerStore.getState();
  const nextLyricIndex = state.lyrics.length > 0
    ? findActiveLyricIndex(state.lyrics, status.currentTime * 1_000)
    : -1;
  usePlayerStore.setState({
    mode: status.mode,
    playing: status.playing,
    currentTime: state.restoredPending ? state.currentTime : status.currentTime,
    duration: state.restoredPending ? state.duration : status.duration,
    volume: status.volume,
    error: status.error,
    ...(nextLyricIndex !== state.activeLyricIndex ? { activeLyricIndex: nextLyricIndex } : {}),
  });
  if (status.endedCounter !== lastEndedCounter) {
    lastEndedCounter = status.endedCounter;
    queueMicrotask(() => void usePlayerStore.getState().next(true));
  }
});
