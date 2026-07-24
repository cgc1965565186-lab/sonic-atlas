import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseFile } from 'music-metadata';

export const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.m4a',
  '.aac',
  '.flac',
  '.wav',
  '.wave',
  '.ogg',
  '.opus',
]);

const LIBRARY_VERSION = 1;
const MAX_SCAN_FILES = 25_000;
const COVER_EXTENSIONS = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

function stableId(filePath) {
  return `local-${crypto.createHash('sha256').update(filePath).digest('hex').slice(0, 24)}`;
}

function publicTrack(entry) {
  return {
    id: entry.id,
    source: 'local',
    title: entry.title,
    artists: entry.artists,
    album: entry.album,
    durationMs: entry.durationMs,
    coverUrl: entry.coverName ? `/api/local/tracks/${encodeURIComponent(entry.id)}/cover` : '',
    availability: entry.missing ? 'unavailable' : 'available',
    missing: Boolean(entry.missing),
  };
}

function embeddedLyrics(common) {
  const values = Array.isArray(common.lyrics) ? common.lyrics : [];
  return values
    .map((value) => (typeof value === 'string' ? value : String(value?.text ?? '')))
    .filter(Boolean)
    .join('\n');
}

async function readSidecarLyrics(filePath) {
  const candidate = path.join(path.dirname(filePath), `${path.parse(filePath).name}.lrc`);
  try {
    return await fs.readFile(candidate, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return '';
    throw error;
  }
}

async function collectAudioFiles(inputPath, output) {
  if (output.length >= MAX_SCAN_FILES) return;
  const stat = await fs.lstat(inputPath);
  if (stat.isSymbolicLink()) return;
  if (stat.isFile()) {
    if (SUPPORTED_AUDIO_EXTENSIONS.has(path.extname(inputPath).toLowerCase())) output.push(inputPath);
    return;
  }
  if (!stat.isDirectory()) return;
  const entries = await fs.readdir(inputPath, { withFileTypes: true });
  for (const entry of entries) {
    if (output.length >= MAX_SCAN_FILES) break;
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
    await collectAudioFiles(path.join(inputPath, entry.name), output);
  }
}

export function createLocalLibrary({ userDataPath, log = () => {} }) {
  const libraryDir = path.join(userDataPath, 'library');
  const coverDir = path.join(libraryDir, 'covers');
  const indexPath = path.join(libraryDir, 'local-library.json');
  let roots = [];
  let entries = new Map();

  async function save() {
    await fs.mkdir(libraryDir, { recursive: true, mode: 0o700 });
    const temporary = `${indexPath}.tmp`;
    const payload = JSON.stringify({
      version: LIBRARY_VERSION,
      roots,
      tracks: [...entries.values()],
    });
    await fs.writeFile(temporary, payload, { mode: 0o600 });
    await fs.rename(temporary, indexPath);
  }

  async function load() {
    try {
      const stored = JSON.parse(await fs.readFile(indexPath, 'utf8'));
      roots = Array.isArray(stored.roots) ? stored.roots.filter((value) => typeof value === 'string') : [];
      entries = new Map(
        (Array.isArray(stored.tracks) ? stored.tracks : [])
          .filter((entry) => entry && typeof entry.id === 'string' && typeof entry.filePath === 'string')
          .map((entry) => [entry.id, entry]),
      );
      await validate();
    } catch (error) {
      if (error?.code !== 'ENOENT') log('error', 'local-library-load', error);
      roots = [];
      entries = new Map();
    }
    return list();
  }

  async function writeCover(id, picture) {
    if (!picture?.data || picture.data.length === 0 || picture.data.length > 12 * 1024 * 1024) return '';
    const extension = COVER_EXTENSIONS.get(String(picture.format).toLowerCase());
    if (!extension) return '';
    await fs.mkdir(coverDir, { recursive: true, mode: 0o700 });
    const coverName = `${id}${extension}`;
    await fs.writeFile(path.join(coverDir, coverName), Buffer.from(picture.data), { mode: 0o600 });
    return coverName;
  }

  async function parseTrack(filePath, preferredId) {
    const canonicalPath = await fs.realpath(filePath);
    if (!SUPPORTED_AUDIO_EXTENSIONS.has(path.extname(canonicalPath).toLowerCase())) {
      throw new Error('不支持的音频格式');
    }
    const stat = await fs.stat(canonicalPath);
    const metadata = await parseFile(canonicalPath, { duration: true, skipCovers: false });
    const id = preferredId ?? stableId(canonicalPath);
    const picture = metadata.common.picture?.[0];
    const coverName = picture ? await writeCover(id, picture) : '';
    const lyrics = embeddedLyrics(metadata.common) || await readSidecarLyrics(canonicalPath);
    const artists = metadata.common.artists?.map(String).filter(Boolean) ?? [];
    return {
      id,
      filePath: canonicalPath,
      canonicalPath,
      size: stat.size,
      modifiedAt: stat.mtimeMs,
      title: String(metadata.common.title ?? path.parse(canonicalPath).name),
      artists: artists.length > 0
        ? artists
        : metadata.common.artist ? [String(metadata.common.artist)] : ['未知艺术家'],
      album: {
        id: String(metadata.common.album ?? ''),
        name: String(metadata.common.album ?? '本地音乐'),
      },
      durationMs: Math.max(0, Math.round(Number(metadata.format.duration ?? 0) * 1_000)),
      lyrics,
      coverName,
      missing: false,
    };
  }

  async function importPaths(paths, { rememberRoots = false } = {}) {
    const files = [];
    const failures = [];
    for (const input of paths) {
      try {
        const canonicalInput = await fs.realpath(input);
        const stat = await fs.lstat(canonicalInput);
        if (rememberRoots && stat.isDirectory() && !roots.includes(canonicalInput)) roots.push(canonicalInput);
        await collectAudioFiles(canonicalInput, files);
      } catch (error) {
        failures.push({ name: path.basename(input), message: error instanceof Error ? error.message : '无法读取' });
      }
    }
    const byPath = new Map([...entries.values()].map((entry) => [entry.canonicalPath, entry]));
    let imported = 0;
    let updated = 0;
    for (const filePath of files) {
      try {
        const canonicalPath = await fs.realpath(filePath);
        const existing = byPath.get(canonicalPath);
        const stat = await fs.stat(canonicalPath);
        if (existing && existing.size === stat.size && existing.modifiedAt === stat.mtimeMs && !existing.missing) continue;
        const next = await parseTrack(canonicalPath, existing?.id);
        entries.set(next.id, next);
        byPath.set(canonicalPath, next);
        if (existing) updated += 1;
        else imported += 1;
      } catch (error) {
        failures.push({ name: path.basename(filePath), message: error instanceof Error ? error.message : '无法解析' });
      }
    }
    await save();
    log('info', 'local-library-import', { imported, updated, failed: failures.length });
    return { tracks: list(), imported, updated, failures };
  }

  async function validate() {
    let changed = false;
    for (const entry of entries.values()) {
      try {
        await fs.access(entry.filePath);
        if (entry.missing) {
          entry.missing = false;
          changed = true;
        }
      } catch {
        if (!entry.missing) {
          entry.missing = true;
          changed = true;
        }
      }
    }
    if (changed) await save();
  }

  async function rescan() {
    await validate();
    return importPaths(roots, { rememberRoots: false });
  }

  async function relocate(id, filePath) {
    const current = entries.get(id);
    if (!current) throw new Error('本地曲目不存在');
    const next = await parseTrack(filePath, id);
    entries.set(id, next);
    await save();
    return publicTrack(next);
  }

  async function remove(id) {
    const entry = entries.get(id);
    if (!entry) return false;
    entries.delete(id);
    if (entry.coverName) {
      await fs.unlink(path.join(coverDir, entry.coverName)).catch(() => {});
    }
    await save();
    return true;
  }

  function list() {
    return [...entries.values()]
      .map(publicTrack)
      .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
  }

  function getEntry(id) {
    return entries.get(id) ?? null;
  }

  return {
    load,
    list,
    importFiles: (paths) => importPaths(paths),
    importFolders: (paths) => importPaths(paths, { rememberRoots: true }),
    rescan,
    relocate,
    remove,
    getEntry,
    getCoverPath: (id) => {
      const entry = entries.get(id);
      return entry?.coverName ? path.join(coverDir, entry.coverName) : '';
    },
    stats: () => ({
      total: entries.size,
      missing: [...entries.values()].filter((entry) => entry.missing).length,
      roots: roots.length,
    }),
  };
}
