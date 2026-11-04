import * as THREE from 'three';
import { PORTALS } from '../data/portals.js';
import { CONFIG } from '../config.js';
import { SHAPES, createPortalMaterial, DEG } from './portalShapes.js';
import { groundHeight, islandMatrix } from './island.js';

/**
 * Builds every portal listed in src/data/portals.js and decides when a card
 * should open (walked in) or close (walked away).
 */
export function buildPortals(islandRoot, { font }) {
  const items = [];

  PORTALS.forEach((data, index) => {
    let builder = SHAPES[data.shape];
    if (!builder) {
      console.warn(`[playhub] Portal "${data.id}" has unknown shape "${data.shape}". Using "gate". Options: ${Object.keys(SHAPES).join(', ')}`);
      builder = SHAPES.gate;
    }
    const color = new THREE.Color(data.color ?? '#3ff3ff');
    const material = createPortalMaterial(color, index * 1.37);
    const built = builder({ material, color, font });

    const [px, py, pz] = data.position.length === 3
      ? data.position
      : [data.position[0], groundHeight(data.position[0], data.position[1]), data.position[1]];

    const holder = new THREE.Group();
    holder.name = `portal-${data.id}`;
    holder.position.set(px, py, pz);
    holder.rotation.y = (data.rotation ?? 0) * DEG;
    holder.scale.setScalar(data.size ?? 1);
    holder.add(built.group);

    const light = new THREE.PointLight(color, 6, 0, 2);
    light.position.copy(built.focus).add(new THREE.Vector3(0, 0, 0.35));
    holder.add(light);
    islandRoot.add(holder);

    // Colliders: portal space → island space (the island converts them to world space later)
    holder.updateMatrix();
    const holderQuat = new THREE.Quaternion().setFromEuler(holder.rotation);
    const scale = holder.scale.x;
    const colliders = built.colliders.map((c) => {
      const out = { ...c, group: 'props' };
      out.center = c.center.clone().applyMatrix4(holder.matrix);
      out.quaternion = holderQuat.clone().multiply(c.quaternion ?? new THREE.Quaternion());
      if (c.half) out.half = c.half.clone().multiplyScalar(scale);
      if (c.radius) out.radius = c.radius * scale;
      if (c.halfHeight) out.halfHeight = c.halfHeight * scale;
      return out;
    });

    // World positions from the island's final placement (not the intro animation)
    const groundWorld = new THREE.Vector3(px, py, pz).applyMatrix4(islandMatrix);
    const focusWorld = built.focus.clone().applyMatrix4(holder.matrix).applyMatrix4(islandMatrix);

    items.push({
      data,
      holder,
      material,
      light,
      built,
      colliders,
      groundWorld,
      focusWorld,
      triggerRadius: data.triggerRadius ?? CONFIG.portals.triggerRadius,
      active: 0, // 0..1 glow boost while the card is open
      latched: false, // stays true until you walk out, so "close" doesn't instantly reopen
    });
  });

  return {
    items,
    colliders: items.flatMap((p) => p.colliders),

    /**
     * Returns { enter: item | null, leave: boolean } for this frame.
     * `openId` is the portal whose card is currently showing.
     */
    check(playerPos, openId) {
      let enter = null;
      let best = Infinity;
      let leave = false;
      for (const p of items) {
        const dx = playerPos.x - p.groundWorld.x;
        const dz = playerPos.z - p.groundWorld.z;
        const dy = playerPos.y - p.groundWorld.y;
        const d = Math.hypot(dx, dz);
        const inside = d < p.triggerRadius && dy > -1.5 && dy < 2.5;
        const outside = d > p.triggerRadius + CONFIG.portals.exitPadding || dy < -2.5 || dy > 3.5;
        if (outside) p.latched = false;
        if (inside && !p.latched && d < best) {
          enter = p;
          best = d;
        }
        if (p.data.id === openId && outside) leave = true;
      }
      return { enter, leave };
    },

    update(dt, time, theme, openId) {
      for (const p of items) {
        const target = p.data.id === openId ? 1 : 0;
        p.active += (target - p.active) * (1 - Math.exp(-dt * 6));
        const u = p.material.uniforms;
        u.uTime.value = time;
        u.uActive.value = p.active;
        u.uIntensity.value = 0.95 * theme.portalGlow;
        p.light.intensity = THREE.MathUtils.lerp(theme.portalLight, theme.portalLightActive, p.active);
        p.built.update?.(time);
      }
    },
  };
}
