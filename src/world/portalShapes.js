import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { materials } from './materials.js';
import { theme } from './theme.js';

/**
 * Portal shapes. Each builder returns a group in portal space:
 * ground at y = 0, the portal faces +Z, sizes in island units.
 *
 *   { group, surface, focus, colliders, update?(time) }
 *
 * To add a new shape, write a builder here and register it in SHAPES.
 */

const portalVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const portalFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uActive;
  uniform float uAspect;
  uniform float uSeed;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) * 2.0;
    float r = length(p);
    float t = uTime * (0.55 + uActive * 0.6) + uSeed * 10.0;
    float swirl = atan(p.y, p.x) + r * 2.4 - t * 0.6;
    vec2 q = vec2(cos(swirl), sin(swirl)) * r;
    float n = fbm(q * 2.3 + vec2(t * 0.12, -t * 0.08));
    float n2 = fbm(p * 2.6 - vec2(0.0, t * 0.3));
    float energy = smoothstep(0.28, 0.92, n * 0.8 + n2 * 0.45);
    float core = exp(-r * r * 1.6);
    vec3 col = uColor * (0.5 + 1.15 * energy);
    col += mix(uColor, vec3(1.0), 0.65) * core * (0.45 + uActive * 0.5);
    float sparkle = pow(noise(p * 16.0 + vec2(t * 1.7, t)), 20.0) * 4.0;
    col += vec3(sparkle);
    col *= uIntensity * (1.0 + uActive * 0.9);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createPortalMaterial(color, seed = 0) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: 1.6 },
      uActive: { value: 0 },
      uAspect: { value: 1 },
      uSeed: { value: seed },
    },
    vertexShader: portalVertex,
    fragmentShader: portalFragment,
    side: THREE.DoubleSide,
  });
}

const DEG = Math.PI / 180;

function mesh(geometry, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/** ShapeGeometry UVs are raw coordinates; squash them into 0-1 and report the aspect ratio. */
function fitUVs(geometry) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const w = max.x - min.x;
  const h = max.y - min.y;
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - min.x) / w;
    uv[i * 2 + 1] = (pos.getY(i) - min.y) / h;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return w / h;
}

function surfaceFrom(geometry, material) {
  const aspect = geometry.type === 'PlaneGeometry'
    ? geometry.parameters.width / geometry.parameters.height
    : geometry.type === 'CircleGeometry' ? 1 : fitUVs(geometry);
  // One material per portal, so the aspect lives on it.
  material.uniforms.uAspect.value = aspect;
  const surface = new THREE.Mesh(geometry, material);
  surface.name = 'portal-surface';
  return surface;
}

const box = (center, half, quaternion) => ({ kind: 'box', center: new THREE.Vector3(...center), half: new THREE.Vector3(...half), quaternion });

/* ───────────────────────── gate: the original marble portal ───────────────────────── */
function gate({ material }) {
  const group = new THREE.Group();
  const pillarGeo = new THREE.BoxGeometry(0.38, 2.21, 0.38);
  for (const x of [-0.732, 0.732]) {
    const pillar = mesh(pillarGeo, materials.marble);
    pillar.position.set(x, 0.906, 0);
    group.add(pillar);
  }
  const lintel = mesh(new THREE.BoxGeometry(2.27, 0.65, 0.65), materials.marble);
  lintel.position.set(0, 2.159, 0);
  group.add(lintel);

  const surface = surfaceFrom(new THREE.PlaneGeometry(1.3, 1.95), material);
  surface.position.set(0, 0.95, 0);
  group.add(surface);

  return {
    group,
    surface,
    focus: new THREE.Vector3(0, 1.0, 0),
    colliders: [
      box([-0.732, 0.906, 0], [0.19, 1.105, 0.19]),
      box([0.732, 0.906, 0], [0.19, 1.105, 0.19]),
      box([0, 0.95, 0], [0.56, 0.95, 0.05]),
    ],
  };
}

