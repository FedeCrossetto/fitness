#!/usr/bin/env node
/**
 * Copia image_url del catálogo seedeado (wger/ExerciseDB) a los ejercicios demo del plan.
 *
 * Uso: npm run seed:link-demo-exercises
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = join(__dirname, '..');

/** Demo IDs del seed 0009 → términos de búsqueda en el catálogo con media. */
const DEMO_LINKS = [
  { id: 'ex-sentadilla', terms: ['sentadilla con barra', 'back squat', 'sentadilla'], avoid: ['hack', 'front'] },
  { id: 'ex-press-banca', terms: ['press de banca', 'bench press', 'press banca'], avoid: ['inclinado', 'declinado'] },
  { id: 'ex-peso-muerto', terms: ['peso muerto convencional', 'deadlift', 'peso muerto'], avoid: ['rumano', 'sumo'] },
  { id: 'ex-dominadas', terms: ['dominadas pronas', 'pull-up', 'dominada', 'pull up'], avoid: ['asistida'] },
  { id: 'ex-press-militar', terms: ['press militar', 'overhead press', 'military press', 'press de hombro'], avoid: [] },
  { id: 'ex-remo-barra', terms: ['remo con barra', 'barbell row', 'remo inclinado'], avoid: ['plancha', 'cable'] },
  { id: 'ex-zancadas', terms: ['zancadas', 'lunge', 'lunges'], avoid: ['búlgara', 'bulgara'] },
  { id: 'ex-plancha', terms: ['plancha abdominal', 'plank', 'plancha'], avoid: ['remo', 'row', 'side'] },
];

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
const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Faltan EXPO_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

function scoreMatch(name, terms, avoid) {
  const normalized = name.toLowerCase();
  if (avoid.some((word) => normalized.includes(word))) return -1;

  let best = 0;
  for (let i = 0; i < terms.length; i += 1) {
    const term = terms[i].toLowerCase();
    if (!normalized.includes(term)) continue;
    const weight = (terms.length - i) * 10;
    const exact = normalized === term ? 50 : 0;
    const starts = normalized.startsWith(term) ? 20 : 0;
    best = Math.max(best, weight + exact + starts);
  }
  return best;
}

async function findCatalogMatch(terms, avoid = []) {
  const orFilter = terms.map((term) => `name.ilike.%${term}%`).join(',');
  const { data } = await supabase
    .from('exercises')
    .select('id, name, image_url, body_part, target_muscles, instructions')
    .not('image_url', 'is', null)
    .or(orFilter)
    .limit(40);

  const ranked = (data ?? [])
    .filter((row) => row.image_url?.includes('/storage/v1/object/'))
    .map((row) => ({ row, score: scoreMatch(row.name, terms, avoid) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.row ?? null;
}

async function main() {
  console.log('\nVincular ejercicios demo → catálogo con media\n');

  let linked = 0;
  for (const demo of DEMO_LINKS) {
    const match = await findCatalogMatch(demo.terms, demo.avoid ?? []);
    if (!match) {
      console.warn(`  ⚠ ${demo.id}: sin match en catálogo`);
      continue;
    }

    const patch = {
      image_url: match.image_url,
      body_part: match.body_part,
      target_muscles: match.target_muscles,
      ...(match.instructions?.length ? { instructions: match.instructions } : {}),
    };

    if (dryRun) {
      console.log(`  · ${demo.id} ← ${match.name}`);
      linked += 1;
      continue;
    }

    const { error } = await supabase.from('exercises').update(patch).eq('id', demo.id);
    if (error) {
      console.warn(`  ⚠ ${demo.id}: ${error.message}`);
      continue;
    }
    console.log(`  ✓ ${demo.id} ← ${match.name}`);
    linked += 1;
  }

  console.log(`\n${linked}/${DEMO_LINKS.length} ejercicios demo vinculados.\n`);
}

main().catch((err) => {
  console.error('\nError:', err.message ?? err);
  process.exit(1);
});
