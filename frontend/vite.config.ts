// ============================================================
// vite.config.ts — Closed-beta route performance
//   - Route-level lazy chunks for MAP / Strip / mini-games
//   - Intentional vendor splits for MapLibre / Phaser
//   - Babylon stays with the Modern Ops lazy route (do not force
//     a vendor-babylon mega-chunk — that made App modulepreload it)
//   - Mapbox kept out of optimizeDeps (unused on the beta path)
// ============================================================

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: { host: '0.0.0.0' },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,
    cssCodeSplit: true,
    assetsInlineLimit: 4096,

    // Avoid preloading engine chunks that are only needed on deep routes.
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter(
          (dep) =>
            !dep.includes('vendor-maplibre') &&
            !dep.includes('vendor-phaser') &&
            !dep.includes('vendor-babylon') &&
            !dep.includes('@babylonjs') &&
            !dep.includes('maplibre-gl') &&
            !dep.includes('phaser'),
        ),
    },

    rollupOptions: {
      output: {
        // Prefer route-owned app chunks from React.lazy; only force
        // MapLibre / Phaser into named vendor boundaries.
        // Babylon is intentionally NOT forced here — a vendor-babylon
        // manual chunk previously caused App to statically import it
        // and Vite to modulepreload ~3 MB on the demo shell.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('maplibre-gl')) {
              return 'vendor-maplibre';
            }
            if (id.includes('mapbox-gl') || id.includes('@mapbox')) {
              return 'vendor-mapbox';
            }
            if (id.includes('phaser')) {
              return 'vendor-phaser';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-framer';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('socket.io')) {
              return 'vendor-socket';
            }
          }
          return undefined;
        },
      },
    },

    minify: 'esbuild',
  },

  // Do not prebundle Mapbox / Phaser / MapLibre for the shell —
  // those engines load with their owning routes.
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      'framer-motion',
    ],
  },
});
