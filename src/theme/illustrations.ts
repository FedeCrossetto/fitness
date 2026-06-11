import { ImageSourcePropType } from 'react-native';

/**
 * Mapa centralizado pilar/estado → asset de la mascota 3D.
 *
 * Archivos fuente del cliente (NO generados por IA):
 * - assets/mascot/avatar3d-set-pilares.png  ← avatar3d.png (hero + 3 tarjetas de pilar)
 * - assets/mascot/avatar3d-set-poses.png     ← avatar3d-2.png (4 poses: entreno, descanso, nutrición, progreso)
 *
 * La app usa recortes por pose para mejor rendimiento. No recolorear fuera de la paleta.
 */

export type Pillar = 'training' | 'nutrition' | 'progress';

/** Bundles fuente completos (referencia / precarga / panel admin) */
export const illustrationSources = {
  pilares: require('../../assets/mascot/avatar3d-set-pilares.png') as ImageSourcePropType,
  poses: require('../../assets/mascot/avatar3d-set-poses.png') as ImageSourcePropType,
} as const;

export const illustrations = {
  /** Pose de cuerpo entero con shaker — onboarding / bienvenida / splash */
  hero: require('../../assets/mascot/hero.png') as ImageSourcePropType,

  /** Cabeceras de pilar (recorte de avatar3d-set-pilares) */
  pillarHeader: {
    training: require('../../assets/mascot/card-training.png') as ImageSourcePropType,
    nutrition: require('../../assets/mascot/card-nutrition.png') as ImageSourcePropType,
    progress: require('../../assets/mascot/card-progress.png') as ImageSourcePropType,
  } satisfies Record<Pillar, ImageSourcePropType>,

  /** Poses de cuerpo entero (recorte de avatar3d-set-poses) — empty states / pantallas temáticas */
  pose: {
    training: require('../../assets/mascot/pose-training.png') as ImageSourcePropType,
    nutrition: require('../../assets/mascot/pose-nutrition.png') as ImageSourcePropType,
    progress: require('../../assets/mascot/pose-progress.png') as ImageSourcePropType,
    rest: require('../../assets/mascot/pose-rest.png') as ImageSourcePropType,
  },

  /** Logros / rachas — pose de progreso con stats flotantes */
  victory: require('../../assets/mascot/pose-progress.png') as ImageSourcePropType,

  /** Tarjeta de perfil / loaders */
  profile: require('../../assets/mascot/hero.png') as ImageSourcePropType,
} as const;

export const emptyStateIllustration: Record<Pillar | 'generic', ImageSourcePropType> = {
  training: illustrations.pose.training,
  nutrition: illustrations.pose.nutrition,
  progress: illustrations.pose.progress,
  generic: illustrations.hero,
};
