// ============================================================
// vite.config.ts — Sprint 7D: Performance optimizations
//   - Manual chunk splitting for mini-games and heavy deps
//   - Asset inlining threshold
//   - Memory-bounded esbuild minification
//   - CSS code splitting
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
    sourcemap: false,          // disable in prod for smaller output
    cssCodeSplit: true,
    assetsInlineLimit: 4096,   // inline assets < 4 KB

    rollupOptions: {
      output: {
        // ── Manual chunk strategy ──────────────────────────
        // Split heavy mini-games into separate lazy chunks so
        // the initial shell loads fast.
        manualChunks(id) {
          // Mapbox — large, only needed in hood view
          if (id.includes('mapbox-gl') || id.includes('@mapbox')) {
            return 'vendor-mapbox';
          }
          // Phaser — only needed in slide/driveby games
          if (id.includes('phaser')) {
            return 'vendor-phaser';
          }
          // Babylon — lazy-loaded only by Modern Ops
          if (id.includes('@babylonjs/core')) {
            return 'vendor-babylon';
          }
          // Framer Motion
          if (id.includes('framer-motion')) {
            return 'vendor-framer';
          }
          // Supabase
          if (id.includes('@supabase')) {
            return 'vendor-supabase';
          }
          // Socket.IO
          if (id.includes('socket.io')) {
            return 'vendor-socket';
          }

        },
      },
    },

    // esbuild keeps production bundling fast and memory-bounded in CI.
    minify: 'esbuild',
  },

  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      'framer-motion',
      'mapbox-gl',
      'phaser',
    ],
  },
});

