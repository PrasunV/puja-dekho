import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false, // The map library is one lazy-loaded chunk (about 1 MB); it does not block first paint.
    chunkSizeWarningLimit: 1200,
  },
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
});
