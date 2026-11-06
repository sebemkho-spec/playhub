import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  ISLAND_TRANSFORM,
  SHORE,
  BASE,
  TERRACES,
  STAIRS,
  TREES,
  BUSHES,
  ROCKS,
  STONES,
  STATUES,
  STATUE_BLOCKS,
} from './layout.js';
import { materials } from './materials.js';
import { theme } from './theme.js';

// What things look like comes from the theme (theme.js → shapes). Only the look:
// positions and colliders below are the same whatever the shapes are.
const SHAPES = theme.shapes;
const ROUND = SHAPES.rounding;

const DEG = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

/** The island's fixed placement in the world (the intro animation moves a copy, not this). */
export const islandMatrix = new THREE.Matrix4().compose(
  new THREE.Vector3(...ISLAND_TRANSFORM.position),
  new THREE.Quaternion().setFromAxisAngle(UP, ISLAND_TRANSFORM.rotationY),
  new THREE.Vector3().setScalar(ISLAND_TRANSFORM.scale),
);
const islandQuat = new THREE.Quaternion().setFromAxisAngle(UP, ISLAND_TRANSFORM.rotationY);
const S = ISLAND_TRANSFORM.scale;

export const islandToWorld = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(islandMatrix);
export const islandYawToWorld = (deg) => deg * DEG + ISLAND_TRANSFORM.rotationY;

/** Height of the walkable ground at (x, z), island units. */
export function groundHeight(x, z) {
  let h = 0;
  for (const t of TERRACES) {
    if (Math.abs(x - t.x) <= t.half && Math.abs(z - t.z) <= t.half) h = Math.max(h, t.top);
  }
  return h;
}

/** Smoothed shoreline as an array of {x, z} (island units). */
export function shorelinePoints(count = 120) {
  const curve = new THREE.CatmullRomCurve3(
    SHORE.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    true,
    'centripetal',
  );
  return curve.getSpacedPoints(count).slice(0, -1).map((p) => ({ x: p.x, z: p.z }));
}

/** Convert an island-space collider spec to world space for Rapier. */
export function colliderToWorld(spec) {
  const out = { kind: spec.kind, group: spec.group };
  const localQuat = spec.quaternion ?? new THREE.Quaternion().setFromAxisAngle(UP, spec.yaw ?? 0);
  if (spec.center) out.center = spec.center.clone().applyMatrix4(islandMatrix);
  out.quaternion = islandQuat.clone().multiply(localQuat);
  if (spec.kind === 'box') out.half = spec.half.clone().multiplyScalar(S);
  if (spec.kind === 'ball') out.radius = spec.radius * S;
  if (spec.kind === 'cylinder') {
    out.radius = spec.radius * S;
    out.halfHeight = spec.halfHeight * S;
  }
  if (spec.kind === 'hull') {
    const pts = new Float32Array(spec.points.length);
    const v = new THREE.Vector3();
    for (let i = 0; i < spec.points.length; i += 3) {
      v.set(spec.points[i], spec.points[i + 1], spec.points[i + 2]).applyMatrix4(islandMatrix);
      pts[i] = v.x;
      pts[i + 1] = v.y;
      pts[i + 2] = v.z;
    }
    out.points = pts;
    delete out.center;
    delete out.quaternion;
  }
  return out;
}

