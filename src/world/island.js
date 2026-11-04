import * as THREE from 'three';
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
    const dirt = mesh(new THREE.BoxGeometry(size, dirtHeight, size), materials[`${t.tone}Dirt`]);
    dirt.position.set(t.x, -0.05 + dirtHeight / 2, t.z);
    const grass = mesh(new THREE.BoxGeometry(size, t.cap, size), materials[`${t.tone}Grass`]);
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
      const step = mesh(new THREE.BoxGeometry(...size), materials.marble);
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
    const stone = mesh(new THREE.BoxGeometry(s.size, 0.06, s.size), materials.steps, { cast: false });
    stone.position.set(s.x, groundHeight(s.x, s.z) + 0.018, s.z);
    stone.rotation.y = s.rot * DEG;
    group.add(stone);
  }
}

function buildTrees(group, colliders) {
  const rand = seeded(7);
  const leafGeo = new Map();
  for (const t of TREES) {
    const g = groundHeight(t.x, t.z);
    const tree = new THREE.Group();
    tree.position.set(t.x, g, t.z);
    tree.rotation.y = rand() * Math.PI * 2;

    const trunk = mesh(new THREE.CylinderGeometry(t.tr * 0.78, t.tr, t.th + 0.06, 7), materials.wood);
    trunk.position.y = (t.th + 0.06) / 2 - 0.06;
    const key = `${t.r}-${t.h}`;
    if (!leafGeo.has(key)) leafGeo.set(key, new THREE.ConeGeometry(t.r, t.h, 12, 2));
    const leaves = mesh(leafGeo.get(key), materials.treeLeaves);
    leaves.position.y = t.th + t.h / 2;
    tree.add(trunk, leaves);
    tree.name = 'tree';
    group.add(tree);

    // Convex hull around trunk + cone (like the original), so you bump into the canopy edge.
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
  for (const b of BUSHES) {
    if (!geo.has(b.r)) geo.set(b.r, new THREE.IcosahedronGeometry(b.r, 1));
    const bush = mesh(geo.get(b.r), materials[`${b.tone}Bushes`]);
    const y = groundHeight(b.x, b.z) + b.r * 0.72;
    bush.position.set(b.x, y, b.z);
    bush.scale.x = 0.94;
    bush.name = 'bush';
    group.add(bush);
    colliders.push({ kind: 'ball', group: 'props', center: new THREE.Vector3(b.x, y, b.z), radius: b.r * 0.92 });
  }
}

function buildRocks(group, colliders) {
  for (const r of ROCKS) {
    const rock = mesh(new THREE.BoxGeometry(r.size, r.height, r.size), materials.rock);
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
      const block = mesh(new THREE.BoxGeometry(...b.s), materials.stone);
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
