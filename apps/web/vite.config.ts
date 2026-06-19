import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.dirname(fileURLToPath(import.meta.url));
const sharedRoot = path.resolve(webRoot, '../../packages/shared');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@reset-fitness/shared': path.join(sharedRoot, 'src'),
      '@': path.join(webRoot, 'src'),
    },
    extensions: ['.web.ts', '.web.tsx', '.ts', '.tsx', '.js', '.jsx', '.json'],
  },
  server: { port: 5173 },
});
