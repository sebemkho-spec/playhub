import * as THREE from 'three';

/**
 * Day and night palettes. The day values come straight from the original
 * Forest Trail scene; night is new. Swap these when you redesign the sky.
 *
 * Light intensities are physical (three.js r155+), so they match the original.
 */
export const THEMES = {
  light: {
    skyTop: '#22b8ff',
    skyHorizon: '#a6ecff',
    water: '#00c6ff',
    fog: '#a6ecff', // same as the horizon so the sea melts into the sky
    ambient: { color: '#ffffff', intensity: 0.5 },
    sun: { color: '#ff9900', intensity: 1.5 }, // warm key light, casts the shadows
    fill: { color: '#00ecff', intensity: 0.5 },
    back: { color: '#ff8800', intensity: 30 }, // warm glow behind the island
    portalLight: 6,
    portalLightActive: 50,
    portalGlow: 1,
    lamps: 0, // little lights over the in-world switches
    fireflies: 0,
    stars: 0,
    exposure: 1.7,
    bloom: 0.9,
    textGlow: 0,
  },
  dark: {
    skyTop: '#030716',
    skyHorizon: '#122650',
    water: '#0b2a63',
    fog: '#122650',
    ambient: { color: '#8ea6ff', intensity: 0.42 },
    sun: { color: '#a9c1ff', intensity: 0.42 }, // moonlight
    fill: { color: '#5a6cff', intensity: 0.22 },
    back: { color: '#7a4dff', intensity: 14 },
    portalLight: 14,
    portalLightActive: 70,
    portalGlow: 1.55,
    lamps: 2.2,
    fireflies: 1,
    stars: 1,
    exposure: 1.55,
    bloom: 1.35,
    textGlow: 0.35,
  },
};

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();

/** Blend two palettes. t = 0 → light, t = 1 → dark. Returns plain numbers/Colors. */
export function mixTheme(t, out = {}) {
  const a = THEMES.light;
  const b = THEMES.dark;
  const color = (key) => (out[key] ??= new THREE.Color()).copy(tmpA.set(a[key])).lerp(tmpB.set(b[key]), t);
  const light = (key) => {
    const target = (out[key] ??= { color: new THREE.Color(), intensity: 0 });
    target.color.copy(tmpA.set(a[key].color)).lerp(tmpB.set(b[key].color), t);
    target.intensity = THREE.MathUtils.lerp(a[key].intensity, b[key].intensity, t);
    return target;
  };
  const num = (key) => (out[key] = THREE.MathUtils.lerp(a[key], b[key], t));

  ['skyTop', 'skyHorizon', 'water', 'fog'].forEach(color);
  ['ambient', 'sun', 'fill', 'back'].forEach(light);
  ['portalLight', 'portalLightActive', 'portalGlow', 'lamps', 'fireflies', 'stars', 'exposure', 'bloom', 'textGlow'].forEach(num);
  return out;
}
