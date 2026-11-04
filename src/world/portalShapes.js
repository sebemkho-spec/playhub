import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { materials } from './materials.js';

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
  const rimMaterial = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.2) });
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
  const noteMaterial = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.8) });
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

  const horiz = new THREE.BoxGeometry(W + bar * 2, bar, depth);
  const vert = new THREE.BoxGeometry(bar, H, depth);
  const bottom = mesh(horiz, materials.gold);
  bottom.position.set(0, y0 + bar / 2, 0);
  const top = mesh(horiz, materials.gold);
  top.position.set(0, y0 + bar * 1.5 + H, 0);
  const left = mesh(vert, materials.gold);
  left.position.set(-(W / 2 + bar / 2), cy, 0);
  const right = mesh(vert, materials.gold);
  right.position.set(W / 2 + bar / 2, cy, 0);
  group.add(bottom, top, left, right);

  // inner lip
  const lipMat = materials.gold.clone();
  lipMat.color.multiplyScalar(0.72);
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
      const k = mesh(knob, materials.gold);
      k.position.set(x, y, z);
      group.add(k);
    }
  }
  const crest = mesh(new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), materials.gold);
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
    const textMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fffaf0').multiplyScalar(1.6) });
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

export const SHAPES = { gate, ring, frame, bubble, cloud };
export { DEG };
