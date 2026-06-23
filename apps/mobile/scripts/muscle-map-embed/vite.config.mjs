import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  build: {
    outDir: path.resolve(__dirname, '../../src/generated/muscle-map-dist'),
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'main.ts'),
      name: 'MuscleMapEmbed',
      formats: ['iife'],
      fileName: () => 'embed.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
    minify: true,
  },
});
