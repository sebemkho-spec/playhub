/**
 * Playhub settings. Tweak numbers here rather than digging through the code.
 * Distances are in world units (roughly metres; the character is ~1.8 tall).
 */
export const CONFIG = {
  character: {
    /** Your rigged character (.glb / .gltf). Until this file exists, a capsule stands in. */
    model: '/models/character.glb',

    /**
     * Animations. Leave these null if the clips live inside the model file.
     * Or point each one at its own file (e.g. separate Mixamo downloads).
     */
    animationFiles: {
      idle: null, // e.g. '/models/animations/idle.glb'
      walk: null,
      run: null,
    },

    /** Clip names to look for inside the file(s). Case-insensitive, exact match. */
    clipNames: {
      idle: ['idle'],
      walk: ['walk', 'walking'],
      run: ['run', 'running'],
    },

    /** Scale the model so it is this tall. Set to null to keep the file's own scale. */
    height: 1.8,

    /** Extra turn (degrees) if your model doesn't face forward (+Z) in its file. */
    rotationY: 0,

    /**
     * Only used if the character check tells you to. Renames the bones that the
     * animation tracks point at, e.g. [['mixamorig:', '']]. Nothing is renamed by guesswork.
     */
    trackNameReplace: [],

    /** Remove forward drift baked into the hips of walk/run clips (if the check reports it). */
    removeRootMotion: false,

    /** Seconds to blend between idle / walk / run. */
    crossFade: 0.3,
  },

  movement: {
    walkSpeed: 3.4,
    runSpeed: 6.6,
    acceleration: 14, // how quickly you reach full speed
    turnSpeed: 12, // how quickly the character turns to face where it's going
    gravity: 28,
    maxFallSpeed: 30,
    stepHeight: 0.45, // tallest step the character can climb without stairs
    snapToGround: 0.45,
    maxSlope: 50, // degrees
    capsuleRadius: 0.34,
    capsuleHeight: 1.8,
  },

  camera: {
    fov: 45,
    distance: 24, // zoom while walking around
    openingDistance: 30, // wider shot when you arrive, before you start walking
    minDistance: 7,
    maxDistance: 44,
    polar: 47, // starting tilt, degrees from straight down
    minPolar: 16,
    maxPolar: 70, // keeps the camera above the island
    yaw: 0,
    lookHeight: 1.2, // look at this point above the character's feet
    followSharpness: 5, // higher = snappier follow
    maxPan: 8, // how far right-drag can pull the view off the character
  },

  portals: {
    triggerRadius: 1.8, // walk this close and the card opens
    exitPadding: 1.1, // walk this much further away and it closes again
  },

  /** The easter egg counter at the top ("0/3"). It counts the portals with shape 'egg'. */
  easterEggs: {
    // keep the eggs a visitor has found for their next visit (in their browser, like the
    // day/night choice); false = everyone starts from 0 every time
    remember: true,
  },

  /** Drop audio files into /public/audio/ with these names. Missing files are skipped. */
  audio: {
    music: '/audio/music.mp3',
    footsteps: '/audio/footsteps.mp3',
    // optional extras
    portal: '/audio/portal.mp3', // a card opens
    toggle: '/audio/toggle.mp3', // a switch flips
    whoosh: '/audio/whoosh.mp3', // the island rises
    pop: '/audio/pop.mp3', // the character appears
    unlock: '/audio/unlock.mp3', // the Gallery unlocks (every easter egg found)
    musicVolume: 0.35,
    footstepsVolume: 0.55,
    footstepsRunRate: 1.45, // the footsteps loop plays this much faster while running
    footstepsFadeIn: 0.04, // seconds to fade in when you start moving…
    footstepsFadeOut: 0.09, // …and out when you stop
    sfxVolume: 0.7,
  },

  /** The 3D text beside the island. " / " starts a new line. */
  instructions: {
    desktop: 'WASD to Move / Scroll to Zoom / Click and Drag to Pan',
    touch: 'Drag to Move / Pinch to Zoom / 2 Finger Drag to Pan',
  },

  render: {
    maxPixelRatio: 2,
    maxPixelRatioMobile: 1.5,
    msaa: 4,
    msaaMobile: 2,
    shadowMapSize: 2048,
    shadowMapSizeMobile: 1024,
    adaptiveResolution: true, // lowers resolution a little if the frame rate drops
  },
};
