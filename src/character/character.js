import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { describeRig, checkClip, renameTracks, stripRootMotion } from './animationCheck.js';

const STATES = ['idle', 'walk', 'run'];
const DEG = Math.PI / 180;
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);

const shortName = (name) => name.split('|').pop().trim().toLowerCase();
function findClip(clips, wanted) {
  const names = wanted.map((n) => n.toLowerCase());
  return clips.find((c) => names.includes(c.name.trim().toLowerCase()) || names.includes(shortName(c.name))) ?? null;
}
const quoteList = (clips) => (clips.length ? clips.map((c) => `"${c.name}"`).join(', ') : 'none');

/**
 * The player's visible body. Loads the rigged model + clips and blends between
 * idle / walk / run. Until a model file exists it shows a capsule instead.
 * Problems are collected in `report` (shown in the on-screen character check).
 */
export class Character {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'character';
    this.pivot = new THREE.Group();
    this.root.add(this.pivot);
    this.report = [];
    this.mixer = null;
    this.actions = {};
    this.speedScale = { idle: 1, walk: 1, run: 1 };
    this.state = null;
    this.placeholder = null;
    this.phase = 0;
    this.blend = { walk: 0, run: 0 };
    this.squash = 0;
    this.wasGrounded = true;
  }

  note(level, text, fix) {
    this.report.push({ level, text, fix });
    const log = level === 'error' ? console.error : level === 'warning' ? console.warn : console.info;
    log(`[playhub character] ${text}${fix ? `\n  → ${fix}` : ''}`);
  }

  async load({ gltfLoader, exists, onBytes }) {
    const cfg = CONFIG.character;
    if (!(await exists(cfg.model))) {
      this.note('info', `No character file at public${cfg.model} yet, so a capsule is standing in.`, 'Drop your rigged .glb there, or point character.model in src/config.js at it.');
      this.usePlaceholder();
      return;
    }

    let gltf;
    try {
      gltf = await gltfLoader.loadAsync(cfg.model, onBytes?.(cfg.model));
    } catch (err) {
      this.note('error', `Couldn't read ${cfg.model}: ${err.message || err}`, 'Check that it is a valid .glb/.gltf (try opening it at gltf-viewer.donmccurdy.com).');
      this.usePlaceholder();
      return;
    }

    const model = gltf.scene;
    this.prepareModel(model);
    const rig = describeRig(model);
    if (!rig.skinned || !rig.bones.length) {
      this.note('error', `${cfg.model} loaded, but it has no skeleton (${rig.skinned ? 'no bones' : 'no skinned mesh'}), so it can't be animated.`, 'Export the model with its armature/rig included (in Blender: select mesh + armature, export glTF with "Skinning" on).');
    }
    this.checkFacing(rig);

    // Collect one clip per state, from separate files or from the model file.
    const clips = {};
    for (const state of STATES) {
      const file = cfg.animationFiles?.[state];
      if (file) {
        if (!(await exists(file))) {
          this.note('error', `character.animationFiles.${state} points at public${file}, but there's no file there.`, 'Check the file name and that it sits inside public/.');
          continue;
        }
        try {
          const anim = await gltfLoader.loadAsync(file, onBytes?.(file));
          if (!anim.animations.length) {
            this.note('error', `${file} has no animations in it.`, 'Re-export it with animation enabled (Mixamo: format glTF/FBX "with skin" or "without skin").');
            continue;
          }
          let clip = findClip(anim.animations, cfg.clipNames[state]);
          if (!clip) {
            clip = anim.animations[0];
            if (anim.animations.length > 1) {
              this.note('warning', `${file} contains ${anim.animations.length} clips (${quoteList(anim.animations)}); using the first one, "${clip.name}", for ${state}.`, `Add the right name to character.clipNames.${state} to pick another.`);
            }
          }
          clips[state] = clip;
        } catch (err) {
          this.note('error', `Couldn't read ${file}: ${err.message || err}`);
        }
      } else if (gltf.animations.length) {
        const clip = findClip(gltf.animations, cfg.clipNames[state]);
        if (clip) clips[state] = clip;
      }
    }

    const missingStates = STATES.filter((s) => !clips[s]);
    if (missingStates.length) {
      const available = gltf.animations;
      this.note(
        missingStates.length === 3 ? 'error' : 'warning',
        `No ${missingStates.map((s) => `"${s}"`).join(', ')} animation found. Clips inside ${cfg.model}: ${quoteList(available)}.`,
        available.length
          ? `Set character.clipNames in src/config.js to the clip names above (e.g. clipNames.${missingStates[0]}: ['${available[0].name}']), or use character.animationFiles.`
          : 'Add the clips to the model file, or set character.animationFiles to separate animation files.',
      );
    }

    // Validate each clip against the skeleton. Only the user's explicit settings change anything.
    for (const state of Object.keys(clips)) {
      let clip = renameTracks(clips[state], cfg.trackNameReplace);
      if (cfg.removeRootMotion && state !== 'idle') clip = stripRootMotion(clip.clone());
      const result = checkClip(clip, rig, state);
      for (const issue of result.issues) this.note(issue.level, issue.text, issue.fix);
      if (result.usable) clips[state] = clip;
      else delete clips[state];
    }

    // Stated fallbacks for missing locomotion clips (always reported above, never silent).
    if (!clips.walk && clips.run) {
      clips.walk = clips.run.clone();
      this.speedScale.walk = 0.62;
      this.note('info', 'Walking uses the run clip slowed down until a walk clip is added.');
    }
    if (!clips.run && clips.walk) {
      clips.run = clips.walk.clone();
      this.speedScale.run = 1.6;
      this.note('info', 'Running uses the walk clip sped up until a run clip is added.');
    }

    this.model = model;
    this.pivot.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    for (const state of STATES) {
      if (!clips[state]) continue;
      const action = this.mixer.clipAction(clips[state]);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.enabled = true;
      action.setEffectiveWeight(0);
      this.actions[state] = action;
    }
    if (!Object.keys(this.actions).length && rig.skinned) {
      this.note('info', 'The character will stand in its rest pose until it has working animations.');
    }
    this.setState('idle', true);
  }

  prepareModel(model) {
    const cfg = CONFIG.character;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.isSkinnedMesh) o.frustumCulled = false;
      }
    });
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    if (cfg.height && size.y > 1e-6) {
      const s = cfg.height / size.y;
      model.scale.multiplyScalar(s);
      if (s > 20 || s < 0.05) {
        this.note('info', `The model was ${size.y.toFixed(2)} units tall, so it was scaled ${s > 1 ? 'up' : 'down'} ×${s.toFixed(2)} to ${cfg.height} m.`, 'That usually means it was exported in centimetres. Fine to leave, or set character.height to null to keep the original size.');
      }
      model.updateMatrixWorld(true);
      box.setFromObject(model);
    }
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
    this.pivot.rotation.y = (cfg.rotationY ?? 0) * DEG;
  }

  /**
   * Which way does the model face? Uses the feet → toes direction of the rest pose.
   * Only reports (with the exact setting to change); never turns the model by itself.
   */
  checkFacing(rig) {
    const pick = (re) => rig.bones.filter((b) => re.test(b.name));
    const feet = pick(/(left|right|_l|_r|\.l|\.r)?.*foot$/i);
    const toes = pick(/toe(base|_?end)?$/i);
    if (!feet.length || !toes.length) return;
    const model = rig.bones[0];
    let top = model;
    while (top.parent) top = top.parent;
    top.updateMatrixWorld(true); // model space (not yet turned by rotationY)
    const dir = new THREE.Vector3();
    for (const toe of toes) {
      const foot = toe.parent?.isBone ? toe.parent : feet[0];
      dir.add(toe.getWorldPosition(new THREE.Vector3()).sub(foot.getWorldPosition(new THREE.Vector3())));
    }
    dir.y = 0;
    if (dir.lengthSq() < 1e-8) return;
    const wrap = (deg) => {
      const d = ((((deg + 180) % 360) + 360) % 360) - 180;
      return d === -180 ? 180 : d;
    };
    const raw = (Math.atan2(dir.x, dir.z) * 180) / Math.PI; // 0 = faces +Z (forward)
    const facing = Math.round(wrap(raw + (CONFIG.character.rotationY ?? 0)));
    if (Math.abs(facing) > 45) {
      const fix = wrap(Math.round(wrap(-raw) / 5) * 5);
      const backwards = Math.abs(facing) > 135;
      this.note('warning', `Your character faces ${backwards ? 'backwards' : 'sideways'} in its file: its toes point ${Math.abs(facing)}° away from the way it walks, so it would ${backwards ? 'moonwalk' : 'walk sideways'}.`, `Set character.rotationY to ${fix} in src/config.js.`);
    }
  }

  usePlaceholder() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.34, 1.12, 8, 24),
      new THREE.MeshStandardMaterial({ color: '#f7f2ea', roughness: 0.5 }),
    );
    body.position.y = 0.9;
    body.castShadow = true;
    body.receiveShadow = true;
    const eyeGeo = new THREE.SphereGeometry(0.048, 16, 12);
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#1d2433', roughness: 0.25 });
    for (const x of [-0.12, 0.12]) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x, 1.42, 0.305);
      eye.scale.set(1, 1.35, 0.6);
      group.add(eye);
    }
    const blushGeo = new THREE.CircleGeometry(0.05, 16);
    const blushMat = new THREE.MeshBasicMaterial({ color: '#ffb3a7', transparent: true, opacity: 0.7 });
    for (const x of [-0.2, 0.2]) {
      const blush = new THREE.Mesh(blushGeo, blushMat);
      blush.position.set(x, 1.33, 0.3);
      blush.rotation.y = x * 1.6;
      group.add(blush);
    }
    group.add(body);
    this.pivot.add(group);
    this.placeholder = group;
    this.state = 'idle';
  }

  setState(state, instant = false) {
    if (state === this.state && !instant) return;
    const prev = this.state ? this.actions[this.state] : null;
    const next = this.actions[state];
    const fade = instant ? 0 : CONFIG.character.crossFade;
    const fromState = this.state;
    this.state = state;
    if (!next) {
      prev?.fadeOut(fade);
      return;
    }
    next.reset();
    // keep the feet in step when switching between walk and run
    if (prev && prev !== next && fromState !== 'idle' && state !== 'idle') {
      next.time = (prev.time / prev.getClip().duration) * next.getClip().duration;
    }
    next.setEffectiveTimeScale(this.speedScale[state]);
    next.setEffectiveWeight(1);
    next.fadeIn(fade).play();
    if (prev && prev !== next) prev.fadeOut(fade);
  }

  /** speed = actual ground speed (m/s), so the legs match how fast you move. */
  update(dt, { state, speed, grounded }) {
    this.setState(state);
    const m = CONFIG.movement;
    if (this.mixer) {
      const a = this.actions[this.state];
      if (a && this.state === 'walk') a.setEffectiveTimeScale(this.speedScale.walk * THREE.MathUtils.clamp(speed / m.walkSpeed, 0.55, 1.6));
      if (a && this.state === 'run') a.setEffectiveTimeScale(this.speedScale.run * THREE.MathUtils.clamp(speed / m.runSpeed, 0.65, 1.4));
      this.mixer.update(dt);
    }
    if (this.placeholder) this.animatePlaceholder(dt, speed, grounded);
  }

  /** A little procedural bounce so the capsule still reads as idle / walk / run. */
  animatePlaceholder(dt, speed, grounded) {
    const p = this.placeholder;
    const walking = this.state === 'walk' ? 1 : 0;
    const running = this.state === 'run' ? 1 : 0;
    this.blend.walk += (walking - this.blend.walk) * damp(8, dt);
    this.blend.run += (running - this.blend.run) * damp(8, dt);
    this.phase += dt * (2.2 + speed * 1.55);
    const moving = Math.min(1, this.blend.walk + this.blend.run);
    const bob = Math.abs(Math.sin(this.phase)) * (0.07 * this.blend.walk + 0.13 * this.blend.run);
    const breathe = Math.sin(performance.now() / 650) * 0.012 * (1 - moving);
    if (grounded && !this.wasGrounded) this.squash = 1;
    this.wasGrounded = grounded;
    this.squash += (0 - this.squash) * damp(9, dt);
    const sq = this.squash * 0.18;
    p.position.y = bob;
    p.rotation.x = 0.07 * this.blend.walk + 0.17 * this.blend.run;
    p.rotation.z = Math.sin(this.phase) * 0.05 * moving;
    p.scale.set(1 + sq * 0.6 - breathe * 0.5, 1 - sq + breathe, 1 + sq * 0.6 - breathe * 0.5);
  }
}
