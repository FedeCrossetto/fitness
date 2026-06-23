import { ImageSourcePropType } from 'react-native';
import type { BodyZoneId } from '@reset-fitness/shared';
import { bodyModels } from './illustrations';

export type BodyZoneGender = 'male' | 'female';

/** Generado por scripts/sync-body-zone-assets.mjs — no editar a mano. */
const maleZoneOverlays: Partial<Record<BodyZoneId, ImageSourcePropType>> = {
  abdominales: require('../../assets/body/zones/male/abs.png') as ImageSourcePropType,
  cuadriceps: require('../../assets/body/zones/male/cuadriceps.png') as ImageSourcePropType,
  deltoides: require('../../assets/body/zones/male/shoulders.png') as ImageSourcePropType,
  dorsales: require('../../assets/body/zones/male/back.png') as ImageSourcePropType,
  gluteos: require('../../assets/body/zones/male/femorales-gluteos.png') as ImageSourcePropType,
  isquiotibiales: require('../../assets/body/zones/male/femorales-gluteos.png') as ImageSourcePropType,
  oblicuos: require('../../assets/body/zones/male/oblicuos.png') as ImageSourcePropType,
  pecho: require('../../assets/body/zones/male/push.png') as ImageSourcePropType,
  trapecios: require('../../assets/body/zones/male/trapecios.png') as ImageSourcePropType,
  triceps: require('../../assets/body/zones/male/triceps.png') as ImageSourcePropType,
};

const femaleZoneOverlays: Partial<Record<BodyZoneId, ImageSourcePropType>> = {
  // (sin PNGs — copiá archivos a assets/body/zones/female/)
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
