/**
 * Island layout, in "island units".
 *
 * Everything on the island (terraces, stairs, props, portals) is placed in this
 * coordinate space. The whole island is then moved/rotated/scaled once by
 * ISLAND_TRANSFORM, the same way the original Forest Trail scene does it.
 *
 *   x  → right   (island space)
 *   z  → toward the front of the island (where you spawn)
 *   y  → up
 *
 * Heights (y) of props are worked out automatically from the terrace under
 * them, so you normally only give x and z.
 */

export const ISLAND_TRANSFORM = {
  position: [-4.8, 0, -7.4],
  rotationY: -0.6, // radians
  scale: 1.3,
};

/** Where the character appears (island units, on the sandy ground). facing 34° ≈ toward the camera. */
export const SPAWN = { x: 6.26, z: 2.61, facing: 34 };

/**
 * The sandy base the terraces sit on. These points trace its shoreline and are
 * smoothed into a curve. Invisible walls follow this line so nobody walks into the sea.
 */
export const SHORE = [
  [13.2, 3.4], [10.6, 5.0], [6.6, 4.7], [2.6, 3.8], [-1.4, 4.5], [-5.4, 3.8],
  [-9.2, 4.0], [-11.4, 1.0], [-11.7, -3.5], [-11.3, -8.0], [-11.6, -12.5],
  [-10.8, -16.3], [-7.8, -17.5], [-3.5, -17.0], [0.5, -17.5], [4.6, -16.9],
  [7.7, -15.7], [9.8, -12.9], [11.7, -10.0], [12.6, -6.2], [12.8, -2.6], [13.8, 0.4],
];

export const BASE = {
  thickness: 0.72, // sand + rock below the waterline
  sandDepth: 0.16, // the light band at the top edge
};

/** Square plateaus with a grass cap (reference: terrain, terrain001-003). */
export const TERRACES = [
  { id: 'summit', x: -5.276, z: -11.318, half: 3.81, top: 3.41, cap: 0.67, tone: 'light' },
  { id: 'upper', x: 1.741, z: -11.216, half: 3.54, top: 2.485, cap: 0.48, tone: 'light' },
  { id: 'middle', x: 2.14, z: -5.445, half: 2.73, top: 1.679, cap: 0.33, tone: 'dark' },
  { id: 'lower', x: 3.125, z: -2.881, half: 2.62, top: 0.957, cap: 0.18, tone: 'dark' },
];

/**
 * Marble staircases. Each runs along `axis` from `from` (bottom) to `to`
 * (the edge of the terrace above), centred on `at` across the other axis.
 * Step heights are derived from the ground at both ends.
 */
export const STAIRS = [
  { axis: 'z', at: 4.157, width: 2.5, from: 1.3, to: -0.26, steps: 3 }, // sand -> lower
  { axis: 'z', at: 3.59, width: 2.1, from: -1.45, to: -2.715, steps: 2 }, // lower -> middle
  { axis: 'z', at: 2.38, width: 2.4, from: -6.2, to: -7.676, steps: 3 }, // middle -> upper
  { axis: 'x', at: -11.2, width: 2.6, from: 0.05, to: -1.466, steps: 3 }, // upper -> summit
];

/** Cone trees: leaf radius / height, trunk radius / height (reference trees, trees001-010). */
export const TREES = [
  { x: -8.177, z: -8.936, r: 0.81, h: 2.38, tr: 0.18, th: 0.46 },
  { x: -6.818, z: -8.284, r: 0.61, h: 1.78, tr: 0.13, th: 0.34 },
  { x: -8.076, z: -14.31, r: 0.78, h: 3.25, tr: 0.17, th: 0.62 },
  { x: -0.4, z: -13.7, r: 0.6, h: 2.61, tr: 0.13, th: 0.5 },
  { x: 0.667, z: -14.137, r: 0.44, h: 1.93, tr: 0.09, th: 0.37 },
  { x: 4.137, z: -14.078, r: 0.68, h: 1.99, tr: 0.15, th: 0.38 },
  { x: 4.822, z: -12.797, r: 0.47, h: 1.51, tr: 0.1, th: 0.29 },
  { x: 7.032, z: -4.177, r: 0.71, h: 3.08, tr: 0.15, th: 0.59 },
  { x: 6.723, z: -2.196, r: 0.51, h: 2.37, tr: 0.11, th: 0.45 },
  { x: -7.592, z: -5.301, r: 1.36, h: 4.71, tr: 0.27, th: 0.9 },
  { x: -8.559, z: -2.885, r: 1.03, h: 3.04, tr: 0.23, th: 0.58 },
];

