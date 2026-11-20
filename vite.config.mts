import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // three.js alone is ~700 kB; it is one cached chunk, so the warning is noise.
    chunkSizeWarningLimit: 1000,
  },
});
