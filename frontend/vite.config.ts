// ============================================================
// vite.config.ts — Sprint 7D: Performance optimizations
//   - Manual chunk splitting for mini-games and heavy deps
//   - Asset inlining threshold
//   - Terser minification
//   - CSS code splitting
// ============================================================

import { defineConfig, splitVendorChunkPlugin } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    splitVendorChunkPlugin(),
  ],

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
          // Mini-game components — lazy-loaded
          if (
            id.includes('/components/slide/') ||
            id.includes('/components/driveby/') ||
            id.includes('/components/alchemy/')
          ) {
            return 'chunk-minigames';
          }
          // Economy / market screens
          if (
            id.includes('/components/economy/') ||
            id.includes('/components/casino/')
          ) {
            return 'chunk-economy';
          }
          // Gang / contacts screens
          if (
            id.includes('/components/gang/') ||
            id.includes('/components/contacts/')
          ) {
            return 'chunk-crew';
          }
          // Map components
          if (id.includes('/components/map/')) {
            return 'chunk-map';
          }
        },
      },
    },

    // Terser minification options
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,    // remove console.log in prod
        drop_debugger: true,
        pure_funcs: ['console.warn', 'console.info'],
      },
    },
  },

  // Optimize dependency pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      'framer-motion',
    ],
    exclude: [
      'mapbox-gl',   // too large to pre-bundle
      'phaser',
    ],
  },
});
