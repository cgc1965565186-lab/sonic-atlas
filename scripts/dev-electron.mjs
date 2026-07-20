import { spawn } from 'node:child_process';
import process from 'node:process';
import electronPath from 'electron';

const root = new URL('..', import.meta.url);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const vite = spawn(npmCommand, ['run', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});

async function waitForVite() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch('http://127.0.0.1:5173');
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Vite did not start in time');
}

let electron = null;
function shutdown(code = 0) {
  if (electron && !electron.killed) electron.kill('SIGTERM');
  if (!vite.killed) vite.kill('SIGTERM');
  process.exitCode = code;
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

try {
  await waitForVite();
  electron = spawn(electronPath, ['.'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5173' },
  });
  electron.on('exit', (code) => shutdown(code ?? 0));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
}
