import * as THREE from 'three';

/** Collision groups (bit flags). Walls only stop the player; the camera only bumps into terrain. */
export const GROUP = {
  TERRAIN: 0x0001,
  PROPS: 0x0002,
  WALLS: 0x0004,
  PLAYER: 0x0008,
  CAMERA: 0x0010,
};

/** Rapier packs "what I am" and "what I hit" into one 32-bit number. */
export const interactionGroups = (membership, filter) => ((membership & 0xffff) << 16) | (filter & 0xffff);

const COLLIDER_GROUPS = {
  terrain: interactionGroups(GROUP.TERRAIN, GROUP.PLAYER | GROUP.CAMERA | GROUP.PROPS),
  props: interactionGroups(GROUP.PROPS, GROUP.PLAYER | GROUP.TERRAIN),
  walls: interactionGroups(GROUP.WALLS, GROUP.PLAYER),
};

export class Physics {
  /**
   * Rapier ships as WebAssembly (inlined in the -compat package, ~4 MB), so it's
   * loaded as its own chunk while the loading screen is up, then initialised.
   */
  static async create() {
    const { default: RAPIER } = await import('@dimforge/rapier3d-compat');
    await RAPIER.init();
    return new Physics(RAPIER);
  }

  constructor(RAPIER) {
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.fixedBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.debugLines = null;
  }

  /**
   * Add a static collider. All values are in world space.
   * spec: { kind: 'box' | 'ball' | 'cylinder' | 'hull', group: 'terrain' | 'props' | 'walls', ... }
   */
  addStatic(spec) {
    const { RAPIER } = this;
    let desc;
    switch (spec.kind) {
      case 'box':
        desc = RAPIER.ColliderDesc.cuboid(spec.half.x, spec.half.y, spec.half.z);
        break;
      case 'ball':
        desc = RAPIER.ColliderDesc.ball(spec.radius);
        break;
      case 'cylinder':
        desc = RAPIER.ColliderDesc.cylinder(spec.halfHeight, spec.radius);
        break;
      case 'hull':
        desc = RAPIER.ColliderDesc.convexHull(spec.points);
        break;
      default:
        throw new Error(`Unknown collider kind "${spec.kind}"`);
    }
    if (!desc) return null;
    if (spec.center) desc.setTranslation(spec.center.x, spec.center.y, spec.center.z);
    if (spec.quaternion) {
      const q = spec.quaternion;
      desc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }
    desc.setCollisionGroups(COLLIDER_GROUPS[spec.group ?? 'props']);
    desc.setFriction(0.2);
    this.queriesStale = true;
    return this.world.createCollider(desc, this.fixedBody);
  }

  step(dt) {
    this.world.timestep = THREE.MathUtils.clamp(dt, 1 / 240, 1 / 30);
    this.world.step();
    this.queriesStale = false;
  }

  /**
   * Height of the highest solid thing (ground or props, not the invisible walls) at world (x, z),
   * or null over open sea. Only reads the world: nothing moves.
   */
  surfaceHeight(x, z, fromY = 40) {
    // Rapier only indexes new colliders when the world steps, so step once if some were just added.
    if (this.queriesStale) {
      this.world.step();
      this.queriesStale = false;
    }
    const ray = new this.RAPIER.Ray({ x, y: fromY, z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, fromY + 20, true, undefined, interactionGroups(GROUP.PLAYER, GROUP.TERRAIN | GROUP.PROPS));
    return hit ? fromY - hit.timeOfImpact : null;
  }

  /** Distance along a ray until it hits terrain (used to keep the camera out of the cliffs). */
  castTerrainRay(origin, direction, maxDistance) {
    const ray = new this.RAPIER.Ray(origin, direction);
    const hit = this.world.castRay(ray, maxDistance, true, undefined, interactionGroups(GROUP.CAMERA, GROUP.TERRAIN));
    return hit ? hit.timeOfImpact : null;
  }

  /** Wireframe of every collider. Toggle with the ` key or ?debug in the URL. */
  setDebug(scene, enabled) {
    if (enabled && !this.debugLines) {
      const geometry = new THREE.BufferGeometry();
      const material = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, opacity: 0.85 });
      this.debugLines = new THREE.LineSegments(geometry, material);
      this.debugLines.renderOrder = 999;
      this.debugLines.frustumCulled = false;
      scene.add(this.debugLines);
    } else if (!enabled && this.debugLines) {
      scene.remove(this.debugLines);
      this.debugLines.geometry.dispose();
      this.debugLines.material.dispose();
      this.debugLines = null;
    }
  }

  updateDebug() {
    if (!this.debugLines) return;
    const { vertices, colors } = this.world.debugRender();
    const geometry = this.debugLines.geometry;
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  }
}
