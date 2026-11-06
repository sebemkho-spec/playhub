import * as THREE from 'three';
import { theme } from './theme.js';

/**
 * Sky, sea, fog, lights and the floating lights (fireflies or orbs). Every colour
 * and strength comes from src/world/theme.js; this file only decides what exists and where.
 */

export const WATER_LEVEL = -0.86;

/** Tiny deterministic random, so the orbs start in the same places every visit. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // always at the far plane
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uGlow;
  uniform float uGlowStrength;
  uniform float uStars;
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = clamp(dir.y, 0.0, 1.0);
    vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
    // a soft band of light hugging the horizon (0 strength = off)
    col += uGlow * uGlowStrength * (pow(1.0 - h, 7.0) + 0.35 * pow(1.0 - h, 2.0));
    if (uStars > 0.0) {
      vec3 cell = floor(dir * 140.0);
      float star = step(0.9965, hash(cell));
      float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + hash(cell + 3.1) * 40.0);
      col += vec3(star * twinkle * smoothstep(0.02, 0.25, h)) * uStars * 1.6;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

const fireflyVertex = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSize;
  attribute float aPhase;
  attribute float aSpeed;
  varying float vBlink;
  void main() {
    vec3 p = position;
    float t = uTime * aSpeed + aPhase;
    p.x += sin(t * 0.9) * 0.6 + sin(t * 2.3) * 0.15;
    p.y += sin(t * 1.3) * 0.35;
    p.z += cos(t * 0.7) * 0.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vBlink = 0.55 + 0.45 * sin(t * 3.1);
    gl_PointSize = uSize * uPixelRatio * (12.0 / -mv.z) * (0.7 + 0.3 * vBlink);
  }
`;

const fireflyFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vBlink;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float glow = smoothstep(0.5, 0.0, d);
    gl_FragColor = vec4(uColor * 3.0 * vBlink, glow * glow * uOpacity);
  }
`;

// Light orbs: each one floats slowly up through `uRise`, swaying a little, fading in at
// the bottom and out at the top, then starts again below.
const orbVertex = /* glsl */ `
  uniform float uTime;
  uniform float uViewScale; // screen pixels per world unit, one unit in front of the camera
  uniform float uSize; // orb width in world units
  uniform float uRise;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aScale;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    vec3 p = position;
    float cycle = fract(aPhase + uTime * aSpeed);
    p.y += cycle * uRise;
    float sway = uTime * 0.22 + aPhase * 40.0;
    p.x += sin(sway) * 0.45;
    p.z += cos(sway * 0.8) * 0.45;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vFade = sin(cycle * 3.14159265) * (0.85 + 0.15 * sin(uTime * 0.9 + aPhase * 20.0));
    vColor = aColor;
    gl_PointSize = uSize * aScale * uViewScale / -mv.z;
  }
`;

// How far an orb's glow can reach from the spot it starts above: its sway (0.45 each way
// in the shader above, so up to ~0.64 diagonally) plus the visible part of the biggest orbs.
const orbReach = (size) => 0.64 + size * 1.4 * 0.45;

const orbFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0; // 0 in the middle, 1 at the edge
    float body = smoothstep(0.62, 0.32, d); // the soft ball itself
    float core = smoothstep(0.3, 0.0, d); // its bright heart
    float halo = pow(max(0.0, 1.0 - d), 2.0); // the glow around it
    gl_FragColor = vec4(vColor * (1.0 + core * 1.5), (body * 0.75 + halo * 0.4) * vFade * uOpacity);
  }
`;

const mistVertex = /* glsl */ `
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const mistFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uScale;
  uniform vec2 uCenter;
  uniform float uShore;
  uniform float uReach;
  varying vec3 vWorld;
  #include <fog_pars_fragment>

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.02 + vec2(3.1, 1.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 p = vWorld.xz * uScale;
    float n = fbm(p + vec2(uTime * 0.6, uTime * 0.25)) * 0.65 + fbm(p * 2.3 - vec2(uTime * 0.4, -uTime * 0.3)) * 0.35;
    float wisps = smoothstep(0.36, 0.8, n);
    // thickest in a band hugging the shore, thinning out toward the horizon
    float d = distance(vWorld.xz, uCenter);
    float band = smoothstep(uShore * 0.55, uShore, d) * (1.0 - smoothstep(uShore, uReach, d));
    gl_FragColor = vec4(uColor, uOpacity * wisps * (0.3 + 0.7 * band));
    #include <fog_fragment>
  }
