// Saves and loads the best score and the mute setting in localStorage, quietly doing nothing where storage is blocked.
const BEST_KEY = 'prism-warden.best-score';
const MUTE_KEY = 'prism-warden.muted';

export function loadBestScore() {
  try {
    return Math.max(0, Number(localStorage.getItem(BEST_KEY)) || 0);
  } catch {
    return 0;
  }
}

/** Stores `score` if it beats the saved best; returns the best after the call. */
export function saveBestScore(score) {
  const best = loadBestScore();
  if (score <= best) return best;
  try {
    localStorage.setItem(BEST_KEY, String(Math.floor(score)));
  } catch {
    // Storage blocked (private mode, file://): the best lives for this page only.
  }
  return score;
}

export function loadMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Not persisted; the toggle still works for this session.
  }
}