/* ───────────────────────── ring: a vinyl record standing on its edge ───────────────────────── */
function makeNote(material, double) {
  const note = new THREE.Group();
  const headGeo = new THREE.SphereGeometry(0.1, 14, 10);
  const stemGeo = new THREE.BoxGeometry(0.028, 0.4, 0.028);
  const heads = double ? [-0.13, 0.13] : [0];
  for (const x of heads) {
    const head = new THREE.Mesh(headGeo, material);
    head.scale.set(1.25, 0.88, 0.7);
    head.rotation.z = 0.35;
    head.position.set(x, 0, 0);
    const stem = new THREE.Mesh(stemGeo, material);
    stem.position.set(x + 0.1, 0.2, 0);
    note.add(head, stem);
  }
  const flag = new THREE.Mesh(new THREE.BoxGeometry(double ? 0.3 : 0.17, 0.05, 0.028), material);
  if (double) flag.position.set(0, 0.39, 0);
  else {
    flag.position.set(0.17, 0.33, 0);
    flag.rotation.z = -0.7;
  }
  note.add(flag);
  return note;
}

function ring({ material, color }) {
  const group = new THREE.Group();
  const R = 1.3;
  const rIn = 0.84;
  const depth = 0.12;
  const cy = R + 0.12;

  const outer = new THREE.Shape();
  outer.absarc(0, 0, R, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  outer.holes.push(hole);
  const vinylGeo = new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 2,
    curveSegments: 56,
  });
  vinylGeo.translate(0, 0, -depth / 2);
  const vinyl = mesh(vinylGeo, materials.vinyl);
  vinyl.position.y = cy;
  group.add(vinyl);

  // grooves on both faces
  for (const rr of [0.93, 1.02, 1.11, 1.2]) {
    const geo = new THREE.TorusGeometry(rr, 0.007, 4, 72);
    for (const z of [depth / 2 + 0.027, -depth / 2 - 0.027]) {
      const groove = new THREE.Mesh(geo, materials.vinylGroove);
      groove.position.set(0, cy, z);
      group.add(groove);
    }
  }

  // glowing label rim
  const rimMaterial = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(theme.portals.ringRimGlow) });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rIn, 0.035, 8, 64), rimMaterial);
  rim.position.y = cy;
  group.add(rim);

  const surface = surfaceFrom(new THREE.CircleGeometry(rIn, 56), material);
  surface.position.y = cy;
  group.add(surface);

  // little marble cradle
  for (const x of [-0.56, 0.56]) {
    const block = mesh(new THREE.BoxGeometry(0.42, 0.3, 0.5), materials.marble);
    block.position.set(x, 0.15, 0);
    group.add(block);
  }

  // floating notes
  const noteMaterial = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(theme.portals.noteGlow) });
  const notes = [makeNote(noteMaterial, false), makeNote(noteMaterial, true), makeNote(noteMaterial, false)];
  notes.forEach((n) => group.add(n));

  const discQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  return {
    group,
    surface,
    focus: new THREE.Vector3(0, cy, 0),
    colliders: [
      { kind: 'cylinder', center: new THREE.Vector3(0, cy, 0), halfHeight: depth / 2 + 0.03, radius: R, quaternion: discQuat },
      box([-0.56, 0.15, 0], [0.21, 0.15, 0.25]),
      box([0.56, 0.15, 0], [0.21, 0.15, 0.25]),
    ],
    update(time) {
      notes.forEach((n, i) => {
        const a = time * 0.45 + i * 2.1;
        n.position.set(Math.cos(a) * 1.75, cy + 0.15 + Math.sin(time * 1.2 + i * 1.7) * 0.32 + (i - 1) * 0.35, Math.sin(a) * 0.55);
        n.rotation.y = -a + Math.PI / 2;
        n.rotation.z = Math.sin(time * 1.6 + i) * 0.2;
      });
    },
  };
}

