import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false, // The map library is one lazy-loaded chunk (about 1 MB); it does not block first paint.
    chunkSizeWarningLimit: 1200,
    // Two pages: the Durga app at / and Jagadhatri Puja at /jagadhatripuja.
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), jagadhatri: resolve(import.meta.dirname, 'jagadhatripuja/index.html') },
    },
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
