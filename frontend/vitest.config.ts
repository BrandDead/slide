/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Use jsdom for components that need DOM APIs
    environment: 'jsdom',
    // Setup file runs before each test file
    setupFiles: ['./src/test-setup.ts'],
    // Include both .ts and .tsx test files
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    globals: true,
  },
});
