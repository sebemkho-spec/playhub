import '@fontsource/nunito/400.css';
import '@fontsource/nunito/700.css';
import '@fontsource/nunito/800.css';
import '@fontsource/nunito/900.css';
import './ui/styles.css';

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

import { CONFIG } from './config.js';
import { store, isTouchDevice, prefersReducedMotion } from './state.js';
import { assetExists } from './assets.js';
import { PORTALS } from './data/portals.js';
import { Physics } from './physics/physics.js';
import { Character } from './character/character.js';
import { PlayerController } from './character/controller.js';
import { Input } from './character/input.js';
import { createRenderer } from './world/renderer.js';
import { createEnvironment, WATER_LEVEL } from './world/environment.js';
import { buildIsland, colliderToWorld, groundHeight, islandToWorld, islandYawToWorld } from './world/island.js';
import { SPAWN, SHORE } from './world/layout.js';
import { buildPortals } from './world/portals.js';
import { buildSwitches } from './world/switches.js';
import { buildInstructions } from './world/instructions.js';
import { CameraRig } from './world/cameraRig.js';
import { mixTheme } from './world/themeMix.js';
import { applySurfaceGlow } from './world/materials.js';
import { createIntro } from './world/intro.js';
import { LoadingScreen } from './ui/loader.js';
import { PortalCard } from './ui/card.js';
import { EggCounter } from './ui/eggCounter.js';
import { setupToggles } from './ui/toggles.js';
import { setupControls } from './ui/controls.js';
import { AudioManager } from './ui/audio.js';
import { showCharacterReport } from './ui/diagnostics.js';

const BASE = import.meta.env.BASE_URL;
const DEBUG = new URLSearchParams(location.search).has('debug');
const $ = (selector) => document.querySelector(selector);
const smooth = (t) => t * t * (3 - 2 * t);

if (isTouchDevice) document.documentElement.classList.add('is-touch');

/**
 * Every picture the cards show (the one above each card, and any <img> or video poster in its
 * text), so they're loaded before you start and a card never opens half-empty.
 * (Songs and clips aren't included: they only download when someone presses play.)
 */
function cardPictures() {
  const urls = PORTALS.flatMap((p) => [
    p.image,
    // every <img> and video poster in its text, except the ones marked loading="lazy" (like the
    // Gallery's many pictures, which only download when someone actually scrolls to them)
    ...[...(p.body ?? '').matchAll(/<(?:img|video)\b[^>]*>/gi)]
      .filter(([tag]) => !/\bloading="lazy"/i.test(tag))
      .map(([tag]) => tag.match(/\b(?:src|poster)="([^"]+\.(?:png|jpe?g|webp|avif|gif|svg))"/i)?.[1]),
  ]);
  return [...new Set(urls.filter(Boolean))];
}

