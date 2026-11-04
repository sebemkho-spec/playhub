import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { CONFIG } from '../config.js';

/**
 * Renderer + post-processing, matching the original: HDR render, bloom on
 * anything brighter than 0.9 (the portals), then ACES filmic tone mapping.
 */
export function createRenderer(canvas, { isMobile }) {
  const r = CONFIG.render;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false, // MSAA happens in the composer instead
    powerPreference: 'high-performance',
    stencil: false,
  });
  const maxDpr = isMobile ? r.maxPixelRatioMobile : r.maxPixelRatio;
  const deviceDpr = () => Math.min(window.devicePixelRatio || 1, maxDpr);
  let dpr = deviceDpr();
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NoToneMapping; // done by the ToneMappingEffect below
  renderer.toneMappingExposure = 1.7;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 0.5, 700);

  const samples = Math.min(isMobile ? r.msaaMobile : r.msaa, renderer.capabilities.maxSamples ?? 4);
  const composer = new EffectComposer(renderer, { multisampling: samples, frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new BloomEffect({
    intensity: 0.9,
    luminanceThreshold: 0.9,
    luminanceSmoothing: 0.03,
    mipmapBlur: true,
    radius: 0.8,
    levels: isMobile ? 6 : 8,
  });
  const toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  composer.addPass(new EffectPass(camera, bloom, toneMapping));

  const baseFov = CONFIG.camera.fov;
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(dpr);
    composer.setSize(w, h, false);
    camera.aspect = w / h;
    // portrait screens: widen the view so the island still fits side to side
    const minHorizontal = 36 * (Math.PI / 180);
    const needed = (2 * Math.atan(Math.tan(minHorizontal / 2) / camera.aspect) * 180) / Math.PI;
    camera.fov = THREE.MathUtils.clamp(Math.max(baseFov, needed), baseFov, 64);
    camera.updateProjectionMatrix();
  }
  resize();

  // Lower the resolution a notch if the frame rate struggles, raise it back when there's headroom.
  const gov = { frames: 0, time: 0, slow: 0, fast: 0, enabled: false };
  function adapt(dt) {
    if (!r.adaptiveResolution || !gov.enabled || dt > 0.2) return;
    gov.frames++;
    gov.time += dt;
    if (gov.time < 1) return;
    const fps = gov.frames / gov.time;
    gov.frames = 0;
    gov.time = 0;
    if (fps < 47) {
      gov.slow++;
      gov.fast = 0;
    } else if (fps > 57) {
      gov.fast++;
      gov.slow = 0;
    } else gov.slow = gov.fast = 0;
    if (gov.slow >= 2 && dpr > 1) {
      dpr = Math.max(1, +(dpr - 0.25).toFixed(2));
      gov.slow = 0;
      resize();
    } else if (gov.fast >= 6 && dpr < deviceDpr()) {
      dpr = Math.min(deviceDpr(), +(dpr + 0.25).toFixed(2));
      gov.fast = 0;
      resize();
    }
  }

  return {
    renderer,
    scene,
    camera,
    composer,
    bloom,
    resize,
    adapt,
    startAdapting: () => (gov.enabled = true),
    get pixelRatio() {
      return dpr;
    },
  };
}
