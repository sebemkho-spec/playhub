import * as THREE from 'three';

/**
 * Checks that animation clips actually fit the character's skeleton.
 * Every problem comes back as a plain-English message plus, where possible,
 * the exact setting that would fix it. Nothing is renamed or remapped unless
 * you turn that setting on yourself.
 */

const list = (names, n = 3) =>
  names.slice(0, n).map((s) => `"${s}"`).join(', ') + (names.length > n ? ` and ${names.length - n} more` : '');

function commonSuffix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return a.slice(a.length - i);
}

export function describeRig(model) {
  const bones = [];
  const nodes = new Set();
  let skinned = 0;
  model.traverse((o) => {
    if (o.name) nodes.add(o.name);
    if (o.isBone) bones.push(o);
    if (o.isSkinnedMesh) skinned++;
  });
  return { bones, boneNames: bones.map((b) => b.name), nodes, skinned };
}

/** Look for a consistent rename (e.g. "mixamorig1Hips" → "mixamorigHips") that explains the mismatch. */
function findRename(missing, boneNames, nodes) {
  if (!missing.length || !boneNames.length) return null;
  let best = null;
  const probes = missing.slice(0, 4);
  for (const m of probes) {
    for (const b of boneNames) {
      const suffix = commonSuffix(m, b);
      if (suffix.length < 3) continue;
      const from = m.slice(0, m.length - suffix.length);
      const to = b.slice(0, b.length - suffix.length);
      if (from === to) continue;
      let hits = 0;
      for (const name of missing) {
        if (name.startsWith(from) && nodes.has(to + name.slice(from.length))) hits++;
      }
      const ratio = hits / missing.length;
      if (!best || ratio > best.ratio) best = { from, to, ratio };
    }
  }
  return best && best.ratio >= 0.6 ? best : null;
}

/** Apply the user's explicit trackNameReplace rules to a clip (returns a renamed copy). */
export function renameTracks(clip, rules) {
  if (!rules?.length) return clip;
  const copy = clip.clone();
  for (const track of copy.tracks) {
    const { nodeName } = THREE.PropertyBinding.parseTrackName(track.name);
    let renamed = nodeName;
    for (const [from, to] of rules) {
      renamed = from instanceof RegExp ? renamed.replace(from, to) : renamed.split(from).join(to);
    }
    if (renamed !== nodeName) track.name = renamed + track.name.slice(nodeName.length);
  }
  return copy;
}

function findRootPositionTrack(clip, nodes) {
  const positions = clip.tracks.filter((t) => t.name.endsWith('.position'));
  if (!positions.length) return null;
  const byName = positions.find((t) => /hips|pelvis|root/i.test(THREE.PropertyBinding.parseTrackName(t.name).nodeName));
  return byName ?? positions.find((t) => nodes.has(THREE.PropertyBinding.parseTrackName(t.name).nodeName)) ?? positions[0];
}

/** Remove the forward drift baked into a walk/run clip's hips (only when the user asks for it). */
export function stripRootMotion(clip) {
  const track = findRootPositionTrack(clip, new Set());
  if (!track) return clip;
  const v = track.values;
  const n = track.times.length;
  if (n < 2) return clip;
  const d = [v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 1] - v[1], v[(n - 1) * 3 + 2] - v[2]];
  const duration = track.times[n - 1] - track.times[0] || 1;
  for (let i = 0; i < n; i++) {
    const k = (track.times[i] - track.times[0]) / duration;
    v[i * 3] -= d[0] * k;
    v[i * 3 + 1] -= d[1] * k;
    v[i * 3 + 2] -= d[2] * k;
  }
  return clip;
}

/**
 * @returns {{ usable: boolean, matched: number, total: number, issues: {level: 'error'|'warning', text: string, fix?: string}[] }}
 */
export function checkClip(clip, rig, state) {
  const issues = [];
  const total = clip.tracks.length;
  if (!total) {
    issues.push({ level: 'error', text: `The "${state}" clip "${clip.name}" has no animation tracks in it.` });
    return { usable: false, matched: 0, total, issues };
  }

  const missing = new Set();
  let matched = 0;
  for (const track of clip.tracks) {
    const { nodeName } = THREE.PropertyBinding.parseTrackName(track.name);
    if (rig.nodes.has(nodeName)) matched++;
    else missing.add(nodeName);
  }
  const missingNames = [...missing];
  const ratio = matched / total;

  if (ratio === 0) {
    const rename = findRename(missingNames, rig.boneNames, rig.nodes);
    issues.push({
      level: 'error',
      text:
        `The "${state}" animation doesn't fit this character's skeleton: none of its ${total} tracks point at a bone the model has. ` +
        `The clip animates bones named ${list(missingNames)}, but the character's bones are named ${list(rig.boneNames)}.`,
      fix: rename
        ? `The names only differ by a prefix. If this is the same rig, set character.trackNameReplace to [['${rename.from}', '${rename.to}']] in src/config.js.`
        : 'This clip was probably made for a different skeleton. Re-export the animation from the same rig as the character (in Mixamo, download it with the same character selected).',
    });
    return { usable: false, matched, total, issues };
  }

  if (ratio < 0.9) {
    issues.push({
      level: 'warning',
      text: `The "${state}" animation only partly fits: ${missing.size} of the bones it animates aren't in the character (${list(missingNames)}). Those parts won't move.`,
      fix: 'Usually this means the animation came from a slightly different version of the rig (extra finger or twist bones). Re-export both from the same source to be sure.',
    });
  }

  const rootTrack = findRootPositionTrack(clip, rig.nodes);
  if (rootTrack) {
    const nodeName = THREE.PropertyBinding.parseTrackName(rootTrack.name).nodeName;
    const bone = rig.bones.find((b) => b.name === nodeName);
    const rest = bone ? bone.position.length() : 0;
    const v = rootTrack.values;
    const n = rootTrack.times.length;
    if (rest > 1e-4 && n > 1) {
      let avg = 0;
      for (let i = 0; i < n; i++) avg += Math.hypot(v[i * 3], v[i * 3 + 1], v[i * 3 + 2]);
      avg /= n;
      const scale = avg / rest;
      if (scale > 8 || scale < 1 / 8) {
        issues.push({
          level: 'error',
          text: `The "${state}" animation moves the hips at about ${scale > 1 ? Math.round(scale) + '×' : '1/' + Math.round(1 / scale)} the character's scale, so the body will fly off or collapse. The animation and the model were exported in different units (centimetres vs metres).`,
          fix: 'Export the model and animations with the same unit scale (in Blender: Apply All Transforms on the armature, then export glTF).',
        });
      }
      const drift = Math.hypot(v[(n - 1) * 3] - v[0], v[(n - 1) * 3 + 1] - v[1], v[(n - 1) * 3 + 2] - v[2]);
      if (state !== 'idle' && drift > rest * 0.35) {
        issues.push({
          level: 'warning',
          text: `The "${state}" animation walks forward on its own (root motion): the hips travel about ${(drift / rest).toFixed(1)}× hip height per loop, so the character will slide back every cycle.`,
          fix: 'Re-download it from Mixamo with "In Place" ticked, or set character.removeRootMotion = true in src/config.js.',
        });
      }
    }
  }

  return { usable: true, matched, total, issues };
}
