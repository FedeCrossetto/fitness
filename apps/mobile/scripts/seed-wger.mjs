#!/usr/bin/env node
/**
 * Importa ejercicios de wger (CC-BY-SA 4) a public.exercises + exercise-media.
 *
 * Uso (desde apps/mobile):
 *   npm run seed:wger
 *
 * Requiere:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Opcional:
 *   WGER_LIMIT=200        — cuántos importar (default 200)
 *   WGER_LANGUAGE=4       — 4=es, 2=en (default 4)
 *   SKIP_MEDIA=1          — solo metadata, sin subir imágenes
 *   DRY_RUN=1
 *
 * Atribución requerida: https://wger.de — licencia CC-BY-SA 4.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = join(__dirname, '..');
const API_BASE = 'https://wger.de/api/v2/exerciseinfo';
const BUCKET = 'exercise-media';
const STORAGE_PREFIX = 'wger';
const SOURCE = 'wger';

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
const limit = Number.parseInt(process.env.WGER_LIMIT ?? '200', 10);
const language = Number.parseInt(process.env.WGER_LANGUAGE ?? '4', 10);
const skipMedia = process.env.SKIP_MEDIA === '1' || process.env.SKIP_MEDIA === 'true';
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
const PAGE_SIZE = 20;
const PAGE_DELAY_MS = Number.parseInt(process.env.WGER_PAGE_DELAY_MS ?? '300', 10);
const MEDIA_DELAY_MS = Number.parseInt(process.env.WGER_MEDIA_DELAY_MS ?? '200', 10);

if (!Number.isFinite(limit) || limit < 1) {
  console.error('WGER_LIMIT debe ser un entero >= 1');
  process.exit(1);
}

if (!supabaseUrl && !dryRun) {
  console.error('Falta EXPO_PUBLIC_SUPABASE_URL en apps/mobile/.env');
  process.exit(1);
}

if (!serviceRoleKey && !dryRun) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en apps/mobile/.env');
  process.exit(1);
}

const supabase = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripHtml(html) {
  if (!html) return [];
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function mapBodyPart(categoryName) {
  if (!categoryName) return null;
  const key = categoryName.toLowerCase();
  if (/arm|brazo/.test(key)) return 'brazos';
  if (/leg|pierna/.test(key)) return 'piernas';
  if (/chest|pecho/.test(key)) return 'pecho';
  if (/back|espalda/.test(key)) return 'espalda';
  if (/shoulder|hombro/.test(key)) return 'hombros';
  if (/abs|core|abdominal/.test(key)) return 'core';
  if (/cardio/.test(key)) return 'cardio';
  return categoryName.toLowerCase();
}

function pickTranslation(info, lang) {
  const translations = info.translations ?? [];
  return (
    translations.find((t) => t.language === lang)
    ?? translations.find((t) => t.language === 2)
    ?? translations[0]
    ?? null
  );
}

function pickMainImage(info) {
  const images = info.images ?? [];
  return images.find((img) => img.is_main) ?? images[0] ?? null;
}

async function fetchExerciseInfoPage(offset) {
  const url = new URL(API_BASE);
  url.searchParams.set('language', String(language));
  url.searchParams.set('limit', String(PAGE_SIZE));
  url.searchParams.set('offset', String(offset));

  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'ResetFitness-Seed/1.0 (+https://reset-fitness.vercel.app)' },
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 200);
    throw new Error(`wger ${res.status}: ${body}`);
  }
  return res.json();
}

async function fetchExercises(maxCount) {
  const rows = [];
  let offset = 0;

  while (rows.length < maxCount) {
    const json = await fetchExerciseInfoPage(offset);
    const batch = json.results ?? [];
    if (batch.length === 0) break;

    for (const item of batch) {
      const translation = pickTranslation(item, language);
      if (!translation?.name?.trim()) continue;
      rows.push(item);
      if (rows.length >= maxCount) break;
    }

    if (!json.next || batch.length === 0) break;
    offset += PAGE_SIZE;
    await sleep(PAGE_DELAY_MS);
  }

  return rows.slice(0, maxCount);
}

function publicStorageUrl(storagePath) {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function uploadImage(exerciseId, imageUrl) {
  const ext = imageUrl.includes('.png') ? 'png' : 'jpg';
  const storagePath = `${STORAGE_PREFIX}/${exerciseId}.${ext}`;
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`download ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  return publicStorageUrl(storagePath);
}

function mapExercise(info, imageUrl) {
  const translation = pickTranslation(info, language);
  const id = `wger-${info.id}`;
  const categoryName = info.category?.name ?? null;

  return {
    id,
    external_source: SOURCE,
    external_id: String(info.id),
    slug: id,
    name: translation.name.trim(),
    body_part: mapBodyPart(categoryName),
    body_parts: categoryName ? [categoryName.toLowerCase()] : [],
    target_muscles: (info.muscles ?? []).map((m) => m.name).filter(Boolean),
    secondary_muscles: (info.muscles_secondary ?? []).map((m) => m.name).filter(Boolean),
    equipment: (info.equipment ?? []).map((e) => e.name).filter(Boolean),
    exercise_type: /cardio/i.test(categoryName ?? '') ? 'cardio' : 'fuerza',
    image_url: imageUrl,
    instructions: stripHtml(translation.description),
    metadata: {
      source: SOURCE,
      wgerUuid: info.uuid,
      license: info.license?.short_name ?? 'CC-BY-SA 4',
      licenseAuthor: info.license_author ?? null,
      seededAt: new Date().toISOString(),
    },
  };
}

async function verifySupabaseAccess() {
  const { error } = await supabase.from('exercises').select('id').limit(1);
  if (error) {
    console.error(`No se pudo conectar a Supabase: ${error.message}`);
    process.exit(1);
  }
}

async function main() {
  console.log(`\nwger → Supabase (${dryRun ? 'DRY RUN' : 'live'})`);
  console.log(`Límite: ${limit} · idioma: ${language}${skipMedia ? ' · sin media' : ''}\n`);

  if (!dryRun) await verifySupabaseAccess();

  const remote = await fetchExercises(limit);
  console.log(`Descargados ${remote.length} ejercicios de wger.de\n`);

  const rows = [];
  for (const item of remote) {
    const mainImage = pickMainImage(item);
    let imageUrl = null;

    if (!skipMedia && mainImage?.image) {
      if (dryRun) {
        imageUrl = publicStorageUrl(`${STORAGE_PREFIX}/${item.id}.jpg`);
      } else {
        try {
          imageUrl = await uploadImage(item.id, mainImage.image);
          process.stdout.write('.');
          await sleep(MEDIA_DELAY_MS);
        } catch (err) {
          console.warn(`\n⚠ Imagen falló wger-${item.id}: ${err.message}`);
        }
      }
    }

    rows.push(mapExercise(item, imageUrl));
  }
  if (!skipMedia && !dryRun) console.log('');

  console.log('\nMuestra:');
  for (const row of rows.slice(0, 5)) {
    console.log(`  · ${row.name} → ${row.target_muscles.slice(0, 2).join(', ') || row.body_part || '—'}`);
  }

  if (dryRun) {
    console.log(`\nDRY_RUN: se importarían ${rows.length} filas.`);
    return;
  }

  const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()];
  const BATCH = 25;
  for (let i = 0; i < uniqueRows.length; i += BATCH) {
    const chunk = uniqueRows.slice(i, i + BATCH);
    const { error } = await supabase.from('exercises').upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
  }

  const withMedia = uniqueRows.filter((row) => row.image_url).length;
  console.log(`\n✓ ${uniqueRows.length} ejercicios wger en public.exercises (${withMedia} con imagen)`);
  console.log('  Atribución: ejercicios e imágenes © wger.de — CC-BY-SA 4.\n');
}

main().catch((err) => {
  console.error('\nError:', err.message ?? err);
  process.exit(1);
});
