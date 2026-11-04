import * as THREE from 'three';

/** Colours are the original scene's linear values, so the island matches it. */
const linear = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);

function standard(color, roughness = 1, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra });
}

export const materials = {
  lightDirt: standard(linear(0.2234, 0.1086, 0.0307), 0.5),
  lightGrass: standard(linear(0.1878, 0.3224, 0.046), 1),
  darkDirt: standard(linear(0.14, 0.0694, 0.0206), 0.5),
  darkGrass: standard(linear(0.0386, 0.1498, 0.0215), 1),
  treeLeaves: standard(linear(0.0345, 0.2049, 0.0497), 0.8, { flatShading: true }),
  wood: standard(linear(0.1653, 0.0656, 0.0254), 1, { flatShading: true }),
  lightBushes: standard(linear(0.3687, 0.4064, 0.0442), 0.5, { flatShading: true }),
  darkBushes: standard(linear(0.1021, 0.4064, 0.1196), 0.5, { flatShading: true }),
  rock: standard(linear(0.1706, 0.1706, 0.1706), 1),
  steps: standard(linear(0.4527, 0.3631, 0.2144), 0.5),
  marble: standard(linear(0.7923, 0.8, 0.6717), 0.5),
  stone: standard(linear(0.4227, 0.4292, 0.3241), 1),

  // New for the playhub: the sandy base and its cliffs
  sand: standard(linear(0.62, 0.47, 0.27), 1),
  cliff: standard(linear(0.16, 0.085, 0.035), 0.9, { flatShading: true }),

  // Portal trims
  vinyl: standard(new THREE.Color('#15131c'), 0.28),
  vinylGroove: standard(new THREE.Color('#2a2635'), 0.4),
  gold: new THREE.MeshStandardMaterial({ color: new THREE.Color('#e7b84f'), roughness: 0.38, metalness: 0.35 }),
  cloud: standard(new THREE.Color('#ffffff'), 0.85),
  bubble: standard(new THREE.Color('#fffaf0'), 0.6),
};
