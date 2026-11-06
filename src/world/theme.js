/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  THEMES: every colour, light, glow, fog and particle setting in the playhub.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Switch the whole look by changing this one line:
 */
export const ACTIVE_THEME = 'ethereal'; // 'island' or 'ethereal'

/*
 *  Each theme has:
 *    day / night  the two moods the day/night toggle fades between:
 *                 sky, sea, fog, the four scene lights, glow strengths, bloom
 *    surfaces     the material on everything in the world (same in both moods;
 *                 the lights are what make night look like night)
 *    shapes       what the trees, bushes, rocks and statues look like (only the look:
 *                 every object keeps its place, and what you bump into stays the same)
 *    effects      fog distance, bloom shape, the floating lights (fireflies or orbs)
 *    portals      each portal's glow colour, plus the trims around them
 *    props        switches, 3D text, the stand-in capsule character
 *    page         the HTML around the 3D view (loader, buttons, card, joystick)
 *    sounds       (optional) the theme's own sound files, in place of the ones in config.js
 *
 *  Colours are hex codes (rgba() for see-through page colours). Light strengths
 *  are three.js physical units, the same numbers the original Forest Trail used.
 *
 *  This file is plain data with no imports, so the dev server can also read it
 *  to colour the page before any JavaScript runs.
 */