function mesh(geometry, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** Tiny deterministic random so the island looks the same every visit. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** A box with its edges rounded by `radius` (0 = the plain sharp box). */
function box(width, height, depth, radius = 0, segments = 3) {
  const r = Math.min(radius, (Math.min(width, height, depth) / 2) * 0.98);
  return r > 0.001 ? new RoundedBoxGeometry(width, height, depth, segments, r) : new THREE.BoxGeometry(width, height, depth);
}

/** A flat square pad with rounded corners (`roundness` 1 = a disc), centred on y = 0. */
function padGeometry(size, height, roundness) {
  const h = size / 2;
  const r = Math.min(roundness, 1) * h * 0.98;
  const s = new THREE.Shape();
  s.moveTo(-h + r, -h);
  s.lineTo(h - r, -h);
  s.absarc(h - r, -h + r, r, -Math.PI / 2, 0, false);
  s.lineTo(h, h - r);
  s.absarc(h - r, h - r, r, 0, Math.PI / 2, false);
  s.lineTo(-h + r, h);
  s.absarc(-h + r, h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-h, -h + r);
  s.absarc(-h + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
  const geo = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -height / 2, 0);
  return geo;
}

/** One strand of a helix: it winds up around the tree's centre line, narrowing from r0 to r1. */
class HelixCurve extends THREE.Curve {
  constructor(r0, r1, height, turns, phase) {
    super();
    Object.assign(this, { r0, r1, height, turns, phase });
  }

  getPoint(u, target = new THREE.Vector3()) {
    const r = this.r0 + (this.r1 - this.r0) * u;
    const a = this.phase + u * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * r, -0.05 + u * (this.height + 0.05), Math.sin(a) * r);
  }
}

/** Narrow a TubeGeometry from `from` to `to` times its radius along its length. */
function taperTube(geo, curve, segments, radial, from, to) {
  const pos = geo.attributes.position;
  const centre = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    curve.getPointAt(i / segments, centre);
    const k = from + (to - from) * (i / segments);
    for (let j = 0; j <= radial; j++) {
      const index = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, index).sub(centre).multiplyScalar(k).add(centre);
      pos.setXYZ(index, v.x, v.y, v.z);
    }
  }
}

/**
 * A soft double helix sized from the pine it replaces: two strands twisting around
 * each other, joined by rungs, rounded off at the top. Returns the geometry plus
 * its height and its radius at the top (where the glowing orb sits).
 */
function helixGeometry(t) {
  const { height: heightShare, width, turns: baseTurns, taper } = SHAPES.helix;
  const height = (t.th + t.h) * heightShare;
  const r0 = t.r * width;
  const r1 = r0 * taper;
  const turns = baseTurns * Math.sqrt(height / 3);
  const tube = THREE.MathUtils.clamp(r0 * 0.2, 0.055, 0.15);
  const segments = Math.ceil(48 * turns);
  const radial = 10;
  const strands = [0, Math.PI].map((phase) => new HelixCurve(r0, r1, height, turns, phase));

  const parts = [];
  for (const curve of strands) {
    const strand = new THREE.TubeGeometry(curve, segments, tube, radial, false);
    taperTube(strand, curve, segments, radial, 1, 0.7);
    const top = curve.getPointAt(1);
    parts.push(strand, new THREE.SphereGeometry(tube * 0.7, 12, 8).translate(top.x, top.y, top.z));
  }
  const rungs = Math.max(3, Math.round(turns * 5));
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let k = 0; k < rungs; k++) {
    const u = 0.14 + (0.78 * (k + 0.5)) / rungs;
    strands[0].getPoint(u, a);
    strands[1].getPoint(u, b);
    const rung = new THREE.CylinderGeometry(tube * 0.45, tube * 0.45, a.distanceTo(b), 8, 1, true);
    rung.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.subVectors(b, a).normalize()));
    rung.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(rung);
  }
  const geometry = mergeGeometries(parts);

  // a gentle shading, a little deeper at the foot (multiplies the surface colour)
  const pos = geometry.attributes.position;
  const shade = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = 0.8 + 0.35 * THREE.MathUtils.clamp(pos.getY(i) / height, 0, 1);
    shade[i * 3] = shade[i * 3 + 1] = shade[i * 3 + 2] = k;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(shade, 3));
  return { geometry, height, top: r1 };
}

// A puff is a few overlapping spheres: [x, y, z, radius] as shares of the bush's radius.
const PUFF_LUMPS = [
  [0, 0.14, 0, 0.74],
  [0.5, -0.1, 0.16, 0.54],
  [-0.48, -0.12, 0.2, 0.5],
  [0.04, -0.08, -0.46, 0.55],
];

