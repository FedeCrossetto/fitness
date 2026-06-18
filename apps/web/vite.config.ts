import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@reset-fitness/shared': new URL('../../packages/shared/src', import.meta.url).pathname,
      '@': new URL('./src', import.meta.url).pathname,
    },
  },
  server: { port: 5173 },
});
