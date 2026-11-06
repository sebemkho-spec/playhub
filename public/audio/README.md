# Sounds go here

Name the files like this and they're picked up automatically (anything missing is skipped):

| File            | What it is                                   |
| --------------- | -------------------------------------------- |
| `music.mp3`     | background music (loops)                     |
| `footsteps.mp3` | a short footsteps loop (plays while walking) |
| `portal.mp3`    | optional: a card opens                       |
| `toggle.mp3`    | optional: a switch is flipped                |
| `whoosh.mp3`    | optional: the island rises at the start      |
| `pop.mp3`       | optional: the character can start moving     |
| `unlock.mp3`    | optional: the Gallery unlocks (all eggs found) |

Different names or formats? Change the paths under `audio` in `src/config.js`.

## The ethereal theme's sounds

`ethereal/` holds the ethereal theme's own sounds: calm ambient `music.m4a`, a light
`hover.wav` that plays while you move (in place of footsteps), and `portal`, `toggle`,
`whoosh`, `pop`, `shatter` (the plain loading page breaking open) and `unlock` (the Gallery
opening once every easter egg is found). The theme points at them (and sets their volumes) in
`src/world/theme.js` → `sounds`, so they replace the files above while that theme is on.

They aren't recordings: `scripts/make-ethereal-sounds.mjs` builds them from scratch
(soft glassy chimes, airy swells, the hover and slow pad chords, all in E major so
they sound nice together), so there's nothing to license or credit. To change one,
edit its recipe in that script and run `npm run sounds` (or `npm run sounds -- unlock` for
just one). To use your own recordings
instead, put them in `ethereal/` with the same names (or change the paths in theme.js).
