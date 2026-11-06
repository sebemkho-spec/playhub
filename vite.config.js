import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

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

/**
 * Writes the active theme's page colours (src/world/theme.js → page) into
 * index.html as CSS variables, so the loading screen is the right colour from
 * the very first frame, before any JavaScript has loaded.
 */
function themePageColors() {
  let root = '';
  // re-read on every request in dev, so editing theme.js shows up on reload
  const fresh = (file) => import(`${pathToFileURL(path.join(root, file)).href}?t=${Date.now()}`);
  return {
    name: 'playhub-theme-page',
    configResolved(config) {
      root = config.root;
    },
    async transformIndexHtml(html) {
      const [{ theme }, { pageThemeCss }] = await Promise.all([fresh('src/world/theme.js'), fresh('src/ui/pageTheme.js')]);
      return {
        html: html
          .replace(/(<meta name="theme-color" content=")[^"]*(")/, `$1${theme.page.loader.background}$2`)
          .replace(/(<html[^>]*data-theme=")[^"]*(")/, `$1${theme.defaultMood === 'night' ? 'dark' : 'light'}$2`)
          .replace(/(<html[^>]*data-loader-style=")[^"]*(")/, `$1${theme.page.loader.style}$2`),
        tags: [{ tag: 'style', attrs: { id: 'theme-page-colors' }, children: pageThemeCss(theme.page), injectTo: 'head' }],
      };
    },
  };
}

export default defineConfig({
  // 'mpa' = a missing file returns 404 instead of index.html
  appType: 'mpa',
  plugins: [publicManifest(), themePageColors()],
  server: { port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4600, // the Rapier chunk inlines its WebAssembly (~4.3 MB, ~1.5 MB gzipped)
  },
});
