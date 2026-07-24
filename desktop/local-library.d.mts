import type { LocalTrack } from '../src/netease/types';

interface ImportFailure { name: string; message: string }
interface ImportResult {
  tracks: LocalTrack[];
  imported: number;
  updated: number;
  failures: ImportFailure[];
}
interface LocalEntry {
  id: string;
  filePath: string;
  lyrics: string;
  missing: boolean;
}

export const SUPPORTED_AUDIO_EXTENSIONS: Set<string>;
export function createLocalLibrary(options: {
  userDataPath: string;
  log?: (level: string, event: string, details: unknown) => void;
}): {
  load(): Promise<LocalTrack[]>;
  list(): LocalTrack[];
  importFiles(paths: string[]): Promise<ImportResult>;
  importFolders(paths: string[]): Promise<ImportResult>;
  rescan(): Promise<ImportResult>;
  relocate(id: string, filePath: string): Promise<LocalTrack>;
  remove(id: string): Promise<boolean>;
  getEntry(id: string): LocalEntry | null;
  getCoverPath(id: string): string;
  stats(): { total: number; missing: number; roots: number };
};