/** Round low-poly bushes (reference bushes, bushes001-006). */
export const BUSHES = [
  { x: 4.503, z: -9.658, r: 0.45, tone: 'light' },
  { x: 4.503, z: -8.667, r: 0.45, tone: 'light' },
  { x: 4.189, z: -6.614, r: 0.44, tone: 'light' },
  { x: 1.104, z: -1.889, r: 0.38, tone: 'light' },
  { x: 1.104, z: -0.945, r: 0.38, tone: 'light' },
  { x: -6.615, z: -14.342, r: 0.43, tone: 'dark' },
  { x: -5.677, z: -14.342, r: 0.43, tone: 'dark' },
];

/** Boulders: width/depth `size`, `height`, turned `rot` degrees (reference rocks*, blocks*). */
export const ROCKS = [
  { x: -5.419, z: -3.291, size: 2.243, height: 2.243, rot: 30.2 },
  { x: -4.152, z: -4.894, size: 1.326, height: 1.58, rot: 17 },
  { x: -3.996, z: -14.1, size: 1.326, height: 1.326, rot: -20.3 },
  { x: -2.738, z: -14.477, size: 0.926, height: 0.926, rot: 0 },
  { x: -2.418, z: -13.648, size: 0.561, height: 0.561, rot: 0 },
  { x: 4.759, z: -11.536, size: 0.561, height: 0.561, rot: 9.8 },
  { x: 4.846, z: -10.881, size: 0.439, height: 0.439, rot: 20.3 },
  { x: 6.854, z: -11.255, size: 1.783, height: 2.215, rot: 33.9 },
  { x: 6.122, z: -9.524, size: 1.221, height: 1.221, rot: -3.6 },
];

/** Flat stepping stones marking the trail (decoration only, reference steps*). */
export const STONES = [
  { x: -7.304, z: -11.188, size: 1.003, rot: 7.9 },
  { x: -5.597, z: -11.561, size: 1.025, rot: -1.1 },
  { x: -4.145, z: -11.044, size: 1.059, rot: 7.2 },
  { x: -2.526, z: -11.288, size: 0.948, rot: -10.3 },
  { x: 1.754, z: -10.058, size: 0.795, rot: -27.7 },
  { x: 0.64, z: -11.026, size: 0.748, rot: 10.8 },
  { x: 2.226, z: -11.725, size: 0.818, rot: 19.3 },
  { x: 2.407, z: -12.982, size: 0.919, rot: 5.2 },
  { x: 2.294, z: -8.728, size: 0.694, rot: -14.6 },
  { x: 2.543, z: -5.675, size: 0.605, rot: -9 },
  { x: 1.736, z: -4.563, size: 0.663, rot: -18.8 },
  { x: 2.733, z: -3.506, size: 0.83, rot: 1.2 },
  { x: 3.344, z: -1.273, size: 0.627, rot: 0 },
  // a few extra stones on the sand leading to the ground-level portals
  { x: 1.2, z: 2.2, size: 0.7, rot: 12 },
  { x: -1.4, z: 2.0, size: 0.82, rot: -8 },
  { x: -3.7, z: 1.6, size: 0.66, rot: 21 },
  { x: 8.6, z: -1.2, size: 0.72, rot: -14 },
  { x: 9.2, z: -3.7, size: 0.64, rot: 9 },
  { x: 9.4, z: -6.0, size: 0.78, rot: -22 },
];

/** Blocky stone figures with their arms out (reference blocks001-011). */
export const STATUES = [
  { x: -2.777, z: -1.726, rot: 2.1 },
  { x: 7.529, z: -6.985, rot: 63.6 },
];

/** Each statue is built from these blocks (centre x/y/z and size, statue-local). */
export const STATUE_BLOCKS = [
  { name: 'legL', p: [0.331, 0.367, 0], s: [0.326, 0.776, 0.326] },
  { name: 'legR', p: [-0.331, 0.367, 0], s: [0.326, 0.776, 0.326] },
  { name: 'hips', p: [0, 0.962, 0], s: [1.168, 0.382, 0.434] },
  { name: 'waist', p: [0, 1.334, 0], s: [1.024, 0.336, 0.38] },
  { name: 'arms', p: [0, 1.659, 0], s: [2.36, 0.344, 0.81] },
  { name: 'head', p: [0, 2.124, 0], s: [0.578, 0.544, 0.348] },
];

/** In-world light/sound switches (clickable), lying on the sand near the spawn. */
export const SWITCHES = {
  scale: 0.72,
  rot: 0,
  theme: { x: 10.4, z: -0.4 },
  sound: { x: 10.4, z: 2.0 },
};

/**
 * 3D instructions floating over the water beside the island.
 * Two placements: one for wide screens, one for narrow/portrait screens.
 */
export const INSTRUCTIONS = {
  wide: { x: 2.4, z: 6.7, rot: 0, size: 0.56 },
  narrow: { x: 11.1, z: 6.9, rot: 34, size: 0.4 }, // rot 34 ≈ facing the camera head-on
};
