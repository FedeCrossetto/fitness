#!/usr/bin/env node
/**
 * Escanea assets/body/zones/{male|female}/*.png y regenera bodyZoneAssets.ts
 *
 * Uso: node scripts/sync-body-zone-assets.mjs
 * o:   npm run sync:body-zones
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const zonesRoot = path.join(mobileRoot, 'assets/body/zones');
const outFile = path.join(mobileRoot, 'src/theme/bodyZoneAssets.ts');

const VALID_IDS = new Set([
  'trapecios',
  'deltoides',
  'pecho',
  'dorsales',
  'biceps',
  'triceps',
  'antebrazos',
  'abdominales',
  'oblicuos',
  'lumbar',
  'cuadriceps',
  'isquiotibiales',
  'gluteos',
  'gemelos',
]);

/** Nombre del archivo del diseñador → zona(s) canónica(s) de la app. */
const FILE_TO_ZONES = {
  abs: ['abdominales'],
  back: ['dorsales'],
  shoulders: ['deltoides'],
  'chest-triceps': ['pecho', 'triceps'],
  push: ['pecho', 'deltoides', 'triceps'],
  'femorales-gluteos': ['isquiotibiales', 'gluteos'],
  'trapecios-posteriores': ['trapecios'],
};

function zonesForFile(basename) {
  if (VALID_IDS.has(basename)) return [basename];
  return FILE_TO_ZONES[basename] ?? null;
}

/** @returns {Map<string, string>} zoneId → filename (sin .png) */
function scanGender(gender) {
  const dir = path.join(zonesRoot, gender);
  const zoneToFile = new Map();
  if (!fs.existsSync(dir)) return zoneToFile;

  for (const name of fs.readdirSync(dir).filter((entry) => entry.endsWith('.png'))) {
    const basename = name.replace(/\.png$/, '');
    const zones = zonesForFile(basename);
    if (!zones) {
      console.warn(`  ⚠ ${gender}/${name} — sin mapeo (agregar en FILE_TO_ZONES del sync script)`);
      continue;
    }
    for (const zoneId of zones) {
      if (!VALID_IDS.has(zoneId)) continue;
      zoneToFile.set(zoneId, basename);
    }
  }

  return zoneToFile;
}

function renderRequires(gender, zoneToFile) {
  if (zoneToFile.size === 0) {
    return `  // (sin PNGs — copiá archivos a assets/body/zones/${gender}/)`;
  }
  return [...zoneToFile.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([zoneId, fileBase]) =>
        `  ${zoneId}: require('../../assets/body/zones/${gender}/${fileBase}.png') as ImageSourcePropType,`,
    )
    .join('\n');
}

const maleZones = scanGender('male');
const femaleZones = scanGender('female');

const content = `import { ImageSourcePropType } from 'react-native';
import type { BodyZoneId } from '@reset-fitness/shared';
import { bodyModels } from './illustrations';

export type BodyZoneGender = 'male' | 'female';

/** Generado por scripts/sync-body-zone-assets.mjs — no editar a mano. */
const maleZoneOverlays: Partial<Record<BodyZoneId, ImageSourcePropType>> = {
${renderRequires('male', maleZones)}
};

const femaleZoneOverlays: Partial<Record<BodyZoneId, ImageSourcePropType>> = {
${renderRequires('female', femaleZones)}
};

export const bodyZoneOverlays: Record<BodyZoneGender, Partial<Record<BodyZoneId, ImageSourcePropType>>> = {
  male: maleZoneOverlays,
  female: femaleZoneOverlays,
};

export function bodyBaseModel(gender: BodyZoneGender): ImageSourcePropType {
  return bodyModels[gender];
}

export function bodyZoneOverlay(
  gender: BodyZoneGender,
  zoneId: BodyZoneId,
): ImageSourcePropType | null {
  return bodyZoneOverlays[gender][zoneId] ?? null;
}
`;

fs.writeFileSync(outFile, content);
console.log(`✓ bodyZoneAssets.ts — male: ${maleZones.size}, female: ${femaleZones.size}`);
if (maleZones.size) console.log('  male:', [...maleZones.keys()].join(', '));
if (femaleZones.size) console.log('  female:', [...femaleZones.keys()].join(', '));
