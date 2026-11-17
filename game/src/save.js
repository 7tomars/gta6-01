// Career save in localStorage: money earned, story missions finished and
// side jobs done survive a reload. Everything degrades quietly when storage
// is unavailable (private windows), keeping the session values only.

import { SAVE_KEY } from './config.js';

/** The default fresh-career record. */
export function defaultSave() {
  return { money: 120, missionIndex: 0, storyDone: false, sideJobs: 0, busts: 0, wasted: 0 };
}

/** Load the saved career, or a fresh one when there is none or it is unreadable. */
export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    return { ...defaultSave(), ...parsed };
  } catch {
    return defaultSave();
  }
}

/** Persist the career record; failures are ignored on purpose. */
export function storeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage off: the career simply lasts for this visit.
  }
}

/** Wipe the career back to a fresh start. */
export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
