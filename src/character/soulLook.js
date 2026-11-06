import * as THREE from 'three';

/**
 * The 'soul' look for the stand-in capsule (theme.js → props.placeholderStyle): see-through,
 * glowing softly from within, with a shimmer of colour around its edges and a faint halo.
 * Colours come from theme.props.soul.
 */

const BODY_GLOW = 0.55; // how much the body lights itself (times the day/night characterGlow)

/** Body material for a capsule of the given full height (centred on its own origin). */
export function soulBodyMaterial(soul, height) {
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.35,
    emissive: '#ffffff',
    emissiveIntensity: BODY_GLOW,
    transparent: true,
    opacity: soul.opacity,
    depthWrite: false, // so the eyes inside can show through it
  });
  const uniforms = {
    uSoulBottom: { value: new THREE.Color(soul.bottom) },
    uSoulTop: { value: new THREE.Color(soul.top) },
    uShimmerA: { value: new THREE.Color(soul.shimmer[0]) },
    uShimmerB: { value: new THREE.Color(soul.shimmer[1]) },
    uShimmerC: { value: new THREE.Color(soul.shimmer[2]) },
    uSoulHeight: { value: height },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSoulHeight;\nvarying float vSoulY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSoulY = clamp(position.y / uSoulHeight + 0.5, 0.0, 1.0);');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uSoulBottom;
        uniform vec3 uSoulTop;
        uniform vec3 uShimmerA;
        uniform vec3 uShimmerB;
        uniform vec3 uShimmerC;
        varying float vSoulY;`,
      )
      // colour from feet to head (lit only gently, so its own glow carries the colour and
      // bright daylight doesn't wash it out to white)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(uSoulBottom, uSoulTop, smoothstep(0.3, 0.95, vSoulY)) * 0.55;')
      // glow from within, a shimmer of colour toward the edges, and softer, more see-through edges
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // (clamped so rounding never hands pow() a negative number: that makes NaN = black flashes)
        float soulEdge = clamp(1.0 - abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0);
        float shimmer = pow(soulEdge, 2.2);
        vec3 shimmerColor = mix(mix(uShimmerA, uShimmerB, smoothstep(-0.5, 0.7, normal.y)), uShimmerC, smoothstep(0.1, 0.9, -normal.x));
        totalEmissiveRadiance = emissive * (diffuseColor.rgb * 1.8 + shimmerColor * shimmer * 1.1);
        diffuseColor.rgb = mix(diffuseColor.rgb, shimmerColor, shimmer * 0.45);
        diffuseColor.a *= 1.0 - 0.5 * pow(soulEdge, 1.6);`,
      );
  };
  return material;
}

/** A soft glow around the body: a slightly bigger capsule seen from inside, fading outward. */
export function soulHaloMaterial(soul, height) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBottom: { value: new THREE.Color(soul.bottom) },
      uTop: { value: new THREE.Color(soul.top) },
      uStrength: { value: soul.halo },
      uHeight: { value: height },
    },
    vertexShader: /* glsl */ `
      uniform float uHeight;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying float vY;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDir = normalize(-mv.xyz);
        vY = clamp(position.y / uHeight + 0.5, 0.0, 1.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBottom;
      uniform vec3 uTop;
      uniform float uStrength;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      varying float vY;
      void main() {
        float k = pow(clamp(-dot(normalize(vNormalV), normalize(vViewDir)), 0.0, 1.0), 2.4);
        gl_FragColor = vec4(mix(uBottom, uTop, vY) * 1.4, k * uStrength);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
}

/** Fade a face detail (the eyes) out when the face turns away, so they don't show through the back. */
export function fadeWhenFacingAway(material) {
  material.transparent = true;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vFacing;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvFacing = normalize((modelViewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz).z;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFacing;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= smoothstep(-0.15, 0.35, vFacing);');
  };
  return material;
}

/** Day/night: scale the body's own light and the halo (theme day/night characterGlow). */
export function setSoulGlow({ body, halo }, soul, k) {
  body.emissiveIntensity = BODY_GLOW * k;
  halo.uniforms.uStrength.value = soul.halo * k;
}