`;

export function createEnvironment(scene, { islandCenter, isMobile }) {
  const { day, effects } = theme;
  scene.fog = new THREE.Fog(day.fog, effects.fogNear, effects.fogFar);

  // Sky dome that travels with the camera
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
      uGlowStrength: { value: 0 },
      uStars: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), skyMaterial);
  sky.name = 'sky';
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  // The sea (the original's cyan floor)
  const waterMaterial = new THREE.MeshStandardMaterial({ color: day.sea, roughness: 1, metalness: 0 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;
  water.receiveShadow = true;
  water.name = 'water';
  scene.add(water);

  // Soft mist drifting just above the sea (off when the theme's mist opacity is 0)
  const mistMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uColor: { value: new THREE.Color() },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uScale: { value: effects.mistScale },
        uCenter: { value: new THREE.Vector2(islandCenter.x, islandCenter.z) },
        uShore: { value: effects.mistShore },
        uReach: { value: effects.mistReach },
      },
    ]),
    vertexShader: mistVertex,
    fragmentShader: mistFragment,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mistMaterial);
  mist.rotation.x = -Math.PI / 2;
  mist.position.y = WATER_LEVEL + 0.14;
  mist.renderOrder = 1;
  mist.visible = false;
  mist.name = 'mist';
  scene.add(mist);

  // Lights: same layout as the original scene (colours/strengths are set by applyTheme)
  const ambient = new THREE.AmbientLight(day.ambient.color, day.ambient.intensity);
  const sun = new THREE.DirectionalLight(day.sun.color, day.sun.intensity);
  sun.position.copy(islandCenter).add(new THREE.Vector3(-10, 15, -20));
  sun.target.position.copy(islandCenter);
  sun.castShadow = true;
  const shadowSize = 23;
  Object.assign(sun.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 1, far: 70 });
  sun.shadow.mapSize.setScalar(isMobile ? 1024 : 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = isMobile ? 2 : 3;

  const fill = new THREE.DirectionalLight(day.fill.color, day.fill.intensity);
  fill.position.copy(islandCenter).add(new THREE.Vector3(10, 3, 10));
  fill.target.position.copy(islandCenter);

  const back = new THREE.PointLight(day.back.color, day.back.intensity, 0, 1);
  back.position.set(-5, 8, -28);

  scene.add(ambient, sun, sun.target, fill, fill.target, back);

  // Floating lights: fireflies (they dart about) or orbs (they float slowly up), per the theme
  const look = effects.floatingLights;
  const orbs = look.style === 'orbs';
  const count = isMobile ? Math.floor(look.count * 0.55) : look.count;
  const rand = orbs ? seeded(5) : Math.random;
  const palette = look.colors.map((c) => new THREE.Color(c));
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const scales = new Float32Array(count);
  const tints = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * (orbs ? 20 : 17);
    positions[i * 3] = islandCenter.x + Math.cos(a) * r;
    positions[i * 3 + 1] = orbs ? WATER_LEVEL + rand() * 1.5 : 0.6 + rand() * 4.2;
    positions[i * 3 + 2] = islandCenter.z + Math.sin(a) * r * 0.9;
    // orbs: where in its slow rise each one starts, and one rise every ~25–45 s
    phases[i] = orbs ? rand() : rand() * 100;
    speeds[i] = (orbs ? 0.022 + rand() * 0.018 : 0.35 + rand() * 0.5) * look.speed;
    scales[i] = 0.6 + rand() * 0.8;
    palette[i % palette.length].toArray(tints, i * 3);
  }
  const fireflyGeometry = new THREE.BufferGeometry();
  fireflyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  fireflyGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  fireflyGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  if (orbs) {
    fireflyGeometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    fireflyGeometry.setAttribute('aColor', new THREE.BufferAttribute(tints, 3));
  }
  const fireflyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uViewScale: { value: 1 },
      uSize: { value: look.size },
      uColor: { value: palette[0].clone() },
      uOpacity: { value: 0 },
      uRise: { value: look.rise },
    },
    vertexShader: orbs ? orbVertex : fireflyVertex,
    fragmentShader: orbs ? orbFragment : fireflyFragment,
    transparent: true,
    depthWrite: false,
    // fireflies add light; orbs are painted over the scene so their colours show against a pale sky too
    blending: orbs ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
  const fireflies = new THREE.Points(fireflyGeometry, fireflyMaterial);
  fireflies.name = 'fireflies';
  fireflies.frustumCulled = false;
  fireflies.visible = false;
  scene.add(fireflies);

  // How visible the floating lights are: the theme's day/night strength, times the intro's
  // fade-in (so they appear once the island has risen, not before)
  let lightsStrength = 0;
  let lightsReveal = 0;
  const showLights = () => {
    const k = lightsStrength * lightsReveal;
    fireflyMaterial.uniforms.uOpacity.value = k;
    fireflies.visible = k > 0.01;
  };

  return {
    sky,
    water,
    sun,
    ambient,
    fill,
    back,
    fireflies,

    applyTheme(t) {
      skyMaterial.uniforms.uTop.value.copy(t.skyTop);
      skyMaterial.uniforms.uHorizon.value.copy(t.skyHorizon);
      skyMaterial.uniforms.uGlow.value.copy(t.skyGlow.color);
      skyMaterial.uniforms.uGlowStrength.value = t.skyGlow.strength;
      skyMaterial.uniforms.uStars.value = t.stars;
      scene.fog.color.copy(t.fog);
      waterMaterial.color.copy(t.sea);
      ambient.color.copy(t.ambient.color);
      ambient.intensity = t.ambient.intensity;
      sun.color.copy(t.sun.color);
      sun.intensity = t.sun.intensity;
      fill.color.copy(t.fill.color);
      fill.intensity = t.fill.intensity;
      back.color.copy(t.back.color);
      back.intensity = t.back.intensity;
      lightsStrength = t.floatingLights;
      showLights();
      mistMaterial.uniforms.uColor.value.copy(t.mist.color);
      mistMaterial.uniforms.uOpacity.value = t.mist.opacity;
      mist.visible = t.mist.opacity > 0.005;
    },

    /** Fade the floating lights in (0 → 1) during the opening, once the island is up. */
    revealFloatingLights(k) {
      lightsReveal = k;
      showLights();
    },

    /**
     * Orbs only: move each orb to a clear spot, where nothing within its reach (sway plus
     * glow) stands taller than the ground under it, and start it just above that ground,
     * so no orb ever floats through a wall, rock or tree. `heightAt(x, z)` gives the height
     * of the highest solid thing at a world position, or null over open sea.
     */
    settleFloatingLights(heightAt) {
      if (!orbs) return;
      const pick = seeded(9);
      const reach = orbReach(look.size);
      const around = [];
      for (let k = 0; k < 12; k++) around.push([Math.cos((k / 12) * Math.PI * 2) * reach, Math.sin((k / 12) * Math.PI * 2) * reach]);
      for (let k = 0; k < 8; k++) around.push([Math.cos((k / 8 + 0.06) * Math.PI * 2) * reach * 0.5, Math.sin((k / 8 + 0.06) * Math.PI * 2) * reach * 0.5]);
      const top = (x, z) => Math.max(heightAt(x, z) ?? WATER_LEVEL, WATER_LEVEL);
      for (let i = 0; i < count; i++) {
        let best = null;
        for (let attempt = 0; attempt < 20 && !(best && best.bump < 0.05); attempt++) {
          const a = pick() * Math.PI * 2;
          const r = Math.sqrt(pick()) * 20;
          const x = islandCenter.x + Math.cos(a) * r;
          const z = islandCenter.z + Math.sin(a) * r * 0.9;
          const ground = top(x, z);
          let highest = ground;
          for (const [dx, dz] of around) highest = Math.max(highest, top(x + dx, z + dz));
          if (!best || highest - ground < best.bump) best = { x, z, y: highest, bump: highest - ground };
        }
        positions[i * 3] = best.x;
        positions[i * 3 + 1] = best.y + 0.4;
        positions[i * 3 + 2] = best.z;
      }
      fireflyGeometry.attributes.position.needsUpdate = true;
    },

    update(time, camera, pixelRatio) {
      sky.position.copy(camera.position);
      skyMaterial.uniforms.uTime.value = time;
      fireflyMaterial.uniforms.uTime.value = time;
      fireflyMaterial.uniforms.uPixelRatio.value = pixelRatio;
      // orbs are sized in world units: pixels per unit at distance 1 = screen height / (2 · tan(fov / 2))
      fireflyMaterial.uniforms.uViewScale.value = (window.innerHeight * pixelRatio * camera.projectionMatrix.elements[5]) / 2;
      mistMaterial.uniforms.uTime.value = time * effects.mistSpeed * 10;
    },
  };
}
