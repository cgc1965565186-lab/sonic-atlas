import fs from 'node:fs/promises';
import path from 'node:path';

const STATE_VERSION = 1;
const MAX_STATE_BYTES = 512 * 1024;

function safeRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const serialized = JSON.stringify(value);
    if (Buffer.byteLength(serialized) > MAX_STATE_BYTES) return null;
    const parsed = JSON.parse(serialized);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function normalizeAppState(value) {
  const stored = safeRecord(value) ?? {};
  return {
    version: STATE_VERSION,
    onboardingComplete: stored.onboardingComplete === true,
    playerSession: safeRecord(stored.playerSession),
    visualPreferences: safeRecord(stored.visualPreferences),
  };
}

export function createAppState({ userDataPath, log = () => {} }) {
  const stateDir = path.join(userDataPath, 'state');
  const statePath = path.join(stateDir, 'app-state.json');
  let state = normalizeAppState(null);
  let saveTimer = null;
  let writeQueue = Promise.resolve();

  async function writeSnapshot() {
    const payload = `${JSON.stringify(state, null, 2)}\n`;
    writeQueue = writeQueue.catch(() => {}).then(async () => {
      await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
      const temporary = `${statePath}.tmp`;
      await fs.writeFile(temporary, payload, { mode: 0o600 });
      await fs.rename(temporary, statePath);
    });
    await writeQueue;
  }

  async function load() {
    try {
      state = normalizeAppState(JSON.parse(await fs.readFile(statePath, 'utf8')));
    } catch (error) {
      if (error?.code !== 'ENOENT') log('warn', 'app-state-load', error);
      state = normalizeAppState(null);
    }
    return snapshot();
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      void writeSnapshot().catch((error) => log('error', 'app-state-save', error));
    }, 180);
  }

  async function setOnboardingComplete(value) {
    state = { ...state, onboardingComplete: value === true };
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    await writeSnapshot();
    return state.onboardingComplete;
  }

  function setPlayerSession(value) {
    const playerSession = safeRecord(value);
    if (!playerSession) return false;
    state = { ...state, playerSession };
    scheduleSave();
    return true;
  }

  function setVisualPreferences(value) {
    const visualPreferences = safeRecord(value);
    if (!visualPreferences) return false;
    state = { ...state, visualPreferences };
    scheduleSave();
    return true;
  }

  function snapshot() {
    return normalizeAppState(state);
  }

  async function flush() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    await writeSnapshot();
  }

  return {
    load,
    snapshot,
    setOnboardingComplete,
    setPlayerSession,
    setVisualPreferences,
    flush,
  };
}
