import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const MAX_ENTRIES = 200;
const MAX_STRING = 320;
const URL_PATTERN = /https?:\/\/\S+/gi;
const COOKIE_PATTERN = /(MUSIC_[UA]|cookie|authorization)\s*[=:]\s*[^,\s;]+/gi;
const ABSOLUTE_PATH_PATTERN = /(?:\/Users\/|\/private\/|\/Volumes\/)[^\s,;]+/g;

function cleanString(value) {
  return String(value)
    .replace(URL_PATTERN, '[已隐藏地址]')
    .replace(COOKIE_PATTERN, '[已隐藏凭据]')
    .replace(ABSOLUTE_PATH_PATTERN, '[已隐藏路径]')
    .slice(0, MAX_STRING);
}

export function sanitizeDiagnosticValue(value, depth = 0) {
  if (depth > 3) return '[已截断]';
  if (value instanceof Error) {
    return { name: cleanString(value.name), message: cleanString(value.message), code: cleanString(value.code ?? '') };
  }
  if (typeof value === 'string') return cleanString(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 30).map((item) => sanitizeDiagnosticValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/cookie|authorization|filepath|path|url/i.test(key))
        .slice(0, 30)
        .map(([key, item]) => [key, sanitizeDiagnosticValue(item, depth + 1)]),
    );
  }
  return cleanString(value);
}

export function createDiagnostics({ userDataPath, appVersion }) {
  const diagnosticsDir = path.join(userDataPath, 'diagnostics');
  const logPath = path.join(diagnosticsDir, 'events.jsonl');
  let entries = [];

  async function load() {
    try {
      const lines = (await fs.readFile(logPath, 'utf8')).trim().split(/\r?\n/).filter(Boolean);
      entries = lines.slice(-MAX_ENTRIES).map((line) => JSON.parse(line));
    } catch {
      entries = [];
    }
  }

  function record(level, event, details = {}) {
    const entry = {
      at: new Date().toISOString(),
      level: ['info', 'warn', 'error'].includes(level) ? level : 'info',
      event: cleanString(event),
      details: sanitizeDiagnosticValue(details),
    };
    entries = [...entries.slice(-(MAX_ENTRIES - 1)), entry];
    void (async () => {
      await fs.mkdir(diagnosticsDir, { recursive: true, mode: 0o700 });
      const content = `${entries.map((item) => JSON.stringify(item)).join('\n')}\n`;
      await fs.writeFile(logPath, content, { mode: 0o600 });
    })().catch(() => {});
    return entry;
  }

  function report({ localLibrary, audioStatus = 'unknown', quality = 'unknown', authenticated = false } = {}) {
    return {
      generatedAt: new Date().toISOString(),
      app: { name: 'Sonic Atlas', version: appVersion },
      system: {
        platform: process.platform,
        release: os.release(),
        arch: process.arch,
        electron: process.versions.electron,
        chromium: process.versions.chrome,
      },
      status: {
        audio: cleanString(audioStatus),
        quality: cleanString(quality),
        neteaseAuthenticated: Boolean(authenticated),
        localLibrary: localLibrary?.stats?.() ?? { total: 0, missing: 0, roots: 0 },
      },
      privacy: '报告已移除凭据、完整网络地址和本地文件路径。',
      events: entries.slice(-MAX_ENTRIES),
    };
  }

  return { load, record, report };
}

export function isExpectedCancellation(error) {
  const name = String(error?.name ?? '');
  const code = String(error?.code ?? '');
  return name === 'AbortError'
    || name === 'TimeoutError'
    || code === 'ERR_STREAM_PREMATURE_CLOSE'
    || code === 'ECONNRESET';
}
