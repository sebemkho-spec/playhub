# The Playhub

A little 3D island to wander around. Walk into a portal and a card pops up.
Built with Vite, plain JavaScript, Three.js and Rapier physics.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ (Vercel, Netlify, GitHub Pages…)
```

To try it on your phone, run `npm run dev -- --host` and open the "Network" address it prints.

## Make it yours

| What | Where |
| --- | --- |
| Portal cards (title, text, image, link, socials, shape, position) | `src/data/portals.js` |
| Your rigged character | drop it at `public/models/character.glb` |
| Music + footsteps (+ optional sound effects) | `public/audio/` (see the README there) |
| Speeds, camera limits, file names, instruction text | `src/config.js` |
| Island layout (terraces, stairs, trees, rocks…) | `src/world/layout.js` |
| Day / night colours and lights | `src/world/theme.js` |
| Sky, sea, fog, fireflies: the "background" | `src/world/environment.js` |
| Card images | `public/images/portals/` (placeholders for now) |

### Portals

Each entry in `src/data/portals.js` is one portal. To add one, copy an entry,
give it a new `id`, and set `position` to a free spot (island coordinates; the
numbers in `src/world/layout.js` show where things are). Pick a `shape`:

- `gate`: marble pillars (like the original Forest Trail)
- `ring`: an upright vinyl record with floating notes
- `frame`: a gilded picture frame on a plinth
- `bubble`: a speech bubble standing on its tail
- `cloud`: a thought cloud with trailing puffs

New shapes go in `src/world/portalShapes.js` (each is one function, registered in `SHAPES`).

### Your character

Put the model at `public/models/character.glb`. Animations can be inside it
(clips named `idle`, `walk`, `run`) or in separate files: set
`character.animationFiles` in `src/config.js`. The model is scaled to 1.8 m tall
and blends smoothly between idle, walk and run.

While you're developing, a **Character check** panel (and the browser console)
says exactly what's wrong if something doesn't fit, for example:

- an animation made for a different skeleton (lists the clip's bone names next to yours)
- bone names that only differ by a prefix (`mixamorig1Hips` vs `mixamorigHips`), with the one-line fix
- clips missing, root motion baked in, centimetres vs metres, or a model facing backwards

Nothing is renamed or rotated by guesswork: you decide, with the setting it names.

Compressed models work as-is (Draco, meshopt, KTX2 textures). To shrink a model:
`npx @gltf-transform/cli optimize character.glb character.glb`

### The 3D text

The instructions over the water use `public/fonts/nunito-black.typeface.json`.
To use another font: `npm run font -- path/to/font.ttf` (writes that file).

## Controls

- **Keyboard:** WASD / arrow keys to move, hold Shift to run
- **Mouse:** drag to orbit, right-drag (or ⌘/Ctrl-drag) to pan, scroll to zoom
- **Touch:** drag anywhere to move (push further to run), pinch to zoom, two-finger drag to orbit
- Click the switches on the beach, or the buttons in the corner, for day/night and sound

## Handy while building

- Press <kbd>`</kbd> to show every physics collider as a wireframe.
- Add `?debug` to the URL for an FPS meter, the colliders and the character check on a built site.
- In dev, `window.__playhub` exposes the scene, player, camera and physics in the console
  (e.g. `__playhub.teleport(0.4, -3)` moves you next to the first gate).

## Folder structure

```
index.html            the page (loader, card, toggles, joystick)
src/
  main.js             starts everything and runs the game loop
  config.js           settings
  state.js            shared state (theme, sound, open card)
  assets.js           knows which files exist in public/
  data/portals.js     portal content
  world/              renderer, island, portals, sky/sea, switches, 3D text, camera
  character/          model + animations, animation checks, controller, keyboard input
  physics/            Rapier world and colliders
  ui/                 loading screen, card, toggles, touch controls, audio, icons, styles
public/               models, audio, images, fonts (served as-is)
scripts/              font conversion
```

## Credits

- Layout and look rebuilt from scratch after [Forest Trail](https://forest-trail.vercel.app/) by Jesse Zhou (no models or images copied).
- [three.js](https://threejs.org), [Rapier](https://rapier.rs), [postprocessing](https://github.com/pmndrs/postprocessing).
- Nunito font (SIL Open Font License), social icons from [Simple Icons](https://simpleicons.org) (CC0).
