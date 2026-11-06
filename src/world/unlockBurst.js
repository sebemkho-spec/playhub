import * as THREE from 'three';

/**
 * The burst of light when a locked portal opens: a beam shooting up into the sky (so you can
 * spot it from across the island), a ring of light rolling out over the ground, and a shower of
 * sparkles drifting up off the frame like embers. Built in the portal's own space (ground at
 * y = 0) around `focus`; `update(t)` plays it (t = seconds since it began) and returns false
 * once it's over, when `dispose()` tidies it away.
 */
export function createUnlockBurst({ color, focus, size = [2, 2.5], sparkles = 70, beam = 13, glow = 2.2 }) {
  const group = new THREE.Group();
  group.name = 'unlock-burst';
  const tint = new THREE.Color(color);
  const [w, h] = size;
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);

  /* sparkles */
  const n = sparkles;
  const start = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const life = new Float32Array(n);
  const sizes = new Float32Array(n);
  const white = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (rnd() - 0.5) * w;
    start.set([x, focus.y + (rnd() - 0.5) * h * 0.9, (rnd() - 0.5) * 0.3], i * 3);
    vel.set([x * 1.4 + (rnd() - 0.5) * 1.6, 0.6 + rnd() * 2.2, (rnd() - 0.5) * 2.6], i * 3);
    life[i] = 1.2 + rnd() * 1.3;
    sizes[i] = 0.07 + rnd() * 0.11;
    white[i] = rnd();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(start, 3));
  geo.setAttribute('aVel', new THREE.BufferAttribute(vel, 3));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aWhite', new THREE.BufferAttribute(white, 1));
  const sparkleMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uViewScale: { value: 800 }, uColor: { value: tint }, uGlow: { value: glow } },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uViewScale;
      attribute vec3 aVel;
      attribute float aLife;
      attribute float aSize;
      attribute float aWhite;
      varying float vAlpha;
      varying float vWhite;
      void main() {
        float t = max(uTime, 0.0);
        float k = clamp(t / aLife, 0.0, 1.0);
        // flung out, slowing down, then drifting upward like embers
        vec3 p = position + aVel * (1.0 - exp(-t * 1.8)) / 1.8 + vec3(0.0, 0.22 * t * t, 0.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float twinkle = 0.7 + 0.3 * sin(t * 17.0 + aWhite * 40.0);
        vAlpha = step(0.0, uTime) * smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.4, 1.0, k)) * twinkle;
        vWhite = aWhite;
        gl_PointSize = aSize * (1.0 - 0.45 * k) * uViewScale / max(-mv.z, 0.1);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uGlow;
      varying float vAlpha;
      varying float vWhite;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = 1.0 - smoothstep(0.0, 1.0, d);
        a *= a * vAlpha;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), vWhite * 0.65) * uGlow * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, sparkleMat);
  points.frustumCulled = false; // (they move in the shader, so their resting bounds mean nothing)
  // world-sized sparkles: work out how many pixels one unit is, for whatever is drawing them
  const px = new THREE.Vector2();
  points.onBeforeRender = (renderer, scene, camera) => {
    renderer.getDrawingBufferSize(px);
    sparkleMat.uniforms.uViewScale.value = px.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  };
  group.add(points);

  /* beam */
  const beamGeo = new THREE.CylinderGeometry(w * 0.55, w * 0.32, beam, 32, 1, true);
  beamGeo.translate(0, beam / 2, 0);
  const beamMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: tint }, uGlow: { value: glow }, uFade: { value: 0 }, uHeight: { value: beam } },
    vertexShader: /* glsl */ `
      uniform float uHeight;
      varying float vUp;
      varying float vFacing;
      void main() {
        vUp = clamp(position.y / uHeight, 0.0, 1.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uGlow;
      uniform float uFade;
      varying float vUp;
      varying float vFacing;
      void main() {
        // brightest low down and through its middle, melting into the sky at the top
        // (clamped: at the very top, 1.0 - vUp can come out a hair below zero, and pow() of a
        // negative number is NaN, which the bloom smears over the whole screen as black)
        float facing = clamp(vFacing, 0.0, 1.0);
        float a = pow(clamp(1.0 - vUp, 0.0, 1.0), 1.7) * facing * facing * uFade;
        gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.35) * uGlow * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const beamMesh = new THREE.Mesh(beamGeo, beamMat);
  beamMesh.frustumCulled = false;
  group.add(beamMesh);

  /* ring */
  const ringMat = new THREE.MeshBasicMaterial({
    color: tint.clone().multiplyScalar(glow),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 72), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  group.add(ring);

  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  return {
    group,
    update(t) {
      sparkleMat.uniforms.uTime.value = t;
      // the beam shoots up fast, hangs a moment, then fades
      beamMesh.scale.y = 0.04 + 0.96 * ease(t / 0.3);
      beamMat.uniforms.uFade.value = t < 0 ? 0 : Math.min(1, t / 0.08) * Math.exp(-Math.max(0, t - 0.45) / 0.75);
      beamMesh.visible = beamMat.uniforms.uFade.value > 0.002;
      const r = ease(t / 1.3);
      ring.scale.setScalar(0.4 + r * 4.6);
      ringMat.opacity = t < 0 ? 0 : (1 - r) * 0.9;
      return t < 3.2;
    },
    dispose() {
      group.removeFromParent();
      for (const o of [points, beamMesh, ring]) {
        o.geometry.dispose();
        o.material.dispose();
      }
    },
  };
}