function puffGeometry(r) {
  return mergeGeometries(PUFF_LUMPS.map(([x, y, z, s]) => new THREE.SphereGeometry(s * r, 18, 12).translate(x * r, y * r, z * r)));
}

function buildBase(group, colliders) {
  const outline = shorelinePoints(120);
  const shape = new THREE.Shape(outline.map((p) => new THREE.Vector2(p.x, p.z)));

  // Extrude downward: shape (x, z) → top face at y = 0
  const slab = (depth) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(Math.PI / 2);
    return geo;
  };

  const sand = mesh(slab(BASE.sandDepth), materials.sand, { cast: false });
  sand.name = 'sand';
  group.add(sand);

  const cliff = mesh(slab(BASE.thickness - BASE.sandDepth + 0.01), materials.cliff, { cast: false });
  cliff.position.y = -BASE.sandDepth + 0.005;
  cliff.name = 'cliff';
  group.add(cliff);

  // One flat floor collider under the whole island; the shoreline walls keep you on the sand.
  const xs = outline.map((p) => p.x);
  const zs = outline.map((p) => p.z);
  const minX = Math.min(...xs) - 1;
  const maxX = Math.max(...xs) + 1;
  const minZ = Math.min(...zs) - 1;
  const maxZ = Math.max(...zs) + 1;
  colliders.push({
    kind: 'box',
    group: 'terrain',
    center: new THREE.Vector3((minX + maxX) / 2, -1, (minZ + maxZ) / 2),
    half: new THREE.Vector3((maxX - minX) / 2, 1, (maxZ - minZ) / 2),
  });

  // Invisible walls along the shoreline.
  const walls = shorelinePoints(72);
  let area = 0;
  for (let i = 0; i < walls.length; i++) {
    const a = walls[i];
    const b = walls[(i + 1) % walls.length];
    area += a.x * b.z - b.x * a.z;
  }
  const outwardSign = area > 0 ? 1 : -1;
  const inset = 0.2; // the wall's inner face sits this far inside the visible edge
  const thickness = 1.2;
  for (let i = 0; i < walls.length; i++) {
    const a = walls[i];
    const b = walls[(i + 1) % walls.length];
    const tx = b.x - a.x;
    const tz = b.z - a.z;
    const len = Math.hypot(tx, tz);
    const nx = (tz / len) * outwardSign;
    const nz = (-tx / len) * outwardSign;
    const offset = thickness / 2 - inset;
    colliders.push({
      kind: 'box',
      group: 'walls',
      center: new THREE.Vector3((a.x + b.x) / 2 + nx * offset, 4, (a.z + b.z) / 2 + nz * offset),
      half: new THREE.Vector3(len / 2 + 0.25, 7, thickness / 2),
      yaw: Math.atan2(-tz, tx),
    });
  }
  return outline;
}

function buildTerraces(group, colliders) {
  for (const t of TERRACES) {
    const size = t.half * 2;
    const dirtHeight = t.top - t.cap + 0.05;
    const round = Math.min(ROUND.terraces, t.cap * 0.49); // the wall and its grass cap get the same softness
    const dirt = mesh(box(size, dirtHeight, size, round, 4), materials[`${t.tone}Dirt`]);
    dirt.position.set(t.x, -0.05 + dirtHeight / 2, t.z);
    const grass = mesh(box(size, t.cap, size, round, 4), materials[`${t.tone}Grass`]);
    grass.position.set(t.x, t.top - t.cap / 2, t.z);
    dirt.name = `${t.id}-dirt`;
    grass.name = `${t.id}-grass`;
    group.add(dirt, grass);

    colliders.push({
      kind: 'box',
      group: 'terrain',
      center: new THREE.Vector3(t.x, (t.top - 0.05) / 2, t.z),
      half: new THREE.Vector3(t.half, (t.top + 0.05) / 2, t.half),
    });
  }
}

