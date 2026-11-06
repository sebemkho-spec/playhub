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
| **Every colour, light, glow, fog and particle setting, the shapes of trees, bushes and rocks, and which theme is on** | `src/world/theme.js` |
| What the sky, sea and floating lights (fireflies or orbs) are made of (not their colours) | `src/world/environment.js` |
| Card images | `public/images/portals/` (placeholders for now) |
| The Music card's photo, screenshot, songs and clip | `public/music/` |
| The stories card's photo | `public/stories/` |
| The Gallery's pictures | `public/gallery/` |

### Themes

All of the look lives in `src/world/theme.js`. Switch the whole thing with one line:

```js
export const ACTIVE_THEME = 'island'; // or 'ethereal'
```

Each theme has `defaultMood` (whether a first visit opens in day or night; after
that the toggle remembers the visitor's choice), `day` and `night` (what the
day/night toggle fades between),
`surfaces` (every material), `shapes` (pine trees or glassy helixes, bushes or puffs,
and how rounded the terraces, stairs, rocks, stones and statues are),
`effects` (fog, bloom, the floating lights), `portals` (glow colour per portal), `props`
(switches, 3D text, the stand-in capsule) and `page` (loading screen, buttons,
card, joystick). The `ethereal` theme starts as a copy of `island` and only
lists what it changes. Shapes only change the look: every object keeps its
place, and what you bump into is the same in every theme.

The loading screen comes in two styles (`page.loader.style`): `blocks` (the
island's teal screen with a Start button) and `plain` (the ethereal theme's).
`plain` arrives as a deliberately boring black-and-white HTML page, like the
home page that links to it; once loaded, "the playhub" turns into a link, and
clicking it glitches, cracks and shatters the page to reveal the world
(`src/ui/shatter.js`).

### Portals

Each entry in `src/data/portals.js` is one portal. To add one, copy an entry,
give it a new `id`, and set `position` to a free spot (island coordinates; the
numbers in `src/world/layout.js` show where things are). Pick a `shape`:

- `gate`: marble pillars (like the original Forest Trail)
- `ring`: an upright vinyl record with floating notes
- `frame`: a gilded picture frame on a plinth
- `bubble`: a speech bubble standing on its tail
- `cloud`: a thought cloud with trailing puffs
- `egg`: a small glowing painted egg in a ring of puffs (the three easter eggs: behind the
  summit, in the nook between the tallest helix and the big round rock, and behind the big rock
  beside the gallery terrace; their paint colours are `portals.egg` in `src/world/theme.js`).
  To hide another, copy an egg entry, give it a new `id`, a free spot and its own glow colour
  in `portals.colors`.

The counter at the top ("0/3") counts every portal with shape `egg`, so a new egg makes it
"0/4" by itself. An egg counts the first time its card opens. Each visitor's finds are kept in
their browser (like the day/night choice); set `easterEggs.remember` to `false` in
`src/config.js` to start everyone from 0 every visit. To see it from 0 again yourself, run
`__playhub.eggs.reset()` in the browser console (in dev).

The Gallery stays locked until a visitor has found every egg. Its card shows its `locked`
version (`src/data/portals.js`) and the frame is dull grey with a padlock floating in front.
When the last egg's card closes, the padlock springs open, a beam of light shoots up from the
gallery with a shower of sparkles (and the `unlock` sound), and it turns gold again. Any portal
can be locked like this: give it `locked: { title, body }`. The look is in `src/world/theme.js`
→ `portals.locked`, `padlock` and `unlock`.

Give a card `layout: 'quote'` to centre it with a bigger title and text, for a card
that's just a quote (the easter eggs' cards work like this), or `layout: 'note'` for a few
bold lines where the title reads as the first of them (the "Welcome traveler." card).
`layout: 'return'` is the Thoughts cloud's "Return?" card: a "Home" link styled like the plain
home page's own links (the browser's serif, underlined, link blue), then Instagram and email.
"Home" goes to `/`, the front page of the site the playhub is on; if your home page lives at
another address, change that one `href` in `src/data/portals.js`. An email icon (on any card)
opens the visitor's mail app where there is one, and also copies the address and shows it under
the icons, since many people have no mail app set up.

A card whose contents don't fit scrolls inside the card. The Music card (`layout: 'music'`)
and the "Surely You're Joking, Mr Seb!" stories card (`layout: 'stories'`) keep the sizes they
have always had and scroll. The Music card's photo, screenshot, songs and clip live in
`public/music/`; the stories card's photo in `public/stories/`. Any card can play songs and clips:

```html
<button data-track="/music/mix1.mp3">mix 1</button>
<video data-clip src="/music/messup.mp4" poster="/music/messup.jpg"></video>
```

They play with sound (even when the island's sound is off, since pressing play asks for it),
one at a time. While one plays, every island sound (ambience, hover, effects) goes quiet, and
it fades back in when it ends, is paused, or the card closes (which stops it).

The Gallery card (once unlocked, `layout: 'gallery'`) is a scrolling collage of the pictures in
`public/gallery/`. Each `<div class="g-row">` in its text is one row: its pictures share the
width and line up at the same height, so a text-heavy picture gets a row to itself (readable even
on a phone) and pictures without much text sit two to a row. To add one, copy an `<img>` line
with the new file's name and its pixel `width` and `height`. Tap any picture to see it big
(Escape or a tap closes it). The pictures only download as someone scrolls to them.

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
  ui/                 loading screen, card, toggles, egg counter, touch controls, audio, icons, styles
public/               models, audio, images, fonts (served as-is)
scripts/              font conversion
```

## Credits

- Layout and look rebuilt from scratch after [Forest Trail](https://forest-trail.vercel.app/) by Jesse Zhou (no models or images copied).
- [three.js](https://threejs.org), [Rapier](https://rapier.rs), [postprocessing](https://github.com/pmndrs/postprocessing).
- Nunito font (SIL Open Font License), social icons from [Simple Icons](https://simpleicons.org) (CC0).