const island = {
  defaultMood: 'day', // what a first visit opens in: 'day' or 'night' (after that the toggle remembers each visitor's choice)

  day: {
    skyTop: '#22b8ff',
    skyHorizon: '#a6ecff',
    skyGlow: { color: '#ffffff', strength: 0 }, // a band of light along the horizon (0 = off)
    sea: '#00c6ff',
    fog: '#a6ecff', // same as the horizon so the sea melts into the sky
    ambient: { color: '#ffffff', intensity: 0.5 },
    sun: { color: '#ff9900', intensity: 1.5 }, // warm key light, casts the shadows
    fill: { color: '#00ecff', intensity: 0.5 },
    back: { color: '#ff8800', intensity: 30 }, // warm glow from behind the island
    portalLight: 6, // light each portal throws on its surroundings
    portalLightActive: 50, // ...while its card is open
    portalGlow: 1, // brightness of the swirling portal surfaces
    switchLamps: 0, // little lights over the switches on the beach
    floatingLights: 0, // the fireflies (or light orbs): 0 = hidden, 1 = fully visible
    stars: 0,
    exposure: 1.7, // overall brightness
    bloom: 0.9, // glow strength around bright things
    textGlow: 0, // the 3D instructions lighting up
    surfaceGlow: 1, // multiplies every surface's own glow (emissive) below
    characterGlow: 1, // how brightly a 'soul' capsule glows (see props.placeholderStyle)
    mist: { color: '#ffffff', opacity: 0 }, // wisps drifting over the sea (0 = off)
  },

  night: {
    skyTop: '#030716',
    skyHorizon: '#122650',
    skyGlow: { color: '#ffffff', strength: 0 },
    sea: '#0b2a63',
    fog: '#122650',
    ambient: { color: '#8ea6ff', intensity: 0.42 },
    sun: { color: '#a9c1ff', intensity: 0.42 }, // moonlight
    fill: { color: '#5a6cff', intensity: 0.22 },
    back: { color: '#7a4dff', intensity: 14 },
    portalLight: 14,
    portalLightActive: 70,
    portalGlow: 1.55,
    switchLamps: 2.2,
    floatingLights: 1,
    stars: 1,
    exposure: 1.55,
    bloom: 1.35,
    textGlow: 0.35,
    surfaceGlow: 1,
    characterGlow: 1,
    mist: { color: '#ffffff', opacity: 0 },
  },

  surfaces: {
    lightGrass: { color: '#789a3d', roughness: 1 }, // top two terraces
    lightDirt: { color: '#825d31', roughness: 0.5 },
    darkGrass: { color: '#376c28', roughness: 1 }, // lower two terraces
    darkDirt: { color: '#694a27', roughness: 0.5 },
    treeLeaves: { color: '#347d3f', roughness: 0.8, flatShading: true },
    treeGlow: { color: '#fff4c8', roughness: 0.4, emissive: '#ffd66b', emissiveIntensity: 1 }, // the orb on 'helix' trees
    wood: { color: '#71482c', roughness: 1, flatShading: true }, // tree trunks
    lightBushes: { color: '#a3ab3b', roughness: 0.5, flatShading: true },
    darkBushes: { color: '#5aab61', roughness: 0.5, flatShading: true },
    rock: { color: '#737373', roughness: 1 },
    steps: { color: '#b3a280', roughness: 0.5 }, // flat stepping stones
    marble: { color: '#e6e7d6', roughness: 0.5 }, // stairs, gate, plinths, switch cases
    stone: { color: '#aeaf9a', roughness: 1 }, // the blocky statues
    sand: { color: '#ceb68e', roughness: 1 },
    cliff: { color: '#6f5235', roughness: 0.9, flatShading: true }, // the island's edge
    vinyl: { color: '#15131c', roughness: 0.28 }, // Music portal record
    vinylGroove: { color: '#2a2635', roughness: 0.4 },
    gold: { color: '#e7b84f', roughness: 0.38, metalness: 0.35 }, // Gallery frame
    cloud: { color: '#ffffff', roughness: 0.85 }, // Thoughts portal
    bubble: { color: '#fffaf0', roughness: 0.6 }, // speech bubble portal
  },

  shapes: {
    trees: 'pine', // 'pine' = cone on a trunk · 'helix' = soft twisting double helix holding a glowing orb
    bushes: 'ball', // 'ball' = low-poly ball · 'puff' = soft cluster of spheres
    // helix size next to the pine it replaces, how many times it twists (taller ones twist a
    // little more), and how much narrower it is at the top
    helix: { height: 1, width: 0.55, turns: 1.6, taper: 0.7 },
    // How rounded the edges are (0 = sharp boxes, like the original).
    //   terraces, stairs:         corner radius in island units
    //   rocks, stones, statues:   0 = sharp … 1 = as round as they can get
    rounding: { terraces: 0, stairs: 0, rocks: 0, stones: 0, statues: 0 },
  },

  effects: {
    fogNear: 70, // fog starts this far from the camera…
    fogFar: 230, // …and is solid by here
    bloomThreshold: 0.9, // how bright something must be to glow
    bloomSmoothing: 0.03,
    bloomRadius: 0.8, // how far the glow spreads
    // What the floating lights look like (day/night above set how visible they are)
    floatingLights: {
      style: 'fireflies', // 'fireflies' = small blinking specks · 'orbs' = soft glowing orbs slowly floating up
      count: 110, // phones get a little over half
      colors: ['#ffe58a'], // each light picks one of these in turn
      size: 9, // fireflies: glow size on screen · orbs: how wide each orb is, in world units
      speed: 1, // 2 = twice as fast
      rise: 6, // orbs only: how high they float before fading out
    },
    mistScale: 0.045, // size of the mist wisps (smaller = bigger wisps)
    mistSpeed: 0.03, // how fast they drift
    mistShore: 15, // mist is thickest this far from the island's middle…
    mistReach: 70, // …and thins out by here
  },

  portals: {
    colors: {
      about: '#3ff3ff',
      music: '#c77dff',
      gallery: '#ffc94d',
      joking: '#ff8a5c',
      thoughts: '#8fd8ff',
      easterEgg: '#ffd36e',
      easterEgg2: '#ffd36e',
      easterEgg3: '#ffd36e',
    },
    defaultColor: '#3ff3ff', // for new portals not listed above
    glow: 0.95, // surface brightness (multiplied by portalGlow above)
    ringRimGlow: 2.2, // the glowing label rim on the record
    noteGlow: 1.8, // floating music notes
    bubbleText: '#fffaf0', // the "?!" in the speech bubble
    bubbleTextGlow: 1.6,
    frameLipShade: 0.72, // the gallery frame's inner lip, as a fraction of the gold
    // the easter egg (shape 'egg'): its shell; its paint (the wide band, the wavy ribbons, the dots
    // on the band, the dots near the tip); how much the paint and the shell glow; a glow around its
    // edges (0 = none); the sparkles drifting off it; how strongly it lights the sand around it
    egg: {
      shell: '#fff6e0',
      paint: ['#ff6fa8', '#36c9c0', '#ffd04a', '#8a6cff'],
      roughness: 0.45,
      paintGlow: 0.3,
      shellGlow: 0.04,
      rim: 0,
      sparkle: '#fff1b8',
      sparkleGlow: 1.6,
      light: 0.12,
    },
    // a locked portal (one with `locked` in src/data/portals.js: the Gallery until every easter egg
    // is found): how much of its colour is left (0 = grey) and how much darker it is, how much of
    // its glow and light remain, the padlock floating on it, and the burst of light as it unlocks
    locked: { saturation: 0.07, lightness: 0.8, glow: 0.32, light: 0.12 },
    padlock: { body: '#bfc8e6', shackle: '#e6e8f0', keyhole: '#24264a', glow: 0.12 },
    unlock: { color: '#ffd36e', glow: 2.2, sparkles: 70, beam: 13 },
  },

  props: {
    switchBall: ['#fffaf0', '#efe3cf', '#b9c9c2', '#3c8f8f'], // pearly ball, centre → edge
    switchTrack: '#4b5d63',
    switchIcon: '#ffffff',
    switchIconOpacity: 0.5,
    switchLamp: '#ffffff',
    text3d: '#ffffff', // the floating instructions
    placeholderBody: '#f7f2ea', // the capsule that stands in for your character
    placeholderEyes: '#1d2433',
    placeholderBlush: '#ffb3a7',
    // 'solid' = a plain matte capsule · 'soul' = see-through and softly glowing, with a halo
    placeholderStyle: 'solid',
    // the 'soul' look: colour from feet (bottom) to head (top), the shimmer of colour around
    // its edges, how see-through it is (1 = solid) and how strong its halo is
    soul: { bottom: '#2fd2c6', top: '#e2ffb4', shimmer: ['#ff8fe0', '#ffe98a', '#8fb8ff'], opacity: 0.8, halo: 0.55 },
  },

  page: {
    loader: {
      // 'blocks' = this teal screen with the little dirt blocks and a Start button
      // 'plain'  = a deliberately boring black-and-white HTML page; click "the playhub" and it
      //            glitches, cracks and shatters to reveal the world
      style: 'blocks',
      background: '#20a4ad', // also the browser's tab-bar colour on phones
      text: '#ffffff',
      textShadow: 'rgba(0, 0, 0, 0.3)', // behind "Start"
      block: '#82644b', // the little dirt blocks
      blockTop: '#4c9a2a', // the grass row
      // the 'plain' page: default-HTML white, black and link blue, plus the two colours that
      // flicker through it as it glitches
      plain: { paper: '#ffffff', ink: '#000000', link: '#0000ee', glitch: ['#ff4fd8', '#3ff3ff'] },
    },
    background: { day: '#00c6ff', night: '#071b3a' }, // shows behind the 3D view while it loads
    buttons: {
      day: { background: 'rgba(255, 255, 255, 0.8)', icon: '#2c4b55', ring: 'rgba(255, 255, 255, 0.95)', shadow: '0 6px 20px rgba(0, 60, 80, 0.2)' },
      night: { background: 'rgba(16, 24, 52, 0.72)', icon: '#dbe5ff', ring: 'rgba(150, 175, 255, 0.35)', shadow: '0 6px 22px rgba(0, 0, 0, 0.45)' },
    },
    // the easter egg counter at the top (it otherwise looks like the buttons): the colour an egg
    // flashes when one is found (and stays once all are), and the glow around it
    eggs: { found: '#ffc23d', glow: 'rgba(255, 194, 61, 0.55)' },
    card: {
      background: '#ffffff',
      text: '#454545',
      shadow: 'rgba(0, 0, 0, 0.3)',
      imageShadow: 'rgba(0, 0, 0, 0.16)',
      close: '#cacaca', // the grey "close" button
      accent: '#00aab0', // "Learn More", links, icon hover, focus rings
      accentText: '#ffffff',
      closeX: 'rgba(255, 255, 255, 0.92)', // the round × above the card
      closeXShadow: 'rgba(0, 0, 0, 0.18)',
      closeXFlat: '#f1f1f1', // the × inside the card on short screens
    },
    joystick: {
      ring: 'rgba(255, 255, 255, 0.6)',
      fill: 'rgba(255, 255, 255, 0.14)',
      knob: 'rgba(255, 255, 255, 0.88)',
      knobShadow: 'rgba(0, 0, 0, 0.2)',
      running: '#ffd75e', // knob colour while running
    },
  },
};

