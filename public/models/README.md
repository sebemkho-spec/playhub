# Character goes here

Drop your rigged character here as **`character.glb`** and refresh. Until then a capsule stands in.

- Animations can live inside `character.glb` (clips named `idle`, `walk`, `run`),
  or in separate files, for example `public/models/animations/walk.glb`. Point
  `character.animationFiles` in `src/config.js` at them.
- Compressed models work as-is: Draco, meshopt and KTX2 textures are all supported.
  To shrink a model: `npx @gltf-transform/cli optimize character.glb character.glb`
- If the animations don't fit the skeleton, a "Character check" panel in the
  corner (and the browser console) says exactly what's wrong and how to fix it.
