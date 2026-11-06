import * as THREE from 'three';
import { WATER_LEVEL } from './environment.js';

const DEG = Math.PI / 180;
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Third-person camera that orbits the character.
 *   orbit  → left-drag / two-finger drag
 *   pan    → right-drag (eases back to the character once you walk)
 *   zoom   → scroll / pinch
 * Tilt is clamped so the camera never drops below the island.
 */
export class CameraRig {
  constructor(camera, config, physics) {
    this.camera = camera;
    this.cfg = config;
    this.physics = physics;

    this.yaw = this.yawGoal = config.yaw * DEG;
    this.polar = this.polarGoal = config.polar * DEG;
    this.distance = this.distanceGoal = config.distance;
    this.minPolar = config.minPolar * DEG;
    this.maxPolar = config.maxPolar * DEG;

    this.target = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.pan = new THREE.Vector3();
    this.panGoal = new THREE.Vector3();
    this.safeDistance = this.distance;
    this.lift = 0;
    this.intro = null;

    this._dir = new THREE.Vector3();
    this._origin = { x: 0, y: 0, z: 0 };
    this._rayDir = { x: 0, y: 0, z: 0 };
  }

  /** Jump straight to a spot (no smoothing). */
  snap(position) {
    this.focus.copy(position);
    this.target.copy(position).add(new THREE.Vector3(0, this.cfg.lookHeight, 0));
  }

  /**
   * Opening shot: frame more of the island (pulled back, panned toward its middle).
   * As soon as the character starts walking it eases into the normal follow view,
   * unless the visitor has zoomed in the meantime.
   */
  setOpeningShot({ pan, distance }) {
    this.pan.copy(pan);
    this.panGoal.copy(pan);
    this.distanceGoal = distance;
    this.opening = true;
  }

  /** Swoop in from far away when the experience starts. */
  playIntro({ distance, polar, yaw = this.yawGoal, duration = 2.6 }) {
    this.intro = {
      t: 0,
      duration,
      from: { distance, polar: polar * DEG, yaw },
      to: { distance: this.distanceGoal, polar: this.polarGoal, yaw: this.yawGoal },
    };
    this.distance = distance;
    this.polar = polar * DEG;
    this.yaw = yaw;
  }

  orbit(dx, dy, viewportHeight) {
    if (this.intro) return;
    const k = ((Math.PI * 2) / viewportHeight) * 0.55;
    this.yawGoal -= dx * k;
    this.polarGoal = THREE.MathUtils.clamp(this.polarGoal - dy * k, this.minPolar, this.maxPolar);
  }

  panBy(dx, dy, viewportHeight) {
    if (this.intro) return;
    const worldPerPixel = (2 * this.distance * Math.tan((this.camera.fov * DEG) / 2)) / viewportHeight;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.panGoal.addScaledVector(right, -dx * worldPerPixel).addScaledVector(forward, dy * worldPerPixel * 1.4);
    if (this.panGoal.length() > this.cfg.maxPan) this.panGoal.setLength(this.cfg.maxPan);
  }

  zoom(factor) {
    if (this.intro) return;
    this.opening = false; // the visitor chose a zoom; keep it
    this.distanceGoal = THREE.MathUtils.clamp(this.distanceGoal * factor, this.cfg.minDistance, this.cfg.maxDistance);
  }

  /** Camera-relative directions for movement input. */
  get forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  get right() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  update(dt, playerPosition, playerMoving) {
    if (this.intro) {
      const it = this.intro;
      it.t += dt;
      const k = easeInOut(Math.min(1, it.t / it.duration));
      this.distance = THREE.MathUtils.lerp(it.from.distance, it.to.distance, k);
      this.polar = THREE.MathUtils.lerp(it.from.polar, it.to.polar, k);
      this.yaw = THREE.MathUtils.lerp(it.from.yaw, it.to.yaw, k);
      if (it.t >= it.duration) this.intro = null;
    } else {
      this.yaw += (this.yawGoal - this.yaw) * damp(12, dt);
      this.polar += (this.polarGoal - this.polar) * damp(12, dt);
      this.distance += (this.distanceGoal - this.distance) * damp(9, dt);
    }

    // panning drifts back to the character once you start walking
    if (playerMoving) {
      this.panGoal.multiplyScalar(Math.exp(-2.2 * dt));
      if (this.opening && !this.intro) {
        this.opening = false;
        this.distanceGoal = this.cfg.distance;
      }
    }
    // never let the view drift further from the character than the pan limit
    if (this.panGoal.length() > this.cfg.maxPan) this.panGoal.setLength(this.cfg.maxPan);
    this.pan.lerp(this.panGoal, damp(10, dt));

    // smooth follow
    this.focus.lerp(playerPosition, damp(this.cfg.followSharpness, dt));
    this.target.copy(this.focus).add(this.pan);
    this.target.y += this.cfg.lookHeight;

    // when panned, keep the look-at point above whatever terrain is under it
    let lift = 0;
    if (this.physics && this.pan.lengthSq() > 0.01) {
      this._origin.x = this.target.x;
      this._origin.y = this.target.y + 30;
      this._origin.z = this.target.z;
      this._rayDir.x = 0;
      this._rayDir.y = -1;
      this._rayDir.z = 0;
      const toi = this.physics.castTerrainRay(this._origin, this._rayDir, 60);
      if (toi !== null) lift = Math.max(0, this._origin.y - toi + this.cfg.lookHeight * 0.6 - this.target.y);
    }
    // rise quickly, settle slowly
    this.lift += (lift - this.lift) * damp(lift > this.lift ? 14 : 4, dt);
    this.target.y += this.lift;

    const sinP = Math.sin(this.polar);
    this._dir.set(sinP * Math.sin(this.yaw), Math.cos(this.polar), sinP * Math.cos(this.yaw));

    // keep the camera out of terrain between it and the character
    let allowed = this.distance;
    if (this.physics) {
      this._origin.x = this.target.x;
      this._origin.y = this.target.y;
      this._origin.z = this.target.z;
      this._rayDir.x = this._dir.x;
      this._rayDir.y = this._dir.y;
      this._rayDir.z = this._dir.z;
      const hit = this.physics.castTerrainRay(this._origin, this._rayDir, this.distance);
      // (a hit at ~0 means the look-at point itself is inside terrain for a moment: ignore it)
      if (hit !== null && hit > 0.05) allowed = Math.max(2.5, hit - 0.6);
    }
    const rate = allowed < this.safeDistance ? 18 : 3;
    this.safeDistance += (allowed - this.safeDistance) * damp(rate, dt);
    this.safeDistance = Math.min(this.safeDistance, this.distance);

    this.camera.position.copy(this.target).addScaledVector(this._dir, this.safeDistance);
    this.camera.position.y = Math.max(this.camera.position.y, WATER_LEVEL + 1.2);
    this.camera.lookAt(this.target);
  }
}
