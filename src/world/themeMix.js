import * as THREE from 'three';
import { theme } from './theme.js';

const tmp = new THREE.Color();

/** Blend numbers, hex colours, and objects made of those (e.g. { color, intensity }). */
function mix(a, b, t, out) {
  if (typeof a === 'number') return a + ((b ?? a) - a) * t;
  if (typeof a === 'string') return (out?.isColor ? out : new THREE.Color()).set(a).lerp(tmp.set(b ?? a), t);
  if (a && typeof a === 'object') {
    const target = out && typeof out === 'object' && !out.isColor ? out : {};
    for (const key of Object.keys(a)) target[key] = mix(a[key], b?.[key], t, target[key]);
    return target;
  }
  return t < 0.5 ? a : (b ?? a);
}

/**
 * The current mood of the active theme: t = 0 is day, t = 1 is night.
 * Colours come back as THREE.Color, everything else as numbers. Pass the
 * previous result as `out` to reuse it frame after frame.
 */
export function mixTheme(t, out = {}) {
  return mix(theme.day, theme.night, t, out);
}
