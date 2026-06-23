#!/usr/bin/env node
/**
 * Sube iconos PNG a Storage (bucket food-images) e inserta/actualiza public.food_images.
 *
 * Uso (desde apps/mobile):
 *   npm run seed:food-icons
 *
 * Requiere:
 *   EXPO_PUBLIC_SUPABASE_URL  (apps/mobile/.env)
 *   SUPABASE_SERVICE_ROLE_KEY (solo local; Dashboard → Settings → API)
 *
 * Opcional:
 *   FOOD_ICONS_DIR=ruta/a/pngs
 *   DRY_RUN=1  — solo muestra qué haría, sin subir
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = join(__dirname, '..');
const REPO_ROOT = join(MOBILE_ROOT, '../..');
const DEFAULT_ICONS_DIR = join(REPO_ROOT, 'packages/shared/assets/food-icons');
const CATALOG_PATH = join(REPO_ROOT, 'packages/shared/src/nutrition/foodIconCatalog.json');
const BUCKET = 'food-images';
const STORAGE_PREFIX = 'icons';

/** Catálogo compartido con web/mobile (foodIconCatalog.json). */
const ICON_CATALOG = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(join(MOBILE_ROOT, '.env'));
loadEnvFile(join(MOBILE_ROOT, '.env.local'));

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const iconsDir = process.env.FOOD_ICONS_DIR ?? DEFAULT_ICONS_DIR;
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

if (!supabaseUrl) {
  console.error('Falta EXPO_PUBLIC_SUPABASE_URL en apps/mobile/.env');
  process.exit(1);
}
if (!serviceRoleKey && !dryRun) {
  console.error(
    'Falta SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Obtenela en Supabase Dashboard → Settings → API → service_role (secret).\n' +
      'Ejemplo: SUPABASE_SERVICE_ROLE_KEY=eyJ... npm run seed:food-icons',
  );
  process.exit(1);
}
if (!existsSync(iconsDir)) {
  console.error(`No existe la carpeta de iconos: ${iconsDir}`);
  process.exit(1);
}

const supabase = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

function publicUrl(storagePath) {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function main() {
  console.log(`Iconos: ${iconsDir}`);
  console.log(`Bucket: ${BUCKET}/${STORAGE_PREFIX}/`);
  if (dryRun) console.log('DRY RUN — no se sube nada\n');

  const rows = [];
  let ok = 0;
  let missing = 0;

  for (const item of ICON_CATALOG) {
    const localPath = join(iconsDir, item.file);
    const storagePath = `${STORAGE_PREFIX}/${item.key}.png`;

    if (!existsSync(localPath)) {
      console.warn(`⚠️  Falta archivo: ${item.file}`);
      missing += 1;
      continue;
    }

    const body = readFileSync(localPath);
    const imageUrl = publicUrl(storagePath);

    if (dryRun) {
      console.log(`→ ${item.file} → key="${item.key}" → ${storagePath}`);
      rows.push({ key: item.key, name: item.label, image_url: imageUrl });
      ok += 1;
      continue;
    }

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, body, {
      contentType: 'image/png',
      upsert: true,
    });

    if (uploadError) {
      console.error(`✗ Upload ${item.file}:`, uploadError.message);
      continue;
    }

    const { error: dbError } = await supabase.from('food_images').upsert(
      { key: item.key, name: item.label, image_url: imageUrl },
      { onConflict: 'key' },
    );

    if (dbError) {
      console.error(`✗ DB ${item.key}:`, dbError.message);
      continue;
    }

    console.log(`✓ ${item.key} (${item.label})`);
    rows.push({ key: item.key, name: item.label, image_url: imageUrl });
    ok += 1;
  }

  console.log(`\nListo: ${ok} iconos${missing ? `, ${missing} faltantes` : ''}.`);

  if (rows.length > 0) {
    const sqlPath = join(MOBILE_ROOT, 'scripts', 'food-icons-seed.generated.sql');
    const sql = [
      '-- Generado por seed-food-icons.mjs — referencia / backup',
      'insert into public.food_images (key, name, image_url) values',
      ...rows.map(
        (r, i) =>
          `  ('${r.key}', '${r.name.replace(/'/g, "''")}', '${r.image_url}')${i < rows.length - 1 ? ',' : ''}`,
      ),
      'on conflict (key) do update set',
      '  name = excluded.name,',
      '  image_url = excluded.image_url;',
      '',
    ].join('\n');
    if (!dryRun) {
      const { writeFileSync } = await import('fs');
      writeFileSync(sqlPath, sql, 'utf8');
      console.log(`SQL backup: ${sqlPath}`);
    }
  }

  if (missing > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
