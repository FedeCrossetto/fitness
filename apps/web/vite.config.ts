import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import { URL } from 'url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@habito/shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: { port: 5173 },
});