/* ───────────────────────── frame: a gilded picture frame on a plinth ───────────────────────── */
function frame({ material }) {
  const group = new THREE.Group();
  const W = 1.5;
  const H = 2.0;
  const bar = 0.2;
  const depth = 0.2;
  const plinthH = 0.2;
  const y0 = plinthH;
  const cy = y0 + bar + H / 2;

  const plinth = mesh(new THREE.BoxGeometry(2.25, plinthH, 0.66), materials.marble);
  plinth.position.y = plinthH / 2;
  group.add(plinth);

  // its own copy of the gold, so this frame alone can lose its colour while it's locked
  const gold = materials.gold.clone();
  const horiz = new THREE.BoxGeometry(W + bar * 2, bar, depth);
  const vert = new THREE.BoxGeometry(bar, H, depth);
  const bottom = mesh(horiz, gold);
  bottom.position.set(0, y0 + bar / 2, 0);
  const top = mesh(horiz, gold);
  top.position.set(0, y0 + bar * 1.5 + H, 0);
  const left = mesh(vert, gold);
  left.position.set(-(W / 2 + bar / 2), cy, 0);
  const right = mesh(vert, gold);
  right.position.set(W / 2 + bar / 2, cy, 0);
  group.add(bottom, top, left, right);

  // inner lip
  const lipMat = gold.clone();
  lipMat.color.multiplyScalar(theme.portals.frameLipShade);
  const lipH = new THREE.BoxGeometry(W + 0.06, 0.05, depth * 0.6);
  const lipV = new THREE.BoxGeometry(0.05, H + 0.06, depth * 0.6);
  for (const y of [y0 + bar + 0.01, y0 + bar + H - 0.01]) {
    const lip = mesh(lipH, lipMat);
    lip.position.set(0, y, 0.04);
    group.add(lip);
  }
  for (const x of [-W / 2 - 0.01, W / 2 + 0.01]) {
    const lip = mesh(lipV, lipMat);
    lip.position.set(x, cy, 0.04);
    group.add(lip);
  }

  // ornaments: corner knobs and a crest
  const knob = new THREE.SphereGeometry(0.1, 16, 12);
  for (const [x, y] of [
    [-(W / 2 + bar / 2), y0 + bar / 2],
    [W / 2 + bar / 2, y0 + bar / 2],
    [-(W / 2 + bar / 2), y0 + bar * 1.5 + H],
    [W / 2 + bar / 2, y0 + bar * 1.5 + H],
  ]) {
    for (const z of [depth / 2, -depth / 2]) {
      const k = mesh(knob, gold);
      k.position.set(x, y, z);
      group.add(k);
    }
  }
  const crest = mesh(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), gold);
  crest.position.set(0, y0 + bar * 2 + H, 0);
  crest.scale.set(1.4, 1, 0.5);
  group.add(crest);

  const surface = surfaceFrom(new THREE.PlaneGeometry(W, H), material);
  surface.position.set(0, cy, 0);
  group.add(surface);

  return {
    group,
    surface,
    focus: new THREE.Vector3(0, cy, 0),
    colliders: [box([0, cy, 0], [W / 2 + bar, H / 2 + bar, depth / 2 + 0.02]), box([0, plinthH / 2, 0], [1.125, plinthH / 2, 0.33])],
    tint: [gold, lipMat], // the materials that turn dull while the portal is locked
    lockAt: new THREE.Vector3(0, cy - 0.1, depth / 2 + 0.2), // where a padlock floats, just in front
    burstSize: [W + bar * 2, H + bar * 2 + y0], // the frame's size, for the sparkles when it unlocks
  };
}

/* ───────────────────────── bubble: a speech bubble standing on its tail ───────────────────────── */
function bubbleShape({ w, h, r, bottom, tailFrom, tailTo, tip }) {
  const x0 = -w / 2;
  const x1 = w / 2;
  const yb = bottom;
  const yt = bottom + h;
  const s = new THREE.Shape();
  s.moveTo(x0 + r, yb);
  s.lineTo(tailFrom, yb);
  s.quadraticCurveTo(tailFrom - 0.02, (yb + tip[1]) * 0.55, tip[0], tip[1]);
  s.quadraticCurveTo(tailTo - 0.1, (yb + tip[1]) * 0.5, tailTo, yb);
  s.lineTo(x1 - r, yb);
  s.quadraticCurveTo(x1, yb, x1, yb + r);
  s.lineTo(x1, yt - r);
  s.quadraticCurveTo(x1, yt, x1 - r, yt);
  s.lineTo(x0 + r, yt);
  s.quadraticCurveTo(x0, yt, x0, yt - r);
  s.lineTo(x0, yb + r);
  s.quadraticCurveTo(x0, yb, x0 + r, yb);
  return s;
}

