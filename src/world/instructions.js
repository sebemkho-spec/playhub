import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../config.js';
import { INSTRUCTIONS } from './layout.js';
import { islandToWorld, islandYawToWorld } from './island.js';
import { WATER_LEVEL } from './environment.js';

/**
 * "WASD to Move / Scroll to Zoom / Click and Drag to Pan" as real 3D letters,
 * floating just above the water beside the island.
 */

function extrude(shape, depth) {
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.2, bevelSize: depth * 0.15, bevelSegments: 1, curveSegments: 8 });
}

function iconMeshes(kind, s, material) {
  const parts = [];
  const add = (geometry, x = 0, y = 0) => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, 0);
    m.castShadow = true;
    parts.push(m);
  };
  const depth = 0.16 * s;
  switch (kind) {
    case 'keys': {
      const cap = new RoundedBoxGeometry(0.4 * s, 0.4 * s, depth, 3, 0.07 * s);
      add(cap, 0, 0.23 * s);
      add(cap, -0.45 * s, -0.23 * s);
      add(cap, 0, -0.23 * s);
      add(cap, 0.45 * s, -0.23 * s);
      break;
    }
    case 'mouse': {
      const w = 0.27 * s;
      const h = 0.43 * s;
      const shape = new THREE.Shape();
      shape.absarc(0, h - w, w, 0, Math.PI, false);
      shape.absarc(0, -h + w, w, Math.PI, Math.PI * 2, false);
      add(extrude(shape, depth));
      const wheel = new THREE.Shape();
      wheel.absarc(0, 0.17 * s, 0.035 * s, 0, Math.PI * 2, false);
      const wheelGeo = extrude(wheel, depth * 1.6);
      add(wheelGeo, 0, 0);
      break;
    }
    case 'pointer': {
      const pts = [[0, 0.45], [0, -0.38], [0.2, -0.2], [0.34, -0.5], [0.45, -0.45], [0.31, -0.15], [0.56, -0.15]];
      const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2((x - 0.25) * s, y * s)));
      add(extrude(shape, depth));
      break;
    }
    case 'drag':
    case 'pinch':
    case 'twofinger': {
      const dots = kind === 'drag' ? [[0, 0]] : kind === 'pinch' ? [[-0.2, -0.2], [0.2, 0.2]] : [[-0.2, 0], [0.2, 0]];
      for (const [x, y] of dots) {
        const ring = new THREE.Shape();
        ring.absarc(0, 0, 0.2 * s, 0, Math.PI * 2, false);
        const hole = new THREE.Path();
        hole.absarc(0, 0, 0.13 * s, 0, Math.PI * 2, true);
        ring.holes.push(hole);
        add(extrude(ring, depth), x * s, y * s);
        const dot = new THREE.Shape();
        dot.absarc(0, 0, 0.07 * s, 0, Math.PI * 2, false);
        add(extrude(dot, depth), x * s, y * s);
      }
      break;
    }
    default:
      break;
  }
  return parts;
}

export function buildInstructions(scene, { font, isTouch }) {
  const lines = (isTouch ? CONFIG.instructions.touch : CONFIG.instructions.desktop)
    .split('/')
    .map((l) => l.trim())
    .filter(Boolean);
  const icons = isTouch ? ['drag', 'pinch', 'twofinger'] : ['keys', 'mouse', 'pointer'];

  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.5,
    metalness: 0,
    emissive: '#ffffff',
    emissiveIntensity: 0,
    transparent: true,
    opacity: 0,
  });

  const holder = new THREE.Group(); // positioned + rotated over the water
  holder.name = 'instructions';
  holder.rotation.order = 'YXZ';
  const block = new THREE.Group(); // the text, built upright in its own XY plane
  holder.add(block);
  scene.add(holder);

  let built = null;

  function build(size) {
    block.clear();
    const lineHeight = size * 1.75;
    const iconColumn = size * 1.75;
    let maxWidth = 0;
    lines.forEach((text, i) => {
      const geo = new TextGeometry(text, {
        font,
        size,
        depth: size * 0.2,
        curveSegments: 3, // plenty at this size, and keeps the triangle count low
        bevelEnabled: true,
        bevelThickness: size * 0.03,
        bevelSize: size * 0.02,
        bevelSegments: 1,
      });
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      const y = -i * lineHeight;
      const m = new THREE.Mesh(geo, material);
      m.castShadow = true;
      m.position.set(iconColumn, y - size * 0.36, 0);
      block.add(m);
      maxWidth = Math.max(maxWidth, iconColumn + bb.max.x);
      for (const part of iconMeshes(icons[i], size, material)) {
        part.position.x += iconColumn * 0.42;
        part.position.y += y;
        block.add(part);
      }
    });
    // centre the block on its holder
    const height = (lines.length - 1) * lineHeight;
    block.position.set(-maxWidth / 2, height / 2, 0);
    built = size;
  }

  let placementKey = null;
  const baseY = WATER_LEVEL + 0.6;
  const tilt = 0.28; // lean the letters up toward the camera a little

  return {
    group: holder,
    material,

    /** Pick the wide or narrow spot depending on the screen shape. */
    place(aspect) {
      const key = aspect < 0.9 ? 'narrow' : 'wide';
      if (key === placementKey) return;
      placementKey = key;
      const p = INSTRUCTIONS[key];
      if (built !== p.size) build(p.size);
      const world = islandToWorld(p.x, 0, p.z);
      holder.position.set(world.x, baseY, world.z);
      holder.rotation.set(-Math.PI / 2 + tilt, islandYawToWorld(p.rot), 0);
    },

    update(time, theme, reveal) {
      holder.position.y = baseY + Math.sin(time * 1.1) * 0.08;
      holder.rotation.z = Math.sin(time * 0.6) * 0.012;
      material.opacity = reveal;
      material.visible = reveal > 0.001;
      material.emissiveIntensity = theme.textGlow;
      holder.scale.setScalar(0.85 + 0.15 * reveal);
    },
  };
}
