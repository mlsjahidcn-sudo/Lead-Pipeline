// Bundle the Bun-runtime API into a single Node-22-runnable `server.js`.
// Hostinger's Node application builder expects this file at the repo root.
//
// - Uses esbuild (already a devDependency) for speed and ESM/TS support.
// - Keeps node_modules external so npm install on the host can resolve them.
// - Preserves the API's `import.meta.url`-based paths to dist/ for SPA serving.

import { build } from 'esbuild';

await build({
  entryPoints: ['server/index.ts'],
  outfile: 'server.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  resolveExtensions: ['.ts', '.js', '.mjs', '.cjs'],
  // The SPA bundle is expected at <repo>/dist. server/index.ts resolves it
  // relative to import.meta.url, which points to this server.js at the
  // repo root when Hostinger runs it with `node server.js`.
  banner: { js: '' },
  logLevel: 'info',
  // Keep ESM, don't touch import/export shape
  treeShaking: true,
  minify: false,
}).catch((err) => {
  console.error('[build-server] failed:', err);
  process.exit(1);
});

console.log('[build-server] wrote server.js');
