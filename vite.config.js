import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Lists every file in /public as `virtual:playhub-assets`, so the app knows
 * whether your character / music / footsteps exist before asking for them.
 * In dev, adding, replacing or removing a file reloads the page.
 */
const VIRTUAL_ID = 'virtual:playhub-assets';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

function listFiles(dir, prefix = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const rel = `${prefix}/${entry.name}`;
    return entry.isDirectory() ? listFiles(path.join(dir, entry.name), rel) : [rel];
  });
}

function publicManifest() {
  let publicDir = '';
  return {
    name: 'playhub-public-manifest',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id) {
      if (id === RESOLVED_ID) return `export default ${JSON.stringify(listFiles(publicDir))};`;
      return null;
    },
    configureServer(server) {
      const changed = (file) => {
        if (!path.resolve(file).startsWith(path.resolve(publicDir))) return;
        const graph = server.environments?.client?.moduleGraph ?? server.moduleGraph;
        const mod = graph?.getModuleById(RESOLVED_ID);
        if (mod) graph.invalidateModule(mod);
        server.ws.send({ type: 'full-reload' });
      };
      server.watcher.add(publicDir);
      server.watcher.on('add', changed);
      server.watcher.on('unlink', changed);
      server.watcher.on('change', changed); // e.g. you replaced character.glb
    },
  };
}

export default defineConfig({
  // 'mpa' = a missing file returns 404 instead of index.html
  appType: 'mpa',
  plugins: [publicManifest()],
  server: { port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4600, // the Rapier chunk inlines its WebAssembly (~4.3 MB, ~1.5 MB gzipped)
  },
});
