/**
 * A tiny shared store. UI and world both read from it and subscribe to changes,
 * so the corner buttons and the in-world switches always agree.
 */
function readPref(key, fallback) {
  try {
    const value = localStorage.getItem(`playhub:${key}`);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function writePref(key, value) {
  try {
    localStorage.setItem(`playhub:${key}`, JSON.stringify(value));
  } catch {
    /* private mode etc. */
  }
}

function createStore(initial) {
  let state = { ...initial };
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      const prev = state;
      state = { ...state, ...patch };
      for (const fn of listeners) fn(state, prev);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const store = createStore({
  theme: readPref('theme', 'light'), // 'light' | 'dark'
  sound: readPref('sound', true),
  started: false,
  activePortal: null, // id of the portal whose card is open
});

store.subscribe((state, prev) => {
  if (state.theme !== prev.theme) writePref('theme', state.theme);
  if (state.sound !== prev.sound) writePref('sound', state.sound);
});

const media = (q) => typeof window !== 'undefined' && !!window.matchMedia?.(q).matches;

/** Phones and tablets (primary input is a finger). Touch laptops count as desktop. */
export const isTouchDevice =
  media('(pointer: coarse)') || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && !media('(any-pointer: fine)'));

export const prefersReducedMotion = media('(prefers-reduced-motion: reduce)');
