#!/usr/bin/env node
/**
 * Importa ejercicios de ExerciseDB (tier gratis) a public.exercises + exercise-media.
 *
 * Uso (desde apps/mobile):
 *   npm run seed:exercisedb
 *
 * Requiere:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Opcional:
 *   EXERCISEDB_LIMIT=50     — cuántos importar (default 50)
 *   EXERCISEDB_PAGE_SIZE=10 — tamaño de página API (max ~10; evita 429 con limit=50)
 *   EXERCISEDB_SOURCE=auto  — api | cache | auto (auto usa cache local si la API falla)
 *   EXERCISEDB_DUMP_CACHE=1 — guarda JSON en scripts/data/exercisedb-cache.json
 *   SKIP_MEDIA=1            — solo metadata, sin subir GIFs
 *   DRY_RUN=1             — preview sin escribir en Supabase
 *
 * Fuente: https://oss.exercisedb.dev (solo prototipo / evaluación; uso comercial requiere plan pago).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = join(__dirname, '..');
const API_BASE = 'https://oss.exercisedb.dev/api/v1/exercises';
const BUCKET = 'exercise-media';
const STORAGE_PREFIX = 'exercisedb';
const SOURCE = 'exercisedb';
const CACHE_PATH = join(__dirname, 'data', 'exercisedb-cache.json');
const FETCH_HEADERS = {
  'User-Agent': 'ResetFitness-Seed/1.0 (prototype; +https://reset-fitness.vercel.app)',
  Accept: 'application/json',
};

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
const limit = Number.parseInt(process.env.EXERCISEDB_LIMIT ?? '150', 10);
const pageSize = Number.parseInt(process.env.EXERCISEDB_PAGE_SIZE ?? '10', 10);
const sourceMode = (process.env.EXERCISEDB_SOURCE ?? 'auto').toLowerCase();
const dumpCache = process.env.EXERCISEDB_DUMP_CACHE === '1' || process.env.EXERCISEDB_DUMP_CACHE === 'true';
const skipMedia = process.env.SKIP_MEDIA === '1' || process.env.SKIP_MEDIA === 'true';
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

if (!Number.isFinite(pageSize) || pageSize < 1 || pageSize > 10) {
  console.error('EXERCISEDB_PAGE_SIZE debe estar entre 1 y 10 (la API bloquea limit≥25).');
  process.exit(1);
}

if (!Number.isFinite(limit) || limit < 1) {
  console.error('EXERCISEDB_LIMIT debe ser un entero >= 1');
  process.exit(1);
}

if (!supabaseUrl && !dryRun) {
  console.error('Falta EXPO_PUBLIC_SUPABASE_URL en apps/mobile/.env');
  process.exit(1);
}

if (!serviceRoleKey && !dryRun) {
  console.error(
    'Falta SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Dashboard → Settings → API → service_role (secret, empieza con eyJ...)\n' +
      'Agregala en apps/mobile/.env o:\n' +
      '  SUPABASE_SERVICE_ROLE_KEY=eyJ... npm run seed:exercisedb',
  );
  process.exit(1);
}

function assertValidServiceRoleKey(key) {
  const placeholders = ['tu_service_role', 'your_service_role', 'eyJ...', 'REPLACE_ME'];
  if (!key || placeholders.some((p) => key === p || key.includes('tu_service_role'))) {
    console.error(
      'SUPABASE_SERVICE_ROLE_KEY inválida.\n' +
        'No uses el texto de ejemplo "tu_service_role".\n' +
        'Copiá la clave real en Supabase Dashboard → Settings → API → service_role (Reveal).\n' +
        'Debe ser un JWT largo que empieza con eyJ',
    );
    process.exit(1);
  }
  const parts = key.split('.');
  if (parts.length !== 3 || !key.startsWith('eyJ')) {
    console.error(
      'SUPABASE_SERVICE_ROLE_KEY no parece un JWT válido (debe tener 3 partes y empezar con eyJ).',
    );
    process.exit(1);
  }
}

if (!dryRun) assertValidServiceRoleKey(serviceRoleKey);

const supabase = serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;

const PAGE_DELAY_MS = Number.parseInt(process.env.EXERCISEDB_PAGE_DELAY_MS ?? '800', 10);
const MEDIA_DELAY_MS = Number.parseInt(process.env.EXERCISEDB_MEDIA_DELAY_MS ?? '400', 10);
const MAX_FETCH_RETRIES = Number.parseInt(process.env.EXERCISEDB_MAX_RETRIES ?? '8', 10);
const INITIAL_BACKOFF_MS = Number.parseInt(process.env.EXERCISEDB_BACKOFF_MS ?? '15000', 10);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(urlInput, { label = 'ExerciseDB' } = {}) {
  const url = typeof urlInput === 'string' ? urlInput : urlInput.toString();
  let backoff = INITIAL_BACKOFF_MS;

  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt++) {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (res.ok) return res;

    const retryable = res.status === 429 || res.status === 503 || res.status === 502;
    if (retryable && attempt < MAX_FETCH_RETRIES) {
      const waitSec = Math.round(backoff / 1000);
      console.warn(`\n⏳ ${label} ${res.status} — reintento ${attempt}/${MAX_FETCH_RETRIES - 1} en ${waitSec}s…`);
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 120_000);
      continue;
    }

    const body = (await res.text()).slice(0, 200);
    if (res.status === 429) {
      throw new Error(
        'ExerciseDB en rate limit (Cloudflare). Esperá 10–15 min, usá SKIP_MEDIA=1, o EXERCISEDB_SOURCE=cache si tenés scripts/data/exercisedb-cache.json.',
      );
    }
    throw new Error(`${label} ${res.status}: ${body}`);
  }
  throw new Error(`${label}: agotados los reintentos`);
}

function loadCache(maxCount) {
  if (!existsSync(CACHE_PATH)) {
    throw new Error(`No existe ${CACHE_PATH}. Corré con EXERCISEDB_DUMP_CACHE=1 cuando la API responda.`);
  }
  const raw = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('Cache inválido: se esperaba un array JSON.');
  const byId = new Map();
  for (const item of raw) {
    if (item?.exerciseId && !byId.has(item.exerciseId)) byId.set(item.exerciseId, item);
  }
  return Array.from(byId.values()).slice(0, maxCount);
}

function saveCache(items) {
  mkdirSync(dirname(CACHE_PATH), { recursive: true });
  writeFileSync(CACHE_PATH, `${JSON.stringify(items, null, 2)}\n`);
  console.log(`\n💾 Cache guardado: ${CACHE_PATH} (${items.length} ejercicios)`);
}

async function verifySupabaseAccess() {
  const { error } = await supabase.from('exercises').select('id').limit(1);
  if (error) {
    console.error(`No se pudo conectar a Supabase: ${error.message}`);
    console.error('Revisá EXPO_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
    process.exit(1);
  }
}

function titleCase(name) {
  return name
    .split(/\s+/)
    .map((w) => (w.length <= 3 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

function mapExercise(item, imageUrl) {
  const id = `edb-${item.exerciseId}`;
  return {
    id,
    external_source: SOURCE,
    external_id: item.exerciseId,
    slug: id,
    name: titleCase(item.name),
    body_part: item.bodyParts?.[0] ?? null,
    body_parts: item.bodyParts ?? [],
    target_muscles: item.targetMuscles ?? [],
    secondary_muscles: item.secondaryMuscles ?? [],
    equipment: item.equipments ?? [],
    exercise_type: 'fuerza',
    image_url: imageUrl,
    instructions: item.instructions ?? [],
    metadata: {
      source: SOURCE,
      sourceGifUrl: item.gifUrl,
      seededAt: new Date().toISOString(),
    },
  };
}

async function fetchExerciseBatch(batchSize, cursor) {
  const url = new URL(API_BASE);
  url.searchParams.set('limit', String(batchSize));
  if (cursor) url.searchParams.set('cursor', cursor);

  const res = await fetchWithRetry(url, { label: 'ExerciseDB list' });
  const json = await res.json();
  if (!json.success || !Array.isArray(json.data)) {
    throw new Error('Respuesta inesperada de ExerciseDB');
  }
  return json;
}

async function fetchExercises(maxCount) {
  const byId = new Map();
  let cursor;
  let lastCursor;
  let emptyPageRetries = 0;

  while (byId.size < maxCount) {
    const batch = Math.min(pageSize, maxCount - byId.size);
    const json = await fetchExerciseBatch(batch, cursor);
    const sizeBefore = byId.size;
    for (const item of json.data) {
      if (!byId.has(item.exerciseId)) byId.set(item.exerciseId, item);
    }

    if (byId.size === sizeBefore) {
      emptyPageRetries += 1;
      if (emptyPageRetries < 4) {
        const waitSec = Math.round((PAGE_DELAY_MS * 4 * emptyPageRetries) / 1000);
        console.warn(`\n⚠ Página sin ejercicios nuevos; reintento ${emptyPageRetries}/3 en ${waitSec}s…`);
        await sleep(PAGE_DELAY_MS * 4 * emptyPageRetries);
        continue;
      }
      console.warn('\n⚠ Paginación sin avance; se detiene con lo descargado.');
      break;
    }
    emptyPageRetries = 0;

    if (!json.meta?.hasNextPage || byId.size >= maxCount) break;

    const nextCursor = json.meta.nextCursor;
    if (!nextCursor || nextCursor === lastCursor) {
      console.warn('\n⚠ Sin cursor siguiente; se detiene con lo descargado.');
      break;
    }
    lastCursor = cursor;
    cursor = nextCursor;
    await sleep(PAGE_DELAY_MS);
  }

  return Array.from(byId.values()).slice(0, maxCount);
}

async function resolveExercises(maxCount) {
  if (sourceMode === 'cache') {
    console.log('Fuente: cache local\n');
    return loadCache(maxCount);
  }

  if (sourceMode === 'api') {
    const remote = await fetchExercises(maxCount);
    if (dumpCache && remote.length > 0) saveCache(remote);
    return remote;
  }

  // auto
  try {
    const remote = await fetchExercises(maxCount);
    if (dumpCache && remote.length > 0) saveCache(remote);
    return remote;
  } catch (err) {
    if (!existsSync(CACHE_PATH)) throw err;
    console.warn(`\n⚠ API falló (${err.message}). Usando cache local.\n`);
    return loadCache(maxCount);
  }
}

function publicStorageUrl(storagePath) {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

async function uploadGif(exerciseId, gifUrl) {
  const storagePath = `${STORAGE_PREFIX}/${exerciseId}.gif`;
  const res = await fetchWithRetry(gifUrl, { label: `GIF ${exerciseId}` });
  const bytes = Buffer.from(await res.arrayBuffer());
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: 'image/gif',
    upsert: true,
  });
  if (error) throw error;
  return publicStorageUrl(storagePath);
}

async function main() {
  console.log(`\nExerciseDB → Supabase (${dryRun ? 'DRY RUN' : 'live'})`);
  console.log(`Límite: ${limit}${skipMedia ? ' · sin media' : ''}\n`);

  if (!dryRun) await verifySupabaseAccess();

  const remote = await resolveExercises(limit);
  console.log(`Descargados ${remote.length} ejercicios${sourceMode === 'cache' ? ' (cache)' : ' de oss.exercisedb.dev'}\n`);

  const rows = [];
  for (const item of remote) {
    let imageUrl = null;
    if (!skipMedia && item.gifUrl) {
      if (dryRun) {
        imageUrl = publicStorageUrl(`${STORAGE_PREFIX}/${item.exerciseId}.gif`);
      } else {
        try {
          imageUrl = await uploadGif(item.exerciseId, item.gifUrl);
          process.stdout.write('.');
          await sleep(MEDIA_DELAY_MS);
        } catch (err) {
          console.warn(`\n⚠ GIF falló ${item.exerciseId}: ${err.message}`);
        }
      }
    }
    rows.push(mapExercise(item, imageUrl));
  }
  if (!skipMedia && !dryRun) console.log('');

  console.log('\nMuestra:');
  for (const row of rows.slice(0, 5)) {
    console.log(`  · ${row.name} → ${row.target_muscles.join(', ')}`);
  }

  if (dryRun) {
    console.log(`\nDRY_RUN: se importarían ${rows.length} filas.`);
    return;
  }

  const uniqueRows = [...new Map(rows.map((row) => [row.id, row])).values()];
  if (uniqueRows.length < rows.length) {
    console.log(`\nℹ ${rows.length - uniqueRows.length} duplicados omitidos antes del upsert.`);
  }

  const BATCH = 25;
  for (let i = 0; i < uniqueRows.length; i += BATCH) {
    const chunk = uniqueRows.slice(i, i + BATCH);
    const { error } = await supabase.from('exercises').upsert(chunk, { onConflict: 'id' });
    if (error) throw error;
  }

  console.log(`\n✓ ${uniqueRows.length} ejercicios en public.exercises`);
  console.log('  Probalos en Entreno → sesión en vivo → Agregar ejercicio → buscar "bench" o "squat".');
  console.log('  Atribución requerida en prototipo: AscendAPI / ExerciseDB.\n');
}

main().catch((err) => {
  console.error('\nError:', err.message ?? err);
  process.exit(1);
});
