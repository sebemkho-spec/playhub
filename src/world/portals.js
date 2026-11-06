import * as THREE from 'three';
import { PORTALS } from '../data/portals.js';
import { CONFIG } from '../config.js';
import { SHAPES, createPortalMaterial, DEG, padlock } from './portalShapes.js';
import { createUnlockBurst } from './unlockBurst.js';
import { groundHeight, islandMatrix } from './island.js';
import { theme } from './theme.js';

/** Glow colour for a portal: theme.js → portals.colors, else the theme's default. */
const portalColor = (data) => theme.portals.colors[data.id] ?? data.color ?? theme.portals.defaultColor;

const LOCKED = theme.portals.locked;
/** The dull, almost colourless version of a colour, for a locked portal. */
function dulled(color) {
  const hsl = {};
  color.getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s * LOCKED.saturation, hsl.l * LOCKED.lightness);
}
const smooth = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** How a locked portal looks right now: grey by `lock.k`, plus the flash when it opens. */
function tint(p) {
  const L = p.lock;
  for (const t of L.tints) {
    t.m.color.copy(t.color).lerp(t.dull, L.k);
    t.m.metalness = THREE.MathUtils.lerp(t.metalness, 0.05, L.k);
    t.m.roughness = THREE.MathUtils.lerp(t.roughness, 0.85, L.k);
    t.m.emissive.copy(t.color).multiplyScalar(L.flash * 0.9).add(t.emissive);
  }
  p.material.uniforms.uColor.value.copy(L.surface.color).lerp(L.surface.dull, L.k);
  p.light.color.copy(L.surface.color).lerp(L.surface.dull, L.k);
}

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
    const color = new THREE.Color(portalColor(data));
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

    const light = new THREE.PointLight(color, theme.day.portalLight, 0, 2);
    // just in front of the portal, unless the shape says where (and how strongly) it shines
    light.position.copy(built.lightAt ?? built.focus.clone().add(new THREE.Vector3(0, 0, 0.35)));
    holder.add(light);
    islandRoot.add(holder);

    // a portal that can be locked (`locked` in src/data/portals.js) gets a padlock, and remembers
    // its own colours so it can fade to grey and back
    let lock = null;
    if (data.locked) {
      const pad = padlock();
      pad.group.position.copy(built.lockAt ?? built.focus.clone().add(new THREE.Vector3(0, 0, 0.35)));
      pad.group.visible = false;
      holder.add(pad.group);
      lock = {
        k: 0, // 0 = open (its usual colours) … 1 = locked (dull)
        flash: 0, // the burst of brightness as it opens
        t: -1, // seconds into unlocking, or -1
        pad,
        burst: null,
        tints: (built.tint ?? []).map((m) => ({
          m,
          color: m.color.clone(),
          dull: dulled(m.color),
          emissive: m.emissive.clone(),
          metalness: m.metalness,
          roughness: m.roughness,
        })),
        surface: { color: color.clone(), dull: dulled(color) },
      };
    }

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
      lock,
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

    /** Lock or unlock a portal straight away, without any fanfare (when a visit starts, or after a reset). */
    setLocked(p, locked) {
      const L = p.lock;
      if (!L) return;
      L.burst?.dispose();
      L.burst = null;
      L.t = -1;
      L.flash = 0;
      L.k = locked ? 1 : 0;
      L.pad.reset();
      L.pad.group.visible = locked;
      tint(p);
    },

    /** Unlock with a show: the padlock springs open, light bursts out and the colour floods back. */
    unlock(p) {
      const L = p.lock;
      if (!L || L.k === 0 || L.t >= 0) return false;
      L.t = 0;
      const look = theme.portals.unlock;
      L.burst = createUnlockBurst({ color: look.color, glow: look.glow, sparkles: look.sparkles, beam: look.beam, focus: p.built.focus, size: p.built.burstSize });
      p.holder.add(L.burst.group);
      return true;
    },

    /** mood = the current day/night blend from themeMix.js */
    update(dt, time, mood, openId) {
      for (const p of items) {
        const target = p.data.id === openId ? 1 : 0;
        p.active += (target - p.active) * (1 - Math.exp(-dt * 6));
        let glow = 1;
        let light = 1;
        let flash = 0;
        const L = p.lock;
        if (L && (L.k > 0 || L.t >= 0)) {
          if (L.t >= 0) {
            // unlocking: the padlock pops first, the burst follows, then the colour comes back
            L.t += dt;
            L.pad.open(L.t);
            if (L.burst && !L.burst.update(L.t - 0.35)) {
              L.burst.dispose();
              L.burst = null;
            }
            L.k = 1 - smooth(0.4, 1.7, L.t);
            L.flash = L.t < 0.35 ? 0 : L.t < 0.5 ? (L.t - 0.35) / 0.15 : Math.exp(-(L.t - 0.5) / 0.7);
            if (!L.burst && L.t > 2) {
              L.t = -1;
              L.k = 0;
              L.flash = 0;
            }
          } else {
            L.pad.update(time);
          }
          tint(p);
          glow = THREE.MathUtils.lerp(1, LOCKED.glow, L.k) * (1 + 2.5 * L.flash);
          light = THREE.MathUtils.lerp(1, LOCKED.light, L.k) * (1 + 8 * L.flash);
          flash = L.flash;
        }
        const u = p.material.uniforms;
        u.uTime.value = time;
        u.uActive.value = p.active + flash;
        u.uIntensity.value = theme.portals.glow * mood.portalGlow * glow;
        p.light.intensity = THREE.MathUtils.lerp(mood.portalLight, mood.portalLightActive, p.active) * (p.built.lightScale ?? 1) * light;
        p.built.update?.(time);
      }
    },
  };
}
