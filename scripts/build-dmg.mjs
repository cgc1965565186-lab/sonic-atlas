import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'));
const builder = path.join(rootDir, 'node_modules', '.bin', 'electron-builder');
const appPath = path.join(rootDir, 'release', 'mac-arm64', 'Sonic Atlas.app');
const finalDmg = path.join(rootDir, 'release', `SonicAtlas-${packageJson.version}-arm64.dmg`);
const temporaryDmg = path.join(rootDir, 'release', `.sonic-atlas-${process.pid}.dmg`);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: rootDir, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(command)} exited with code ${code ?? 'unknown'}`));
    });
  });
}

await run(builder, ['--mac', 'dir', '--arm64']);
await fs.access(appPath);

const stagingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sonic-atlas-dmg-'));
try {
  await run('ditto', [appPath, path.join(stagingDir, 'Sonic Atlas.app')]);
  await fs.symlink('/Applications', path.join(stagingDir, 'Applications'));
  await run('diskutil', [
    'image',
    'create',
    'from',
    '--format',
    'UDZO',
    '--volumeName',
    'Sonic Atlas',
    stagingDir,
    temporaryDmg,
  ]);
  await fs.rename(temporaryDmg, finalDmg);
} finally {
  await fs.rm(stagingDir, { recursive: true, force: true });
  await fs.rm(temporaryDmg, { force: true });
}

console.log(`Created ${finalDmg}`);
