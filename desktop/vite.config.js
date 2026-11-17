import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: resolve(here, 'ui'),
  base: './',
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    clearScreen: false
  },
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    sourcemap: false
  }
});
