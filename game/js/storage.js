// Saves and loads, in localStorage: the best score per difficulty, the feats earned and the mute setting.
const KEY = 'prism-warden';

function read(name, fallback) {
  try {
    return JSON.parse(localStorage.getItem(`${KEY}.${name}`)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(name, value) {
  try {
    localStorage.setItem(`${KEY}.${name}`, JSON.stringify(value));
  } catch {
    // Storage blocked (private mode, file://): progress lives for this page only.
  }
}

export function loadBestScore(mode = 'standard') {
  return Math.max(0, Number(read(`best-${mode}`, 0)) || 0);
}

/** Stores `score` if it beats the best for `mode`; returns the best after the call. */
export function saveBestScore(score, mode = 'standard') {
  const best = loadBestScore(mode);
  if (score > best) write(`best-${mode}`, Math.floor(score));
  return Math.max(best, score);
}

/** Names of the feats earned in any run so far. */
export function loadFeats() {
  return read('feats', []);
}

/** Adds newly earned feat names; returns the full list. */
export function saveFeats(names) {
  const all = [...new Set([...loadFeats(), ...names])];
  write('feats', all);
  return all;
}

export function loadMuted() {
  return read('muted', false) === true;
}

export function saveMuted(muted) {
  write('muted', muted);
}
