import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { GROUP, interactionGroups } from '../physics/physics.js';

const DEG = Math.PI / 180;
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

function lerpAngle(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/**
 * Kinematic character controller (Rapier). Climbs steps up to `stepHeight`,
 * sticks to stairs on the way down, slides along walls, and can't pass the
 * invisible shoreline walls.
 */
export class PlayerController {
  constructor(physics, spawn, spawnYaw = 0, killHeight = -6) {
    const { RAPIER, world } = physics;
    const m = CONFIG.movement;
    this.RAPIER = RAPIER;
    this.spawn = spawn.clone();
    this.spawnYaw = spawnYaw;
    this.killHeight = killHeight;

    const radius = m.capsuleRadius;
    const halfHeight = Math.max(0.05, (m.capsuleHeight - radius * 2) / 2);
    this.groups = interactionGroups(GROUP.PLAYER, GROUP.TERRAIN | GROUP.PROPS | GROUP.WALLS);

    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y, spawn.z),
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(halfHeight, radius).setTranslation(0, halfHeight + radius, 0).setCollisionGroups(this.groups),
      this.body,
    );

    const kcc = world.createCharacterController(0.03);
    kcc.setUp({ x: 0, y: 1, z: 0 });
    kcc.setSlideEnabled(true);
    kcc.setMaxSlopeClimbAngle(m.maxSlope * DEG);
    kcc.setMinSlopeSlideAngle((m.maxSlope + 5) * DEG);
    kcc.enableAutostep(m.stepHeight, 0.15, false);
    kcc.enableSnapToGround(m.snapToGround);
    kcc.setApplyImpulsesToDynamicBodies(false);
    this.kcc = kcc;

    this.position = spawn.clone();
    this.velocity = new THREE.Vector3();
    this.yaw = spawnYaw;
    this.grounded = false;
    this.speed = 0; // actual horizontal speed after collisions
    this.state = 'idle';
    this.running = false;

    this._wish = new THREE.Vector3();
    this._desired = { x: 0, y: 0, z: 0 };
  }

  teleport(position, yaw = this.yaw) {
    this.position.copy(position);
    this.body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    this.body.setNextKinematicTranslation({ x: position.x, y: position.y, z: position.z });
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
  }

  /** move: { x, y, run, magnitude } from Input; forward/right: camera-relative ground directions. */
  update(dt, move, forward, right) {
    const m = CONFIG.movement;
    const wish = this._wish.set(0, 0, 0).addScaledVector(forward, move.y).addScaledVector(right, move.x);
    const hasInput = wish.lengthSq() > 0.0025;
    if (hasInput) wish.normalize();

    // keyboard is all-or-nothing; the joystick is analogue
    const analog = THREE.MathUtils.clamp(move.magnitude, 0, 1);
    const top = move.run ? m.runSpeed : m.walkSpeed;
    const targetSpeed = hasInput ? top * (move.run ? 1 : THREE.MathUtils.lerp(0.45, 1, analog)) : 0;

    const k = damp(m.acceleration, dt);
    this.velocity.x += (wish.x * targetSpeed - this.velocity.x) * k;
    this.velocity.z += (wish.z * targetSpeed - this.velocity.z) * k;
    // Only a tiny downward push while grounded: a bigger one stops Rapier's autostep
    // from lifting a capsule onto stairs (snap-to-ground keeps us glued instead).
    this.velocity.y = this.grounded ? -0.25 : Math.max(this.velocity.y - m.gravity * dt, -m.maxFallSpeed);

    const d = this._desired;
    d.x = this.velocity.x * dt;
    d.y = this.velocity.y * dt;
    d.z = this.velocity.z * dt;
    this.kcc.computeColliderMovement(this.collider, d, this.RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, this.groups);
    const moved = this.kcc.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.kcc.computedGrounded();
    if (this.grounded && !wasGrounded) this.velocity.y = 0;

    this.position.x += moved.x;
    this.position.y += moved.y;
    this.position.z += moved.z;
    this.body.setNextKinematicTranslation({ x: this.position.x, y: this.position.y, z: this.position.z });

    const actual = dt > 0 ? Math.hypot(moved.x, moved.z) / dt : 0;
    this.speed += (actual - this.speed) * damp(14, dt);

    if (hasInput) this.yaw = lerpAngle(this.yaw, Math.atan2(wish.x, wish.z), damp(m.turnSpeed, dt));

    // pick the animation from how fast you're really going (so pushing into a wall reads as idle)
    if (this.state === 'idle' && this.speed > 0.45) this.state = 'walk';
    else if (this.state !== 'idle' && this.speed < 0.22) this.state = 'idle';
    if (this.state !== 'idle') this.state = move.run && this.speed > m.walkSpeed * 1.08 ? 'run' : 'walk';
    this.running = this.state === 'run';

    if (this.position.y < this.killHeight) this.teleport(this.spawn, this.spawnYaw);
  }
}