function buildStairs(group, colliders) {
  for (const s of STAIRS) {
    const dir = Math.sign(s.to - s.from);
    const depth = Math.abs(s.to - s.from) / s.steps;
    const sample = (along) => (s.axis === 'z' ? groundHeight(s.at, along) : groundHeight(along, s.at));
    const bottom = sample(s.from - dir * 0.05);
    const top = sample(s.to + dir * 0.12);
    const rise = (top - bottom) / (s.steps + 1);

    for (let i = 0; i < s.steps; i++) {
      const a0 = s.from + dir * depth * i;
      const a1 = s.from + dir * depth * (i + 1) + (i === s.steps - 1 ? dir * 0.06 : 0);
      const yb = bottom - 0.06;
      const yt = bottom + rise * (i + 1);
      const h = yt - yb;
      const along = (a0 + a1) / 2;
      const len = Math.abs(a1 - a0);
      const size = s.axis === 'z' ? [s.width, h, len] : [len, h, s.width];
      const pos = s.axis === 'z' ? [s.at, yb + h / 2, along] : [along, yb + h / 2, s.at];
      const step = mesh(box(...size, ROUND.stairs, 2), materials.marble);
      step.position.set(...pos);
      step.name = 'stair';
      group.add(step);
      colliders.push({
        kind: 'box',
        group: 'terrain',
        center: new THREE.Vector3(...pos),
        half: new THREE.Vector3(size[0] / 2, size[1] / 2, size[2] / 2),
      });
    }
  }
}

function buildStones(group) {
  for (const s of STONES) {
    const geo = ROUND.stones > 0 ? padGeometry(s.size, 0.06, ROUND.stones) : new THREE.BoxGeometry(s.size, 0.06, s.size);
    const stone = mesh(geo, materials.steps, { cast: false });
    stone.position.set(s.x, groundHeight(s.x, s.z) + 0.018, s.z);
    stone.rotation.y = s.rot * DEG;
    group.add(stone);
  }
}

/** A low-poly pine: a cone of leaves on a short trunk. */
function addPine(tree, t, cache) {
  const trunk = mesh(new THREE.CylinderGeometry(t.tr * 0.78, t.tr, t.th + 0.06, 7), materials.wood);
  trunk.position.y = (t.th + 0.06) / 2 - 0.06;
  const key = `${t.r}-${t.h}`;
  if (!cache.has(key)) cache.set(key, new THREE.ConeGeometry(t.r, t.h, 12, 2));
  const leaves = mesh(cache.get(key), materials.treeLeaves);
  leaves.position.y = t.th + t.h / 2;
  tree.add(trunk, leaves);
}

/** A soft glassy double helix holding a glowing orb at the top, standing where the pine would. */
function addHelix(tree, t, cache) {
  const key = `${t.r}-${t.th + t.h}`;
  if (!cache.has(key)) cache.set(key, helixGeometry(t));
  const { geometry, height, top } = cache.get(key);
  const strands = mesh(geometry, materials.treeLeaves);
  const orbRadius = THREE.MathUtils.clamp(top * 0.55, 0.09, 0.24);
  const orb = mesh(new THREE.SphereGeometry(orbRadius, 20, 14), materials.treeGlow, { cast: false });
  orb.position.y = height - orbRadius * 0.15;
  tree.add(strands, orb);
}

function buildTrees(group, colliders) {
  const rand = seeded(7);
  const cache = new Map();
  const helixes = SHAPES.trees === 'helix';
  if (helixes) materials.treeLeaves.vertexColors = true; // the helixes' gentle foot-to-top shading
  for (const t of TREES) {
    const g = groundHeight(t.x, t.z);
    const tree = new THREE.Group();
    tree.position.set(t.x, g, t.z);
    tree.rotation.y = rand() * Math.PI * 2;
    if (helixes) addHelix(tree, t, cache);
    else addPine(tree, t, cache);
    tree.name = 'tree';
    group.add(tree);

    // Convex hull around trunk + cone (like the original), so you bump into the canopy edge.
    // It stays the same with helixes: the shapes only change the look.
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      pts.push(t.x + Math.cos(a) * t.tr, g, t.z + Math.sin(a) * t.tr);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      pts.push(t.x + Math.cos(a) * t.r * 0.92, g + t.th, t.z + Math.sin(a) * t.r * 0.92);
    }
    pts.push(t.x, g + t.th + t.h, t.z);
    colliders.push({ kind: 'hull', group: 'props', points: pts });
  }
}

