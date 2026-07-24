import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLocalLibrary } from '../../desktop/local-library.mjs';

function minimalWav() {
  const buffer = Buffer.alloc(44);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8_000, 24);
  buffer.writeUInt32LE(16_000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(0, 40);
  return buffer;
}

describe('local music library', () => {
  let temporary = '';
  beforeEach(async () => {
    temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'sonic-atlas-library-'));
  });
  afterEach(async () => {
    await fs.rm(temporary, { recursive: true, force: true });
  });

  it('imports folders, reads sidecar lyrics and never exposes file paths', async () => {
    const music = path.join(temporary, 'music');
    await fs.mkdir(music);
    await fs.writeFile(path.join(music, 'Night Index.wav'), minimalWav());
    await fs.writeFile(path.join(music, 'Night Index.lrc'), '[00:00.00]Night Index');
    const library = createLocalLibrary({ userDataPath: path.join(temporary, 'data') });
    await library.load();

    const first = await library.importFolders([music]);
    expect(first.imported).toBe(1);
    expect(first.tracks[0]).toMatchObject({ source: 'local', title: 'Night Index', missing: false });
    expect(first.tracks[0]).not.toHaveProperty('filePath');
    expect(library.getEntry(first.tracks[0]?.id ?? '')?.lyrics).toContain('Night Index');

    const duplicate = await library.importFolders([music]);
    expect(duplicate.imported).toBe(0);
  });

  it('keeps a missing entry so the user can relocate it', async () => {
    const music = path.join(temporary, 'music');
    await fs.mkdir(music);
    const file = path.join(music, 'Field.wav');
    await fs.writeFile(file, minimalWav());
    const library = createLocalLibrary({ userDataPath: path.join(temporary, 'data') });
    await library.load();
    await library.importFolders([music]);
    await fs.unlink(file);

    const result = await library.rescan();
    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]?.missing).toBe(true);
  });
});
