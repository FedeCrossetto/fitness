#!/usr/bin/env node
/**
 * Empaqueta MuscleMapJS en un IIFE para WebView (React Native).
 * Requiere vendor/MuscleMapJS (git clone del repo).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const vendorDir = path.join(mobileRoot, 'vendor/MuscleMapJS');
const distDir = path.join(mobileRoot, 'src/generated/muscle-map-dist');
const outFile = path.join(mobileRoot, 'src/generated/muscleMapEmbed.ts');

if (!fs.existsSync(vendorDir)) {
  console.error('Missing vendor/MuscleMapJS — run: git clone https://github.com/abdofallah/MuscleMapJS.git apps/mobile/vendor/MuscleMapJS');
  process.exit(1);
}

const viteCandidates = [
  path.join(mobileRoot, 'node_modules/vite/bin/vite.js'),
  path.join(mobileRoot, '../../node_modules/vite/bin/vite.js'),
];
const viteBin = viteCandidates.find((candidate) => fs.existsSync(candidate));
if (!viteBin) {
  console.error('vite not found — run npm install at repo root');
  process.exit(1);
}

const build = spawnSync(process.execPath, [viteBin, 'build', '--config', 'scripts/muscle-map-embed/vite.config.mjs'], {
  cwd: mobileRoot,
  stdio: 'inherit',
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const bundlePath = path.join(distDir, 'embed.js');
if (!fs.existsSync(bundlePath)) {
  console.error('Build failed: embed.js not found');
  process.exit(1);
}

const bundle = fs.readFileSync(bundlePath, 'utf8');
const htmlTemplate = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
html, body { margin:0; padding:0; width:100%; height:100%; background:transparent; overflow:hidden; }
#muscle-map { width:100%; height:100%; }
</style>
</head>
<body>
<div id="muscle-map"></div>
<script>${bundle}</script>
</body>
</html>`;

const tsSource = `/** Generado por scripts/build-muscle-map-embed.mjs — no editar a mano. */
export const MUSCLE_MAP_EMBED_HTML = ${JSON.stringify(htmlTemplate)};
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, tsSource);
console.log('✓ src/generated/muscleMapEmbed.ts');