function bubble({ material, color, font }) {
  const group = new THREE.Group();
  const rim = 0.13;
  const depth = 0.18;
  const outerParams = { w: 2.45, h: 1.6, r: 0.62, bottom: 0.95, tailFrom: -0.62, tailTo: -0.05, tip: [-0.95, 0] };
  const innerParams = {
    w: outerParams.w - rim * 2,
    h: outerParams.h - rim * 2,
    r: outerParams.r - rim,
    bottom: outerParams.bottom + rim,
    tailFrom: outerParams.tailFrom + rim * 0.55,
    tailTo: outerParams.tailTo - rim * 0.7,
    tip: [outerParams.tip[0] + rim * 0.85, outerParams.tip[1] + rim * 2.6],
  };
  const outer = bubbleShape(outerParams);
  const inner = bubbleShape(innerParams);
  outer.holes.push(new THREE.Path(inner.getPoints(24)));

  const shellGeo = new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.035,
    bevelSegments: 3,
    curveSegments: 18,
  });
  shellGeo.translate(0, 0, -depth / 2);
  group.add(mesh(shellGeo, materials.bubble));

  const surface = surfaceFrom(new THREE.ShapeGeometry(inner, 24), material);
  group.add(surface);

  const cy = outerParams.bottom + outerParams.h / 2;
  const decor = [];
  if (font) {
    const textGeo = new TextGeometry('?!', { font, size: 0.62, depth: 0.07, curveSegments: 5, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 1 });
    textGeo.computeBoundingBox();
    const bb = textGeo.boundingBox;
    textGeo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, 0);
    const textMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.portals.bubbleText).multiplyScalar(theme.portals.bubbleTextGlow) });
    for (const side of [1, -1]) {
      const t = new THREE.Mesh(textGeo, textMat);
      t.position.set(0.05, cy, side * 0.06);
      if (side < 0) t.rotation.y = Math.PI;
      group.add(t);
      decor.push(t);
    }
  }

  return {
    group,
    surface,
    focus: new THREE.Vector3(0, cy, 0),
    colliders: [
      box([0, cy, 0], [outerParams.w / 2, outerParams.h / 2, depth / 2 + 0.05]),
      box([-0.55, 0.45, 0], [0.28, 0.45, depth / 2 + 0.04]),
    ],
    update(time) {
      decor.forEach((t, i) => {
        t.position.y = cy + Math.sin(time * 2.2) * 0.04;
        t.rotation.z = Math.sin(time * 1.4) * 0.06 * (i ? -1 : 1);
      });
    },
  };
}

/* ───────────────────────── cloud: a thought cloud with trailing puffs ───────────────────────── */
const CLOUD_CIRCLES = [
  [-1.05, -0.16, 0.47],
  [-0.56, 0.22, 0.6],
  [0.1, 0.42, 0.68],
  [0.74, 0.17, 0.58],
  [1.13, -0.18, 0.44],
  [0.58, -0.38, 0.46],
  [-0.05, -0.44, 0.5],
  [-0.62, -0.4, 0.44],
];

/** Outline of a union of circles, sampled radially from the middle. */
function cloudOutline(shrink, samples = 200) {
  const pts = [];
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let best = 0;
    for (const [cx, cy, r] of CLOUD_CIRCLES) {
      const rr = r - shrink;
      const b = dx * cx + dy * cy;
      const disc = b * b - (cx * cx + cy * cy) + rr * rr;
      if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc));
    }
    pts.push(new THREE.Vector2(dx * best, dy * best));
  }
  return pts;
}

function cloud({ material }) {
  const group = new THREE.Group();
  const floaty = new THREE.Group();
  const cy = 1.78;
  floaty.position.y = cy;
  group.add(floaty);

  const outer = new THREE.Shape(cloudOutline(0));
  const innerPts = cloudOutline(0.17);
  outer.holes.push(new THREE.Path(innerPts));
  const depth = 0.3;
  const shellGeo = new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.06,
    bevelSegments: 4,
    curveSegments: 4,
  });
  shellGeo.translate(0, 0, -depth / 2);
  floaty.add(mesh(shellGeo, materials.cloud));

  const surface = surfaceFrom(new THREE.ShapeGeometry(new THREE.Shape(innerPts)), material);
  floaty.add(surface);

  // thought-bubble trail
  const puffs = [
    [-1.42, -0.98, 0.2, 0.22],
    [-1.72, -1.36, 0.14, 0.3],
    [-1.9, -1.64, 0.09, 0.36],
  ];
  const puffMeshes = puffs.map(([x, y, r, z]) => {
    const p = mesh(new THREE.IcosahedronGeometry(r, 2), materials.cloud);
    p.position.set(x, y, z);
    floaty.add(p);
    return p;
  });

  return {
    group,
    surface,
    focus: new THREE.Vector3(0, cy, 0),
    colliders: [box([0, cy, 0], [1.62, 0.92, 0.26])],
    update(time) {
      floaty.position.y = cy + Math.sin(time * 1.1) * 0.07;
      floaty.rotation.z = Math.sin(time * 0.7) * 0.025;
      puffMeshes.forEach((p, i) => {
        p.position.y = puffs[i][1] + Math.sin(time * 1.6 + i * 1.2) * 0.04;
      });
    },
  };
}