function buildBushes(group, colliders) {
  const geo = new Map();
  const puffs = SHAPES.bushes === 'puff';
  const rand = seeded(11);
  for (const b of BUSHES) {
    if (!geo.has(b.r)) geo.set(b.r, puffs ? puffGeometry(b.r) : new THREE.IcosahedronGeometry(b.r, 1));
    const bush = mesh(geo.get(b.r), materials[`${b.tone}Bushes`]);
    const y = groundHeight(b.x, b.z) + b.r * 0.72;
    bush.position.set(b.x, y, b.z);
    bush.scale.x = 0.94;
    if (puffs) bush.rotation.y = rand() * Math.PI * 2; // so the puffs don't all face the same way
    bush.name = 'bush';
    group.add(bush);
    colliders.push({ kind: 'ball', group: 'props', center: new THREE.Vector3(b.x, y, b.z), radius: b.r * 0.92 });
  }
}

function buildRocks(group, colliders) {
  for (const r of ROCKS) {
    const rock = mesh(box(r.size, r.height, r.size, (ROUND.rocks * Math.min(r.size, r.height)) / 2, 4), materials.rock);
    const y = groundHeight(r.x, r.z) + r.height / 2 - 0.02;
    rock.position.set(r.x, y, r.z);
    rock.rotation.y = r.rot * DEG;
    rock.name = 'rock';
    group.add(rock);
    colliders.push({
      kind: 'box',
      group: 'props',
      center: new THREE.Vector3(r.x, y, r.z),
      half: new THREE.Vector3(r.size / 2, r.height / 2, r.size / 2),
      yaw: r.rot * DEG,
    });
  }
}

function buildStatues(group, colliders) {
  for (const s of STATUES) {
    const statue = new THREE.Group();
    const g = groundHeight(s.x, s.z);
    statue.position.set(s.x, g, s.z);
    statue.rotation.y = s.rot * DEG;
    const yaw = s.rot * DEG;
    const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    for (const b of STATUE_BLOCKS) {
      const block = mesh(box(...b.s, (ROUND.statues * Math.min(...b.s)) / 2, 3), materials.stone);
      block.position.set(...b.p);
      block.name = `statue-${b.name}`;
      statue.add(block);
      const center = new THREE.Vector3(...b.p).applyQuaternion(q).add(new THREE.Vector3(s.x, g, s.z));
      colliders.push({
        kind: 'box',
        group: 'props',
        center,
        half: new THREE.Vector3(b.s[0] / 2, b.s[1] / 2, b.s[2] / 2),
        yaw,
      });
    }
    group.add(statue);
  }
}

/**
 * Build the island. Returns the root group (already placed in the world),
 * sub-groups the intro animates, and collider specs in island space.
 */
export function buildIsland() {
  const root = new THREE.Group();
  root.name = 'island';
  root.position.set(...ISLAND_TRANSFORM.position);
  root.rotation.y = ISLAND_TRANSFORM.rotationY;
  root.scale.setScalar(ISLAND_TRANSFORM.scale);

  const ground = new THREE.Group();
  ground.name = 'ground';
  const flora = new THREE.Group();
  flora.name = 'flora';
  const statues = new THREE.Group();
  statues.name = 'statues';
  root.add(ground, flora, statues);

  const colliders = [];
  const outline = buildBase(ground, colliders);
  buildTerraces(ground, colliders);
  buildStairs(ground, colliders);
  buildStones(ground);
  buildBushes(ground, colliders);
  buildRocks(ground, colliders);
  buildTrees(flora, colliders);
  buildStatues(statues, colliders);

  return { root, ground, flora, statues, colliders, outline };
}