/**
 * The dreamlike look: the inside of a mind. Built up in stages; anything not
 * listed here is borrowed from the island.
 *   stage 1 ✓ sky, sea, fog, light, bloom
 *   stage 2 ✓ ground and surfaces (glowing teal ground, violet walls, pearly marble), sea mist
 *   stage 3 ✓ shapes (glassy helix trees, glowing puffs, soft rounded rocks, terraces and statues)
 *   stage 4 ✓ slow floating light orbs in place of the fireflies, by day and (brighter) by night
 *   extra   ✓ the stand-in capsule as a see-through, glowing little soul
 *   extra   ✓ its own sound effects (chimes, swells, soft footsteps)
 */
const ethereal = derive(island, {
  defaultMood: 'night', // opens in the deep-indigo night
  // Day: a dusky lavender dreamscape
  day: {
    skyTop: '#6468d2', // periwinkle overhead…
    skyHorizon: '#d497d6', // …melting into pink-lavender
    skyGlow: { color: '#ffc4ea', strength: 0.18 },
    sea: '#6660b8', // the dusky violet "base" the island floats on
    fog: '#d497d6', // distant haze: exactly the horizon colour, so sea and sky meet seamlessly
    ambient: { color: '#c9bcff', intensity: 0.95 }, // soft, shadowless lavender light
    sun: { color: '#ffc6e6', intensity: 1.15 }, // gentle pink key light
    fill: { color: '#6ff2ff', intensity: 0.55 }, // teal from the front
    back: { color: '#ff7fd9', intensity: 26 }, // magenta rim from behind
    portalLight: 8,
    portalLightActive: 55,
    portalGlow: 1.15,
    switchLamps: 0.5,
    floatingLights: 0.7, // the orbs drift by day too, just softer
    stars: 0.25,
    exposure: 1.45,
    bloom: 1.15,
    textGlow: 0.12,
    surfaceGlow: 1,
    characterGlow: 1,
    mist: { color: '#f2c4ee', opacity: 0.3 }, // pale pink-lavender wisps
  },
  // Night: deep indigo, everything glows more
  night: {
    skyTop: '#07061f',
    skyHorizon: '#3a2378',
    skyGlow: { color: '#a05cff', strength: 0.3 },
    sea: '#171459',
    fog: '#3a2378',
    ambient: { color: '#7d6dff', intensity: 0.6 },
    sun: { color: '#b4a6ff', intensity: 0.5 },
    fill: { color: '#35e3ff', intensity: 0.4 },
    back: { color: '#b84dff', intensity: 18 },
    portalLight: 18,
    portalLightActive: 80,
    portalGlow: 1.75,
    switchLamps: 2.6,
    floatingLights: 1,
    exposure: 1.4,
    bloom: 1.75,
    textGlow: 0.45,
    surfaceGlow: 0.8, // the ground glows softly in the dark (the portals and stones carry the light)
    characterGlow: 1.3, // the little soul shines brighter at night
    mist: { color: '#6c4fd6', opacity: 0.45 }, // violet wisps
  },
  surfaces: {
    // the walkable ground: glowing teal, brighter on the higher terraces
    lightGrass: { color: '#4fd8c8', roughness: 0.9, emissive: '#12c9bd', emissiveIntensity: 0.42 },
    darkGrass: { color: '#2bbab8', roughness: 0.9, emissive: '#0eaebd', emissiveIntensity: 0.42 },
    sand: { color: '#3aa9bd', roughness: 1, emissive: '#0fa3bf', emissiveIntensity: 0.38 },
    // terrace walls and the island's edge: soft periwinkle into deep violet
    lightDirt: { color: '#8e80e8', roughness: 0.8 },
    darkDirt: { color: '#7a69dc', roughness: 0.8 },
    cliff: { color: '#4e3cae', roughness: 0.9 },
    // pearly stairs, gates, plinths and switch cases
    marble: { color: '#f3eeff', roughness: 0.45, emissive: '#d9cdff', emissiveIntensity: 0.12 },
    // the stepping-stone trail glows like a path of lights
    steps: { color: '#ffc2ef', roughness: 0.6, emissive: '#ff8fdc', emissiveIntensity: 0.55 },
    rock: { color: '#8b84d3', roughness: 0.95 },
    stone: { color: '#d4ccf7', roughness: 0.6, emissive: '#b9a8ff', emissiveIntensity: 0.12 }, // statues
    // soft glassy double helixes in place of the pines: see-through, glowing at the edges
    treeLeaves: { color: '#b9a4ff', roughness: 0.3, flatShading: false, opacity: 0.8, rim: 1.6, emissive: '#8a62ff', emissiveIntensity: 0.32 },
    treeGlow: { color: '#fff0fb', roughness: 0.35, emissive: '#ff9fe8', emissiveIntensity: 1.7 }, // the orb each helix holds
    // the bushes become softly glowing puffs
    lightBushes: { color: '#ffb7ea', roughness: 0.75, flatShading: false, emissive: '#ff7fd6', emissiveIntensity: 0.4 },
    darkBushes: { color: '#c3b0ff', roughness: 0.75, flatShading: false, emissive: '#9a7bff', emissiveIntensity: 0.4 },
  },
  shapes: {
    trees: 'helix',
    bushes: 'puff',
    rounding: { terraces: 0.16, stairs: 0.05, rocks: 0.75, stones: 0.7, statues: 0.85 },
  },
  portals: {
    colors: { easterEgg: '#ff9fe8', easterEgg2: '#ff9fe8', easterEgg3: '#ff9fe8' },
    // a pearly egg with glowing pastel paint, softly lit from inside
    egg: {
      shell: '#f6efff',
      paint: ['#ff4fc8', '#29d9ee', '#ffcf5a', '#9c6bff'],
      roughness: 0.3,
      paintGlow: 0.75,
      shellGlow: 0.15,
      rim: 0.7,
      sparkle: '#ffffff',
      sparkleGlow: 2.2,
      light: 0.12,
    },
    padlock: { glow: 0.3 }, // (a touch of glow, so it reads in the dusk too)
  },
  props: {
    // the stand-in capsule becomes a little glowing soul: see-through, minty, shimmering
    placeholderStyle: 'soul',
    placeholderEyes: '#2a2d66', // deep indigo
    placeholderBlush: '#ffb08f', // peach
  },
  page: {
    // arrives as a boring HTML page (like the home page it's linked from) that breaks open
    loader: { style: 'plain', background: '#ffffff' },
    eggs: { found: '#ff9fe8', glow: 'rgba(255, 159, 232, 0.6)' }, // the eggs' pink
  },
  // its own sounds: soft glassy chimes, airy swells, a light hover while moving and calm ambient
  // music, all made by scripts/make-ethereal-sounds.mjs (`npm run sounds` re-makes them)
  sounds: {
    music: '/audio/ethereal/music.m4a', // slow, soft pads: no beat, no tune to follow
    footsteps: '/audio/ethereal/hover.wav', // a light hover while moving (a soul floats, it doesn't step)
    portal: '/audio/ethereal/portal.m4a',
    toggle: '/audio/ethereal/toggle.m4a',
    whoosh: '/audio/ethereal/whoosh.m4a',
    pop: '/audio/ethereal/pop.m4a',
    shatter: '/audio/ethereal/shatter.m4a', // the plain loading page cracking and breaking open
    unlock: '/audio/ethereal/unlock.m4a', // the Gallery opening, once every easter egg is found
    musicVolume: 0.3,
    footstepsVolume: 0.2, // just a breath, under everything else
    footstepsRunRate: 1.12, // hovers a little brighter when running
    footstepsFadeIn: 0.25, // eases in and out rather than snapping on and off
    footstepsFadeOut: 0.45,
  },
  effects: {
    fogNear: 24, // haze starts closer, so the far sea glows like a horizon
    fogFar: 120,
    bloomThreshold: 0.72, // more things glow…
    bloomSmoothing: 0.22, // …and the glow fades in softly
    bloomRadius: 0.9,
    mistScale: 0.035,
    floatingLights: {
      style: 'orbs',
      count: 30,
      colors: ['#ff9fe8', '#8ff4ff', '#c9b1ff', '#ffe2a8'], // pink, aqua, lavender, a little warm gold
      size: 0.75, // world units (they also keep clear of walls by about this much more)
    },
  },
});

export const THEMES = { island, ethereal };

if (!THEMES[ACTIVE_THEME]) {
  console.warn(`[playhub] Unknown theme "${ACTIVE_THEME}" in src/world/theme.js. Options: ${Object.keys(THEMES).join(', ')}. Using "island".`);
}

/** The theme in use. */
export const theme = THEMES[ACTIVE_THEME] ?? island;

/** A copy of `base` with `changes` laid over it (nested objects are merged, lists replaced). */
function derive(base, changes) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(changes)) {
    const isObject = value && typeof value === 'object' && !Array.isArray(value);
    out[key] = isObject && base[key] && typeof base[key] === 'object' ? derive(base[key], value) : value;
  }
  return structuredCopy(out);
}

function structuredCopy(value) {
  if (Array.isArray(value)) return value.map(structuredCopy);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, structuredCopy(v)]));
  return value;
}
