import * as THREE from 'three';
import { SWITCHES } from './layout.js';
import { groundHeight } from './island.js';
import { materials } from './materials.js';
import { ICON_PATHS } from '../ui/icons.js';
import { theme } from './theme.js';

const P = theme.props;

/**
 * The two switches lying on the sand: a ball rolls to one side of a pill-shaped
 * track. Click (or tap) either one to flip it. They mirror the corner buttons.
 */

function stadium(halfLength, radius) {
  const s = new THREE.Shape();
  s.absarc(halfLength - radius, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  s.absarc(-halfLength + radius, 0, radius, Math.PI / 2, (Math.PI * 3) / 2, false);
  return s;
}

/** Pearly matcap for the ball, drawn instead of loaded. */
function createMatcap() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const base = ctx.createRadialGradient(size * 0.42, size * 0.36, size * 0.05, size * 0.5, size * 0.5, size * 0.52);
  const [c0, c1, c2, c3] = P.switchBall;
  base.addColorStop(0, c0);
  base.addColorStop(0.45, c1);
  base.addColorStop(0.8, c2);
  base.addColorStop(1, c3);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const shine = ctx.createRadialGradient(size * 0.36, size * 0.3, 0, size * 0.36, size * 0.3, size * 0.16);
  shine.addColorStop(0, 'rgba(255,255,255,0.95)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** White line icon on a transparent canvas, from a 24×24 SVG path. */
export function iconTexture(paths) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = P.switchIcon;
  ctx.lineWidth = 1.9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of paths) ctx.stroke(new Path2D(d));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function buildSwitches(islandRoot) {
  const matcap = createMatcap();
  const caseShape = stadium(2.05, 1.0);
  caseShape.holes.push(new THREE.Path(stadium(1.62, 0.6).getPoints(24)));
  const caseGeo = new THREE.ExtrudeGeometry(caseShape, {
    depth: 0.3,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.07,
    bevelSegments: 3,
    curveSegments: 24,
  });
  caseGeo.rotateX(-Math.PI / 2);
  const floorGeo = new THREE.ShapeGeometry(stadium(1.66, 0.64), 24);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({ color: P.switchTrack, roughness: 0.9 });
  const ballGeo = new THREE.SphereGeometry(0.5, 32, 24);
  const iconGeo = new THREE.PlaneGeometry(1.9, 1.9);
  iconGeo.rotateX(-Math.PI / 2);
  const hitGeo = new THREE.BoxGeometry(4.6, 1.4, 2.4);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  const textures = {
    theme: { on: iconTexture(ICON_PATHS.sun), off: iconTexture(ICON_PATHS.moon) },
    sound: { on: iconTexture(ICON_PATHS.soundOn), off: iconTexture(ICON_PATHS.soundOff) },
  };

  const switches = {};
  const colliders = [];
  const hitTargets = [];

  for (const kind of ['theme', 'sound']) {
    const spec = SWITCHES[kind];
    const group = new THREE.Group();
    group.name = `switch-${kind}`;
    const y = groundHeight(spec.x, spec.z);
    group.position.set(spec.x, y, spec.z);
    group.userData.baseY = y;
    group.rotation.y = (SWITCHES.rot * Math.PI) / 180;
    group.scale.setScalar(SWITCHES.scale);

    const shell = new THREE.Mesh(caseGeo, materials.marble);
    shell.castShadow = true;
    shell.receiveShadow = true;
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = 0.03;
    floor.receiveShadow = true;
    const ball = new THREE.Mesh(ballGeo, new THREE.MeshMatcapMaterial({ matcap }));
    ball.position.set(1, 0.5, 0);
    ball.castShadow = true;
    const iconMat = new THREE.MeshBasicMaterial({ map: textures[kind].on, transparent: true, opacity: P.switchIconOpacity, depthWrite: false });
    const icon = new THREE.Mesh(iconGeo, iconMat);
    icon.position.set(-3.45, 0.04, 0);
    const lamp = new THREE.PointLight(P.switchLamp, 0, 0, 2);
    lamp.position.set(0, 1.4, 0.4);
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.y = 0.55;
    hit.userData.switchKind = kind;
    hitTargets.push(hit);

    group.add(shell, floor, ball, icon, lamp, hit);
    islandRoot.add(group);

    // solid case so you can't walk through it
    const s = SWITCHES.scale;
    colliders.push({
      kind: 'box',
      group: 'props',
      center: new THREE.Vector3(spec.x, y + 0.35 * s, spec.z),
      half: new THREE.Vector3(2.12 * s, 0.42 * s, 1.07 * s),
      yaw: group.rotation.y,
    });

    switches[kind] = { group, ball, icon, iconMat, lamp, on: true, x: 1, v: 0, pop: 1 };
  }

  return {
    group: Object.values(switches).map((s) => s.group),
    colliders,
    hitTargets,

    set(kind, on, instant = false) {
      const s = switches[kind];
      if (!s) return;
      if (s.on !== on) s.pop = 0.55;
      s.on = on;
      s.iconMat.map = on ? textures[kind].on : textures[kind].off;
      if (instant) {
        s.x = on ? 1 : -1;
        s.v = 0;
      }
    },

    /** mood = the current day/night blend from themeMix.js */
    update(dt, mood) {
      for (const s of Object.values(switches)) {
        // springy roll toward the active side
        const target = s.on ? 1 : -1;
        const step = Math.min(dt, 1 / 30);
        s.v += (-(s.x - target) * 140 - s.v * 11) * step;
        s.x += s.v * step;
        s.ball.position.x = s.x;
        s.ball.rotation.z = -s.x / 0.5;
        s.pop += (1 - s.pop) * (1 - Math.exp(-dt * 12));
        s.icon.scale.setScalar(s.pop);
        s.lamp.intensity = mood.switchLamps;
      }
    },
  };
}