/* ───────────────────────── egg: a painted easter egg resting in a ring of puffs ───────────────────────── */
const TAU = Math.PI * 2;
/** A repeatable "random" number in 0-1 for any input. */
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** Egg outline from its bottom (y = 0) to its tip (y = height): widest a little below the middle. */
function eggOutline(height, radius, steps = 40) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI;
    points.push(new THREE.Vector2(radius * Math.sin(t) * (1 + 0.16 * Math.cos(t)), (height / 2) * (1 - Math.cos(t))));
  }
  return points;
}

const eggPaintGlsl = /* glsl */ `
  varying vec3 vEgg;
  uniform float uTime;
  uniform float uActive;
  uniform float uIntensity;
  uniform float uEggHeight;
  uniform vec3 uPaintBand;
  uniform vec3 uPaintWave;
  uniform vec3 uPaintDots;
  uniform vec3 uPaintTop;
  uniform float uPaintGlow;
  uniform float uShellGlow;
  uniform float uRim;

  // 1 inside a band of half-width w around d = 0, with soft edges
  float eggBand(float d, float w) {
    return 1.0 - smoothstep(w - 0.012, w + 0.012, abs(d));
  }

  // a row of n round dots around the egg at height y0; also says which dot this is
  float eggDots(float angle, float r, float y, float y0, float n, float size, out float index) {
    float k = angle * n / 6.2831853;
    index = floor(k + 0.5);
    float across = (k - index) * 6.2831853 / n * r; // distance around the egg to the nearest dot
    return 1.0 - smoothstep(size * 0.7, size, length(vec2(across, y - y0)));
  }
`;

/**
 * The egg's paint is drawn by the shader (no textures): wavy ribbons, a wide band with dots,
 * and a ring of small dots near the tip. It glows, catches a glint now and then, and shares
 * the portal's time / brightness / "card open" values, so it brightens like the other portals.
 */
