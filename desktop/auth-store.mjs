import fs from 'node:fs/promises';
import path from 'node:path';

const AUTH_FILE = 'netease-cookie.enc';

export function normalizeCookie(value) {
  return String(value ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/;+$/, ''))
    .filter(Boolean)
    .join('; ');
}

export function createAuthStore({ safeStorage, userDataPath }) {
  const filePath = path.join(userDataPath, 'auth', AUTH_FILE);
  let sessionCookie = '';
  let persistence = 'session';

  async function encryptionAvailable() {
    if (typeof safeStorage.isAsyncEncryptionAvailable === 'function') {
      return safeStorage.isAsyncEncryptionAvailable();
    }
    return safeStorage.isEncryptionAvailable();
  }

  async function encrypt(value) {
    if (typeof safeStorage.encryptStringAsync === 'function') {
      return safeStorage.encryptStringAsync(value);
    }
    return safeStorage.encryptString(value);
  }

  async function decrypt(value) {
    if (typeof safeStorage.decryptStringAsync === 'function') {
      return safeStorage.decryptStringAsync(value);
    }
    return { result: safeStorage.decryptString(value), shouldReEncrypt: false };
  }

  async function load() {
    if (!(await encryptionAvailable())) return '';
    try {
      const encrypted = await fs.readFile(filePath);
      const decrypted = await decrypt(encrypted);
      sessionCookie = normalizeCookie(decrypted.result);
      persistence = sessionCookie ? 'encrypted' : 'session';
      if (sessionCookie && decrypted.shouldReEncrypt) await save(sessionCookie);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        sessionCookie = '';
        persistence = 'session';
      }
    }
    return sessionCookie;
  }

  async function save(cookie) {
    sessionCookie = normalizeCookie(cookie);
    persistence = 'session';
    if (!sessionCookie || !(await encryptionAvailable())) return persistence;

    try {
      const encrypted = await encrypt(sessionCookie);
      await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
      await fs.writeFile(filePath, encrypted, { mode: 0o600 });
      persistence = 'encrypted';
    } catch {
      // Keep the credential in memory for this session. Never fall back to plaintext.
      persistence = 'session';
    }
    return persistence;
  }

  async function clear() {
    sessionCookie = '';
    persistence = 'session';
    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  return {
    load,
    save,
    clear,
    getCookie: () => sessionCookie,
    getPersistence: () => persistence,
  };
}