async function boot(loading) {
  const { manager } = loading;
  manager.itemStart('boot'); // keeps the percentage honest until every load is queued

  const canvas = $('#scene');
  const view = createRenderer(canvas, { isMobile: isTouchDevice });
  const { renderer, scene, camera, composer, bloom } = view;

  // GLTFLoader with Draco + meshopt geometry and KTX2 textures, so models can be compressed later.
  // (three.js bundles the Draco/Basis decoders itself; they're only downloaded if a model needs them.)
  const draco = new DRACOLoader(manager);
  const ktx2 = new KTX2Loader(manager).detectSupport(renderer);
  const gltfLoader = new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);

  const character = new Character();
  const fontUrl = `${BASE}fonts/nunito-black.typeface.json`;
  const loads = Promise.all([
    loading.track('physics', Physics.create()),
    new FontLoader(manager).loadAsync(fontUrl, loading.bytes(fontUrl)),
    character.load({ gltfLoader, exists: assetExists, onBytes: loading.bytes }),
    loading.track('fonts', document.fonts?.ready ?? Promise.resolve()),
    ...cardPictures().map((url) =>
      new THREE.ImageLoader(manager).loadAsync(url).catch(() => console.warn(`[playhub] Card image not found: ${url}`)),
    ),
  ]);
  setTimeout(() => manager.itemEnd('boot'), 0);
  const [physics, font] = await loads;

  /* ── World ─────────────────────────────────────────────────────────────── */
  const island = buildIsland();
  scene.add(island.root);
  const xs = SHORE.map((p) => p[0]);
  const zs = SHORE.map((p) => p[1]);
  const islandCenter = islandToWorld((Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2);
  const env = createEnvironment(scene, { islandCenter, isMobile: isTouchDevice });
  const portals = buildPortals(island.root, { font });
  const switches = buildSwitches(island.root);
  const instructions = buildInstructions(scene, { font, isTouch: isTouchDevice });
  instructions.place(camera.aspect);

  for (const spec of [...island.colliders, ...portals.colliders, ...switches.colliders]) {
    physics.addStatic(colliderToWorld(spec));
  }

  /* ── Player ────────────────────────────────────────────────────────────── */
  const spawn = islandToWorld(SPAWN.x, groundHeight(SPAWN.x, SPAWN.z), SPAWN.z);
  const spawnYaw = islandYawToWorld(SPAWN.facing);
  const player = new PlayerController(physics, spawn, spawnYaw, WATER_LEVEL - 4);
  scene.add(character.root);
  character.root.position.copy(spawn);
  character.root.rotation.y = spawnYaw;
  character.root.visible = false;

  const input = new Input();
  const rig = new CameraRig(camera, CONFIG.camera, physics);
  rig.snap(spawn);

  /* ── UI ────────────────────────────────────────────────────────────────── */
  const audio = new AudioManager();
  // a song or clip playing on a card hushes the island's own sounds until it's done
  const card = new PortalCard($('[data-card-layer]'), { onClose: () => closeCard(), onMedia: (playing) => audio.hush(playing) });
  setupToggles($('[data-hud]'));
  const eggs = new EggCounter($('[data-eggs]'), {
    ids: PORTALS.filter((p) => p.shape === 'egg').map((p) => p.id),
    remember: CONFIG.easterEggs.remember,
    // (a reset locks everything again; the unlocking itself waits for the last egg's card to close)
    onChange: () => !eggs.complete && relock(),
  });

  /* ── Locked portals: the Gallery stays dull and padlocked until every easter egg is found ── */
  const lockedPortals = portals.items.filter((p) => p.lock);
  let unlockPending = false;
  function relock() {
    unlockPending = false;
    lockedPortals.forEach((p) => portals.setLocked(p, !eggs.complete));
  }
  relock(); // (someone who found them all on an earlier visit finds it open)
  function unlockAll() {
    const opened = lockedPortals.filter((p) => portals.unlock(p));
    if (!opened.length) return;
    audio.play('unlock');
    $('[data-eggs-live]').textContent = `${opened.map((p) => p.data.locked.title ?? p.data.title).join(' and ')} unlocked!`;
  }
  /** What a portal's card shows: its `locked` version while it's still locked. */
  const cardFor = (data) =>
    data.locked && !eggs.complete
      ? { id: data.id, title: data.locked.title ?? data.title, body: (data.locked.body ?? '').replaceAll('{eggs}', String(eggs.total)), layout: data.locked.layout ?? 'locked' }
      : data;

  const projected = new THREE.Vector3();
  function openCard(item) {
    item.latched = true;
    store.set({ activePortal: item.data.id });
    projected.copy(item.focusWorld).project(camera);
    card.open(cardFor(item.data), { x: ((projected.x + 1) / 2) * window.innerWidth, y: ((1 - projected.y) / 2) * window.innerHeight });
    audio.play('portal');
    // counts it, if it's an easter egg seen for the first time; the last one unlocks the Gallery
    // once its card closes (so the burst of light isn't hidden behind the card)
    if (eggs.find(item.data.id) && eggs.complete && lockedPortals.length) unlockPending = true;
  }
  function closeCard() {
    if (!store.get().activePortal) return;
    store.set({ activePortal: null });
    card.close();
    if (unlockPending) {
      unlockPending = false;
      setTimeout(unlockAll, 350);
    }
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickSwitch = (x, y) => {
    ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects(switches.hitTargets, false)[0]?.object.userData.switchKind ?? null;
  };
  let started = false;
  let hoverAt = 0;
  setupControls(canvas, {
    rig,
    input,
    joystickEl: $('[data-joystick]'),
    isTouch: isTouchDevice, // phones and tablets: corner joystick + a finger to look around
    onTap(x, y) {
      if (!started) return;
      const kind = pickSwitch(x, y);
      if (kind === 'theme') store.set({ theme: store.get().theme === 'dark' ? 'light' : 'dark' });
      if (kind === 'sound') store.set({ sound: !store.get().sound });
    },
    onHover(x, y) {
      const now = performance.now();
      if (!started || now - hoverAt < 60) return;
      hoverAt = now;
      canvas.classList.toggle('is-pointing', !!pickSwitch(x, y));
    },
  });

  /* ── Day / night ───────────────────────────────────────────────────────── */
  let themeT = store.get().theme === 'dark' ? 1 : 0;
  let themeGoal = themeT;
  const mood = mixTheme(themeT); // the current day/night blend of the active theme
  const applyTheme = () => {
    mixTheme(smooth(themeT), mood);
    env.applyTheme(mood);
    applySurfaceGlow(mood.surfaceGlow);
    character.setGlow(mood.characterGlow);
    bloom.intensity = mood.bloom;
    renderer.toneMappingExposure = mood.exposure;
  };
  applyTheme();
  switches.set('theme', store.get().theme === 'light', true);
  switches.set('sound', store.get().sound, true);

  store.subscribe((state, prev) => {
    if (state.theme !== prev.theme) {
      themeGoal = state.theme === 'dark' ? 1 : 0;
      switches.set('theme', state.theme === 'light');
      audio.play('toggle');
    }
    if (state.sound !== prev.sound) {
      switches.set('sound', state.sound);
      audio.setEnabled(state.sound);
      audio.play('toggle');
    }
  });

  /* ── Intro ─────────────────────────────────────────────────────────────── */
  let reveal = 0;
  let playerActive = false;
  // The character stands on the island from the start and rises out of the sea with it
  // (see the frame loop); once the island has landed, it can move.
  const spawnPlayer = () => {
    player.teleport(spawn.clone(), spawnYaw);
    playerActive = true;
    input.enabled = true;
    audio.play('pop', { volume: 0.8 });
  };
  const intro = createIntro([
    { at: 0.2, run: () => audio.play('whoosh', { rate: 0.85 }) },
    { at: 0.5, duration: 1.0, run: (k) => (island.root.position.y = -10 * (1 - k)) },
    { at: 0.5, duration: 2.0, run: (k) => (island.flora.position.y = -3 * (1 - k)) },
    { at: 0.8, duration: 1.5, run: (k) => (island.statues.position.y = -4 * (1 - k)) },
    { at: 0.8, duration: 1.0, run: (k) => switches.group.forEach((g) => (g.position.y = g.userData.baseY - 2 * (1 - k))) },
    { at: 1.3, duration: 1.5, ease: 'linear', run: (k) => env.revealFloatingLights(k) }, // once the island is up
    { at: 1.55, run: spawnPlayer },
    { at: 1.9, duration: 0.9, ease: 'linear', run: (k) => (reveal = k) },
  ]);

  function start() {
    audio.unlock(store.get().sound); // must happen inside the click
    started = true;
    character.root.visible = true;
    store.set({ started: true });
    document.body.classList.add('is-started');
    loading.hide({ sound: (name) => audio.play(name) });
    // open on a wider shot of the island; it eases back to the character once you walk
    rig.setOpeningShot({ pan: islandCenter.clone().sub(spawn).setY(0).multiplyScalar(0.4), distance: CONFIG.camera.openingDistance });
    if (prefersReducedMotion) {
      intro.finish();
    } else {
      intro.start();
      rig.playIntro({ distance: CONFIG.camera.maxDistance, polar: 30, yaw: rig.yawGoal + 0.7, duration: 2.8 });
    }
    setTimeout(() => view.startAdapting(), 4000);
    setTimeout(() => showCharacterReport($('[data-diag]'), character.report, { force: DEBUG }), 2500);
  }

  /* ── Debug helpers ─────────────────────────────────────────────────────── */
  let debugColliders = DEBUG;
  physics.setDebug(scene, debugColliders);
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') {
      debugColliders = !debugColliders;
      physics.setDebug(scene, debugColliders);
    }
  });
  if (DEBUG) {
    const { default: Stats } = await import('three/addons/libs/stats.module.js');
    const stats = new Stats();
    stats.dom.style.cssText = 'position:fixed;left:8px;top:8px;z-index:40';
    document.body.append(stats.dom);
    renderer.info.autoReset = true;
    view.stats = stats;
  }
  if (import.meta.env.DEV || DEBUG) {
    window.__playhub = {
      THREE, scene, camera, renderer, rig, player, physics, portals, store, input, character, card, switches, audio,
      islandToWorld, groundHeight, loading, eggs, unlockAll,
      /** Move the player to island coordinates (x, z). */
      teleport(x, z, yawDeg = 0) {
        const p = islandToWorld(x, groundHeight(x, z) + 0.05, z);
        player.teleport(p, islandYawToWorld(yawDeg));
        rig.snap(p);
        return p;
      },
    };
  }

  /* ── Loop ──────────────────────────────────────────────────────────────── */
  window.addEventListener('resize', () => {
    view.resize();
    instructions.place(camera.aspect);
  });

  // warm up: compile shaders and draw a frame behind the loading screen
  rig.update(1 / 60, player.position, false);
  // light orbs (when the theme has them) find clear spots, so none float through walls, props or the 3D text
  const textSpots = instructions.footprints();
  env.settleFloatingLights((x, z) => {
    let top = physics.surfaceHeight(x, z);
    for (const s of textSpots) if (Math.hypot(x - s.x, z - s.z) < s.radius) top = Math.max(top ?? -Infinity, s.top);
    return top;
  });
  await renderer.compileAsync(scene, camera).catch(() => {});
  composer.render(1 / 60);

  const timer = new THREE.Timer();
  timer.connect(document);
  let simTime = 0;

  /** One frame of the experience. `fixedDt` is only used by the dev test hooks. */
  function frame(timestamp, fixedDt) {
    timer.update(timestamp);
    if (!started) return;
    const dt = fixedDt ?? Math.min(timer.getDelta(), 1 / 20);
    simTime += dt;
    const time = simTime;
    view.stats?.begin();

    if (themeT !== themeGoal) {
      const step = dt / 1.1;
      themeT = themeGoal > themeT ? Math.min(themeGoal, themeT + step) : Math.max(themeGoal, themeT - step);
      applyTheme();
    }

    intro.update(dt);
    const move = input.update();
    if (playerActive) player.update(dt, move, rig.forward, rig.right);
    physics.step(dt);

    character.root.position.copy(player.position);
    character.root.position.y += island.root.position.y; // rides up with the island during the opening (0 after)
    character.root.rotation.y = player.yaw;
    character.update(dt, { state: playerActive ? player.state : 'idle', speed: player.speed, grounded: player.grounded });

    if (playerActive) {
      const { enter, leave } = portals.check(player.position, store.get().activePortal);
      if (enter) openCard(enter);
      else if (leave) closeCard();
    }
    portals.update(dt, time, mood, store.get().activePortal);
    switches.update(dt, mood);
    instructions.update(time, mood, reveal);
    rig.update(dt, player.position, player.speed > 0.3);
    env.update(time, camera, view.pixelRatio);
    audio.footsteps(playerActive && player.grounded && player.state !== 'idle', player.running);
    physics.updateDebug();

    composer.render(dt);
    if (fixedDt === undefined) view.adapt(dt);
    view.stats?.end();
  }
  renderer.setAnimationLoop((timestamp) => frame(timestamp));

  if (window.__playhub) {
    Object.assign(window.__playhub, {
      composer,
      start,
      /** Stop / restart the browser-driven loop (so tests can step frames exactly). */
      pause: () => renderer.setAnimationLoop(null),
      resume: () => renderer.setAnimationLoop((timestamp) => frame(timestamp)),
      /**
       * Advance the world by `seconds` at 60 fps without waiting for the browser (for tests).
       * `move` = { x, y, run } like the joystick: x = right, y = forward (screen-relative).
       */
      advance(seconds, move) {
        if (move) Object.assign(input.joystick, { active: true, x: move.x ?? 0, y: move.y ?? 0, run: !!move.run });
        const steps = Math.round(seconds * 60);
        for (let i = 0; i < steps; i++) frame(performance.now(), 1 / 60);
        if (move) Object.assign(input.joystick, { active: false, x: 0, y: 0, run: false });
      },
    });
  }

  loading.ready(start);
}

const loading = new LoadingScreen($('[data-loader]'));
boot(loading).catch((err) => {
  console.error('[playhub] Failed to start:', err);
  const noWebGL = /WebGL|context/i.test(String(err?.message));
  // a phone or tablet that can't run the 3D is sent to a computer; computers keep their own message
  const no3D = isTouchDevice
    ? "Hmm, there seems to be a problem loading up your Playhub. Please use desktop to open, what's inside is worth it!"
    : "This browser can't show 3D right now (WebGL is unavailable).";
  loading.fail(noWebGL ? no3D : 'Something went wrong while loading. Try refreshing the page.');
});
