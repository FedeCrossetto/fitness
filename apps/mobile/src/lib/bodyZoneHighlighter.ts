import type { BodyZoneId, WorkedZoneEntry } from '@reset-fitness/shared';

type ExtendedBodyPart = { slug: string; color: string };

/** Verde de marca — mismo tono que macros / entreno completado. */
export const BODY_HIGHLIGHT_COLOR = '#31F37B';

type MuscleMapping = {
  slug: ExtendedBodyPart['slug'];
  view: 'front' | 'back';
};

/** Zona canónica de la app → slug de body highlighter / MuscleMapJS. */
export const BODY_ZONE_TO_MUSCLE: Partial<Record<BodyZoneId, MuscleMapping>> = {
  trapecios: { slug: 'trapezius', view: 'front' },
  deltoides: { slug: 'deltoids', view: 'front' },
  pecho: { slug: 'chest', view: 'front' },
  biceps: { slug: 'biceps', view: 'front' },
  triceps: { slug: 'triceps', view: 'front' },
  antebrazos: { slug: 'forearm', view: 'front' },
  abdominales: { slug: 'abs', view: 'front' },
  oblicuos: { slug: 'obliques', view: 'front' },
  cuadriceps: { slug: 'quadriceps', view: 'front' },
  gemelos: { slug: 'calves', view: 'front' },
  dorsales: { slug: 'upper-back', view: 'back' },
  lumbar: { slug: 'lower-back', view: 'back' },
  isquiotibiales: { slug: 'hamstring', view: 'back' },
  gluteos: { slug: 'gluteal', view: 'back' },
};

export function workedZonesToHighlighterData(
  zones: WorkedZoneEntry[],
  view: 'front' | 'back',
  color = BODY_HIGHLIGHT_COLOR,
): ExtendedBodyPart[] {
  const seen = new Set<string>();

  return zones.flatMap((zone) => {
    const mapping = BODY_ZONE_TO_MUSCLE[zone.id];
    if (!mapping || mapping.view !== view || !mapping.slug || seen.has(mapping.slug)) return [];
    seen.add(mapping.slug);
    return [{ slug: mapping.slug, color }];
  });
}

export function pickBodyView(zones: WorkedZoneEntry[]): 'front' | 'back' {
  let frontScore = 0;
  let backScore = 0;

  for (const zone of zones) {
    const mapping = BODY_ZONE_TO_MUSCLE[zone.id];
    if (!mapping) continue;
    if (mapping.view === 'front') frontScore += zone.completedSets;
    else backScore += zone.completedSets;
  }

  return backScore > frontScore ? 'back' : 'front';
}

export function zoneIllustratedOnView(zoneId: BodyZoneId, view: 'front' | 'back'): boolean {
  const mapping = BODY_ZONE_TO_MUSCLE[zoneId];
  return mapping?.view === view;
}
