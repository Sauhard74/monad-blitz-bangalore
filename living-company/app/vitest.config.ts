import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `import 'server-only'` throws unless resolved via the `react-server`
      // export condition (which our test runner doesn't use). Map it to the
      // package's empty stub so server-only modules can be unit-tested.
      'server-only': fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Phaser pulls in browser/WebGL globals; keep unit tests to pure logic
    // and the small set of integration-heart modules (see docs/plans).
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