function eggMaterial(look, portal, height) {
  const material = new THREE.MeshStandardMaterial({ color: look.shell, roughness: look.roughness ?? 0.4 });
  const [band, wave, dots, top] = look.paint.map((c) => new THREE.Color(c));
  const uniforms = {
    uTime: portal.uniforms.uTime,
    uActive: portal.uniforms.uActive,
    uIntensity: portal.uniforms.uIntensity,
    uEggHeight: { value: height },
    uPaintBand: { value: band },
    uPaintWave: { value: wave },
    uPaintDots: { value: dots },
    uPaintTop: { value: top },
    uPaintGlow: { value: look.paintGlow },
    uShellGlow: { value: look.shellGlow },
    uRim: { value: look.rim ?? 0 },
  };
  material.userData.uniforms = uniforms; // (handy for trying values live in the console)
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEgg;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEgg = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${eggPaintGlsl}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float eggH = vEgg.y / uEggHeight; // 0 at the bottom, 1 at the tip
        // (atan(0, 0) is undefined, and a NaN here would be smeared across the screen by the bloom)
        float eggAngle = abs(vEgg.x) + abs(vEgg.z) < 1e-6 ? 0.0 : atan(vEgg.z, vEgg.x);
        float eggR = length(vEgg.xz);
        float dotIndex;
        float topIndex;
        float wavesLow = eggBand(eggH - (0.25 + 0.035 * sin(eggAngle * 6.0)), 0.032);
        float wavesHigh = eggBand(eggH - (0.71 - 0.03 * sin(eggAngle * 6.0)), 0.028);
        float eggStripe = eggBand(eggH - 0.485, 0.075);
        float bandDots = eggDots(eggAngle, eggR, vEgg.y, 0.485 * uEggHeight, 8.0, 0.045 * uEggHeight, dotIndex) * eggStripe;
        float topDots = eggDots(eggAngle, eggR, vEgg.y, 0.86 * uEggHeight, 5.0, 0.032 * uEggHeight, topIndex);
        vec3 eggColor = diffuseColor.rgb;
        eggColor = mix(eggColor, uPaintWave, wavesLow);
        eggColor = mix(eggColor, uPaintBand, eggStripe);
        eggColor = mix(eggColor, uPaintDots, bandDots);
        eggColor = mix(eggColor, uPaintWave, wavesHigh);
        eggColor = mix(eggColor, uPaintTop, topDots);
        float eggPainted = max(max(wavesLow, wavesHigh), max(eggStripe, topDots));
        diffuseColor.rgb = eggColor;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float twinkle = 0.5 + 0.5 * sin(uTime * 2.4 + dotIndex * 2.1);
        float eggGlow = mix(uShellGlow, uPaintGlow, eggPainted) * (1.0 + bandDots * twinkle * 0.8);
        // a soft glint that sweeps up the egg every few seconds
        float glintAt = (eggH - (fract(uTime * 0.21) * 1.5 - 0.25)) / 0.07;
        float glint = exp(-glintAt * glintAt);
        // (clamped: pow() of a negative number is NaN)
        float eggRim = pow(clamp(1.0 - abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.5);
        vec3 eggRimColor = mix(uPaintWave, uPaintBand, eggH);
        totalEmissiveRadiance += (eggColor * eggGlow + vec3(0.6) * glint * (0.25 + uShellGlow) + eggRimColor * eggRim * uRim)
          * uIntensity * (1.0 + uActive * 1.1);`,
      );
  };
  material.customProgramCacheKey = () => 'playhub-easter-egg';
  return material;
}

function egg({ material: portal }) {
  const look = theme.portals.egg;
  const group = new THREE.Group();
  const H = 0.95;
  const R = 0.35;

  // rocks on its round bottom every few seconds (pivoting there), slowly turning all the while
  const wobble = new THREE.Group();
  const spin = new THREE.Group();
  group.add(wobble);
  wobble.add(spin);
  const shell = mesh(new THREE.LatheGeometry(eggOutline(H, R), 48), eggMaterial(look, portal, H));
  shell.name = 'portal-surface';
  spin.add(shell);

  // a ring of soft puffs to rest in (the bush materials: glowing puffs, or grass on the island)
  const puffGeo = new THREE.IcosahedronGeometry(1, 2);
  const nestMaterials = [materials.lightBushes, materials.darkBushes];
  for (let i = 0; i < 10; i++) {
    const size = 0.075 + 0.03 * hash(i + 0.5);
    const a = (i / 10) * TAU + (hash(i * 2.3) - 0.5) * 0.35;
    const reach = R * 0.94 + (hash(i * 5.1) - 0.5) * 0.04;
    const puff = mesh(puffGeo, nestMaterials[i % 2]);
    puff.scale.setScalar(size);
    puff.position.set(Math.cos(a) * reach, size * 0.55, Math.sin(a) * reach);
    group.add(puff);
  }

  // little sparkles that drift up off it and fade, only on its open side (+Z), away from any wall behind
  const sparkleColor = new THREE.Color(look.sparkle).multiplyScalar(look.sparkleGlow);
  const sparkleMaterial = new THREE.MeshBasicMaterial({ color: sparkleColor.clone() });
  const sparkleGeo = new THREE.SphereGeometry(0.026, 10, 8);
  const sparkles = Array.from({ length: 5 }, () => {
    const s = new THREE.Mesh(sparkleGeo, sparkleMaterial);
    group.add(s);
    return s;
  });

  return {
    group,
    surface: shell,
    focus: new THREE.Vector3(0, H / 2, 0),
    // its light shines from inside, so the sand and any wall around it glow (a small egg sits close
    // to the ground, so it needs much less light than the big portals)
    lightAt: new THREE.Vector3(0, H / 2, 0),
    lightScale: look.light,
    colliders: [{ kind: 'cylinder', center: new THREE.Vector3(0, H / 2, 0), halfHeight: H / 2, radius: R }],
    update(time) {
      spin.rotation.y = time * 0.35;
      const period = 4.6;
      const round = Math.floor(time / period);
      const t = time - round * period;
      const tilt = 0.11 * Math.exp(-t * 2.6) * Math.sin(t * TAU * 2.1);
      const towards = hash(round) * TAU; // a different way each time
      wobble.rotation.set(Math.cos(towards) * tilt, 0, Math.sin(towards) * tilt);

      const glow = portal.uniforms.uIntensity.value * (1 + portal.uniforms.uActive.value);
      sparkleMaterial.color.copy(sparkleColor).multiplyScalar(glow);
      sparkles.forEach((s, i) => {
        const life = time / (2.8 + i * 0.37) + i * 0.31;
        const n = Math.floor(life);
        const u = life - n;
        const a = (hash(n * 7.13 + i * 3.7) - 0.5) * 2.6; // within about 75° of straight ahead
        const reach = 0.42 + 0.22 * u;
        s.position.set(Math.sin(a) * reach, 0.3 + hash(n + i * 11.1) * 0.35 + 0.6 * u, Math.cos(a) * reach);
        const size = Math.sin(Math.PI * u) * (0.8 + 0.4 * hash(n * 3.3 + i));
        s.scale.setScalar(Math.max(size, 0.001));
        s.visible = size > 0.02;
      });
    },
  };
}

/* ───────────────────────── padlock: floats in front of a locked portal ───────────────────────── */
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * A soft little padlock (rounded, like the one on the locked card). `update(time)` keeps it
 * gently bobbing; `open(t)` plays it unlocking (t = seconds since): the shackle pops up and
 * swings open, it flashes, then shrinks away. `reset()` locks it again.
 */
export function padlock() {
  const look = theme.portals.padlock;
  const group = new THREE.Group();
  const lock = new THREE.Group(); // (bobs and scales; `group` stays where it's placed)
  group.add(lock);
  const glow = (c, k) => ({ color: c, emissive: new THREE.Color(c), emissiveIntensity: k });
  const bodyMat = new THREE.MeshStandardMaterial({ ...glow(look.body, look.glow), roughness: 0.55 });
  const shackleMat = new THREE.MeshStandardMaterial({ ...glow(look.shackle, look.glow * 0.6), roughness: 0.3, metalness: 0.45 });
  const holeMat = new THREE.MeshBasicMaterial({ color: look.keyhole });

  const body = mesh(new RoundedBoxGeometry(0.46, 0.38, 0.16, 4, 0.07), bodyMat);
  lock.add(body);

  // the keyhole on its front: a round top and a flared slot
  const hole = new THREE.Shape();
  hole.absarc(0, 0.035, 0.045, -Math.PI * 0.3, Math.PI * 1.3, false);
  hole.lineTo(-0.035, -0.085);
  hole.quadraticCurveTo(0, -0.095, 0.035, -0.085);
  hole.closePath();
  const keyhole = new THREE.Mesh(new THREE.ShapeGeometry(hole, 16), holeMat);
  keyhole.position.set(0, -0.005, 0.0805);
  lock.add(keyhole);

  // the shackle: a soft U that pivots on its left leg, so it can swing open
  const R = 0.125;
  const tube = 0.038;
  const leg = 0.1;
  const pivot = new THREE.Group();
  const pivotY = 0.19;
  pivot.position.set(-R, pivotY, 0);
  const arc = mesh(new THREE.TorusGeometry(R, tube, 12, 28, Math.PI), shackleMat);
  arc.position.set(R, leg, 0);
  const legGeo = new THREE.CylinderGeometry(tube, tube, leg + 0.05, 12);
  for (const x of [0, R * 2]) {
    const l = mesh(legGeo, shackleMat);
    l.position.set(x, (leg - 0.05) / 2, 0);
    pivot.add(l);
  }
  pivot.add(arc);
  lock.add(pivot);

  const reset = () => {
    group.visible = true;
    lock.scale.setScalar(1);
    pivot.position.y = pivotY;
    pivot.rotation.y = 0;
    bodyMat.emissiveIntensity = look.glow;
    shackleMat.emissiveIntensity = look.glow * 0.6;
  };

  return {
    group,
    reset,
    update(time) {
      lock.position.y = Math.sin(time * 1.3) * 0.025;
      lock.rotation.z = Math.sin(time * 0.8) * 0.045;
    },
    open(t) {
      pivot.position.y = pivotY + 0.08 * smooth(0, 0.2, t);
      pivot.rotation.y = -1.35 * smooth(0.12, 0.42, t);
      const flash = smooth(0.15, 0.3, t) * (1 - smooth(0.3, 0.7, t));
      bodyMat.emissiveIntensity = look.glow + flash * 2.2;
      shackleMat.emissiveIntensity = look.glow * 0.6 + flash * 2.2;
      lock.scale.setScalar((1 + 0.14 * smooth(0.15, 0.32, t)) * (1 - smooth(0.36, 0.72, t)) + 0.001);
      lock.position.y += 0.1 * smooth(0.3, 0.72, t);
      group.visible = t < 0.72;
    },
  };
}

export const SHAPES = { gate, ring, frame, bubble, cloud, egg };
export { DEG };
