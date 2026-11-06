import * as THREE from 'three';
import { theme } from './theme.js';

/**
 * One shared material per surface in the active theme (see `surfaces` in theme.js).
 * Any of: color, roughness, metalness, flatShading, emissive, emissiveIntensity, opacity, rim.
 * `emissive` is the surface's own inner glow; day/night scale it with `surfaceGlow`.
 * `rim` makes the edges glow and turn solid, so a see-through surface (opacity < 1) reads like glass.
 */
function build(s) {
  const material = new THREE.MeshStandardMaterial({
    color: s.color,
    roughness: s.roughness ?? 1,
    metalness: s.metalness ?? 0,
    flatShading: !!s.flatShading,
    emissive: s.emissive ?? '#000000',
    emissiveIntensity: s.emissiveIntensity ?? 1,
    transparent: s.opacity !== undefined && s.opacity < 1,
    opacity: s.opacity ?? 1,
  });
  material.userData.baseGlow = material.emissiveIntensity;
  if (s.rim) addRimGlow(material, s.rim);
  return material;
}

/** Brighter, more solid edges where the surface turns away from the camera (a fresnel rim). */
function addRimGlow(material, strength) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rimStrength = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float rimStrength;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        // (clamped: rounding can push the dot product a hair past 1, and pow() of a negative
        // number is NaN, which the bloom then smears over the whole screen as a black flash)
        float rim = pow(clamp(1.0 - abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.5);
        totalEmissiveRadiance += (emissive + diffuseColor.rgb * 0.15) * rim * rimStrength;
        diffuseColor.a = mix(diffuseColor.a, 1.0, rim);`,
      );
  };
}

export const materials = Object.fromEntries(Object.entries(theme.surfaces).map(([name, s]) => [name, build(s)]));

/** Scale every surface's inner glow (theme day/night `surfaceGlow`). */
export function applySurfaceGlow(k) {
  for (const m of Object.values(materials)) m.emissiveIntensity = m.userData.baseGlow * k;
}
