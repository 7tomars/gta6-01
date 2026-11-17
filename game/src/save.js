// save.js — karier Riko di localStorage: uang, tahap cerita, total perolehan.
// Storage bisa disuntikkan (harness uji memakai tiruan di memori).

const SAVE_KEY = 'sundara-heat-career-v2';

export function defaultSave() {
  return { money: 40, storyStage: 0, totalEarned: 0, jobsDone: 0, bestStars: 0 };
}

export function loadSave(storage) {
  const store = storage || safeLocal();
  if (!store) return defaultSave();
  try {
    const raw = store.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const base = defaultSave();
    for (const k of Object.keys(base)) {
      if (typeof data[k] === 'number' && Number.isFinite(data[k])) base[k] = data[k];
    }
    return base;
  } catch {
    return defaultSave();
  }
}

export function writeSave(storage, data) {
  const store = storage || safeLocal();
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

function safeLocal() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
