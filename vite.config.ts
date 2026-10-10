import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Try 3000 first, then 3001, then 3002 — bookmarked URLs from earlier
      // sessions sometimes still point at 3001.
      port: Number(process.env.PORT || 3000),
      strictPort: false,
      proxy: {
        // Proxy the JSON API + better-auth handler to the Express server.
        // /api/auth/* must NOT be rewritten — better-auth's handler is mounted
        // at the same path in Express.
        '/api': {
          target: process.env.VITE_API_PROXY || 'http://localhost:3002',
          changeOrigin: false,
          secure: false,
        },
      },
    },
  };
});
