import * as THREE from 'three';

/**
 * Sky, sea, fog and lights. This is the part to replace when the playhub gets
 * its dreamier background: everything here reads its colours from the theme.
 */

export const WATER_LEVEL = -0.86;

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

export function createEnvironment(scene, { islandCenter, isMobile }) {
  scene.fog = new THREE.Fog('#8fe4ff', 70, 230);

  // Sky dome that travels with the camera
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
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
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#00c6ff', roughness: 1, metalness: 0 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;
  water.receiveShadow = true;
  water.name = 'water';
  scene.add(water);

  // Lights: same layout as the original scene
  const ambient = new THREE.AmbientLight('#ffffff', 0.5);
  const sun = new THREE.DirectionalLight('#ff9900', 1.5);
  sun.position.copy(islandCenter).add(new THREE.Vector3(-10, 15, -20));
  sun.target.position.copy(islandCenter);
  sun.castShadow = true;
  const shadowSize = 23;
  Object.assign(sun.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 1, far: 70 });
  sun.shadow.mapSize.setScalar(isMobile ? 1024 : 2048);
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.035;
  sun.shadow.radius = isMobile ? 2 : 3;

  const fill = new THREE.DirectionalLight('#00ecff', 0.5);
  fill.position.copy(islandCenter).add(new THREE.Vector3(10, 3, 10));
  fill.target.position.copy(islandCenter);

  const back = new THREE.PointLight('#ff8800', 30, 0, 1);
  back.position.set(-5, 8, -28);

  scene.add(ambient, sun, sun.target, fill, fill.target, back);

  // Fireflies for the night theme
  const count = isMobile ? 60 : 110;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * 17;
    positions[i * 3] = islandCenter.x + Math.cos(a) * r;
    positions[i * 3 + 1] = 0.6 + Math.random() * 4.2;
    positions[i * 3 + 2] = islandCenter.z + Math.sin(a) * r * 0.9;
    phases[i] = Math.random() * 100;
    speeds[i] = 0.35 + Math.random() * 0.5;
  }
  const fireflyGeometry = new THREE.BufferGeometry();
  fireflyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  fireflyGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  fireflyGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
  const fireflyMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uSize: { value: 9 },
      uColor: { value: new THREE.Color('#ffe58a') },
      uOpacity: { value: 0 },
    },
    vertexShader: fireflyVertex,
    fragmentShader: fireflyFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const fireflies = new THREE.Points(fireflyGeometry, fireflyMaterial);
  fireflies.name = 'fireflies';
  fireflies.frustumCulled = false;
  fireflies.visible = false;
  scene.add(fireflies);

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
      skyMaterial.uniforms.uStars.value = t.stars;
      scene.fog.color.copy(t.fog);
      waterMaterial.color.copy(t.water);
      ambient.color.copy(t.ambient.color);
      ambient.intensity = t.ambient.intensity;
      sun.color.copy(t.sun.color);
      sun.intensity = t.sun.intensity;
      fill.color.copy(t.fill.color);
      fill.intensity = t.fill.intensity;
      back.color.copy(t.back.color);
      back.intensity = t.back.intensity;
      fireflyMaterial.uniforms.uOpacity.value = t.fireflies;
      fireflies.visible = t.fireflies > 0.01;
    },

    update(time, camera, pixelRatio) {
      sky.position.copy(camera.position);
      skyMaterial.uniforms.uTime.value = time;
      fireflyMaterial.uniforms.uTime.value = time;
      fireflyMaterial.uniforms.uPixelRatio.value = pixelRatio;
    },
  };
}
