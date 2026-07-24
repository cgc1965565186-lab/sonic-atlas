import { create } from 'zustand';
import { localApi, type ImportResult } from '../local/api';
import type { LocalTrack } from '../netease/types';

interface LocalLibraryState {
  tracks: LocalTrack[];
  loading: boolean;
  error: string | null;
  lastImport: Omit<ImportResult, 'tracks'> | null;
  initialize: () => Promise<void>;
  importFiles: () => Promise<void>;
  importFolder: () => Promise<void>;
  rescan: () => Promise<void>;
  relocate: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  clearError: () => void;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : '本地资料库操作失败';
}

async function runImport(
  set: (value: Partial<LocalLibraryState>) => void,
  operation: () => Promise<ImportResult>,
) {
  set({ loading: true, error: null });
  try {
    const result = await operation();
    set({
      tracks: result.tracks,
      lastImport: { imported: result.imported, updated: result.updated, failures: result.failures },
    });
  } catch (error) {
    set({ error: message(error) });
  } finally {
    set({ loading: false });
  }
}

export const useLocalLibraryStore = create<LocalLibraryState>((set, get) => ({
  tracks: [],
  loading: false,
  error: null,
  lastImport: null,
  initialize: async () => {
    set({ loading: true, error: null });
    try {
      set({ tracks: await localApi.list() });
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ loading: false });
    }
  },
  importFiles: () => runImport(set, localApi.importFiles),
  importFolder: () => runImport(set, localApi.importFolder),
  rescan: () => runImport(set, localApi.rescan),
  relocate: async (id) => {
    set({ loading: true, error: null });
    try {
      const track = await localApi.relocate(id);
      if (track) set({ tracks: get().tracks.map((item) => item.id === id ? track : item) });
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ loading: false });
    }
  },
  remove: async (id) => {
    set({ loading: true, error: null });
    try {
      if (await localApi.remove(id)) set({ tracks: get().tracks.filter((track) => track.id !== id) });
    } catch (error) {
      set({ error: message(error) });
    } finally {
      set({ loading: false });
    }
  },
  clearError: () => set({ error: null }),
}));
