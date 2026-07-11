#!/usr/bin/env node
/**
 * Importa el catálogo de ejercicios de HeavyCoach (nombres exactos de Hevy)
 * enriquecido con datos e imágenes de fuentes libres, a public.exercises +
 * bucket exercise-media.
 *
 *   La lista y los nombres salen de la Librería de HeavyCoach (taxonomía = hechos).
 *   Cada ejercicio se enriquece con la ficha equivalente de:
 *     - free-exercise-db (dominio público / Unlicense)   → imágenes + instrucciones
 *     - wger (CC-BY-SA 4.0, atribución)                  → relleno donde free-db no cubre
 *   Los que no matchean quedan con nombre + grupo muscular (sin imagen todavía).
 *
 * El matching se hace OFFLINE y queda congelado en scripts/data/hevy-catalog.json
 * (auditá scripts/data/ o el CSV de revisión). Este seeder solo sube media + upsert.
 *
 * Uso (desde apps/mobile):
 *   npm run seed:hevy
 *
 * Requiere:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Opcional:
 *   SKIP_MEDIA=1   — solo metadata, sin subir imágenes
 *   DRY_RUN=1      — preview sin escribir en Supabase
 *   HEVY_LIMIT=N   — importar solo los primeros N (debug)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = join(__dirname, '..');
const CATALOG_PATH = join(__dirname, 'data', 'hevy-catalog.json');
const BUCKET = 'exercise-media';
const STORAGE_PREFIX = 'hevy';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
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
const skipMedia = process.env.SKIP_MEDIA === '1' || process.env.SKIP_MEDIA === 'true';
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const hevyLimit = process.env.HEVY_LIMIT ? Number.parseInt(process.env.HEVY_LIMIT, 10) : null;
const MEDIA_DELAY_MS = Number.parseInt(process.env.HEVY_MEDIA_DELAY_MS ?? '120', 10);

if (!supabaseUrl && !dryRun) { console.error('Falta EXPO_PUBLIC_SUPABASE_URL en apps/mobile/.env'); process.exit(1); }
if (!serviceRoleKey && !dryRun) { console.error('Falta SUPABASE_SERVICE_ROLE_KEY en apps/mobile/.env'); process.exit(1); }

const supabase = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripHtml(html) {
  if (!html) return [];
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function publicStorageUrl(storagePath) {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

const MEDIA_CACHE = join(__dirname, 'data', 'media-cache');

/** Bytes de la imagen: preferimos un archivo cacheado local (scripts/data/
 * media-cache/<id>.<ext>) y si no existe bajamos de la URL de origen. El cache
 * hace la corrida reproducible y evita depender de que la fuente esté online. */
async function loadImageBytes(id, imageUrl) {
  const ext = imageUrl.toLowerCase().includes('.png') ? 'png' : 'jpg';
  for (const e of [ext, 'jpg', 'png']) {
    const cached = join(MEDIA_CACHE, `${id}.${e}`);
    if (existsSync(cached)) return { bytes: readFileSync(cached), ext: e };
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`download ${res.status}`);
  return { bytes: Buffer.from(await res.arrayBuffer()), ext };
}

async function uploadImage(id, imageUrl) {
  const { bytes, ext } = await loadImageBytes(id, imageUrl);
  const storagePath = `${STORAGE_PREFIX}/${id}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
    upsert: true,
  });
  if (error) throw error;
  return publicStorageUrl(storagePath);
}

/** Devuelve la URL de origen de la imagen (o null) según la fuente de media. */
function sourceImageUrl(row) {
  const m = row.metadata ?? {};
  if (m.mediaSource === 'free-exercise-db') return (m.images ?? [])[0] ?? null;
  if (m.mediaSource === 'wger') return m.wgerImage ?? null;
  return null;
}

/** Fila lista para public.exercises: mueve las instrucciones de wger (HTML) al
 * array, setea image_url, y limpia los campos auxiliares del metadata. */
function finalizeRow(row, imageUrl) {
  const m = { ...(row.metadata ?? {}) };
  let instructions = row.instructions ?? [];
  if (m.mediaSource === 'wger' && instructions.length === 0 && m.descriptionHtml) {
    instructions = stripHtml(m.descriptionHtml);
  }
  delete m.descriptionHtml;
  delete m.wgerImage;
  m.seededAt = new Date().toISOString();
  return {
    id: row.id,
    external_source: row.external_source,
    external_id: row.external_id,
    slug: row.slug,
    name: row.name,
    body_part: row.body_part,
    body_parts: row.body_parts ?? [],
    target_muscles: row.target_muscles ?? [],
    secondary_muscles: row.secondary_muscles ?? [],
    equipment: row.equipment ?? [],
    exercise_type: row.exercise_type,
    image_url: imageUrl,
    instructions,
    metadata: m,
  };
}

async function verifyAccess() {
  const { error } = await supabase.from('exercises').select('id').limit(1);
  if (error) { console.error(`No se pudo conectar a Supabase: ${error.message}`); process.exit(1); }
}

async function main() {
  let catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  if (hevyLimit) catalog = catalog.slice(0, hevyLimit);

  const enriched = catalog.filter((r) => r.metadata?.mediaSource).length;
  console.log(`\nHeavyCoach catálogo → Supabase (${dryRun ? 'DRY RUN' : 'live'})`);
  console.log(`Total: ${catalog.length} · enriquecidos: ${enriched} · solo-nombre: ${catalog.length - enriched}${skipMedia ? ' · sin media' : ''}\n`);

  if (!dryRun) await verifyAccess();

  const rows = [];
  let uploaded = 0, failed = 0;
  for (const item of catalog) {
    let imageUrl = null;
    const srcUrl = sourceImageUrl(item);
    if (!skipMedia && srcUrl) {
      if (dryRun) {
        imageUrl = publicStorageUrl(`${STORAGE_PREFIX}/${item.id}.jpg`);
      } else {
        try {
          imageUrl = await uploadImage(item.id, srcUrl);
          uploaded += 1;
          process.stdout.write('.');
          await sleep(MEDIA_DELAY_MS);
        } catch (err) {
          failed += 1;
          console.warn(`\n⚠ Imagen falló ${item.id}: ${err.message}`);
        }
      }
    }
    rows.push(finalizeRow(item, imageUrl));
  }
  if (!skipMedia && !dryRun) console.log('');

  console.log('\nMuestra:');
  for (const r of rows.slice(0, 6)) {
    console.log(`  · ${r.name} [${r.target_muscles[0] ?? '—'}] ${r.image_url ? '📷' : '  '} ${r.instructions.length}p`);
  }

  if (dryRun) {
    console.log(`\nDRY_RUN: se importarían ${rows.length} filas (${rows.filter((r) => r.image_url).length} con imagen).`);
    return;
  }

  const BATCH = 25;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from('exercises').upsert(rows.slice(i, i + BATCH), { onConflict: 'id' });
    if (error) throw error;
  }

  const withMedia = rows.filter((r) => r.image_url).length;
  console.log(`\n✓ ${rows.length} ejercicios HeavyCoach en public.exercises (${withMedia} con imagen; ${uploaded} subidas, ${failed} fallidas)`);
  console.log('  Atribución: imágenes/instrucciones de free-exercise-db (dominio público) y wger.de (CC-BY-SA 4.0).\n');
}

main().catch((err) => { console.error('\nError:', err.message ?? err); process.exit(1); });
