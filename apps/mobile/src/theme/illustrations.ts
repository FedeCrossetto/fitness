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

/**
 * Modelos corporales para la pantalla de Medidas, según el sexo del usuario.
 * Archivos del cliente en assets/body/ (actualmente placeholders — reemplazar
 * por las imágenes reales manteniendo los nombres male.png / female.png).
 */
export const bodyModels = {
  male: require('../../assets/body/male.png') as ImageSourcePropType,
  female: require('../../assets/body/female.png') as ImageSourcePropType,
} as const;

/**
 * Set caracterizado del cliente (avt0–avt4): poses de cuerpo entero con props
 * temáticos (mancuerna, ensalada, cinta métrica, banco) + cabeza suelta.
 * Recortes con fondo transparente, optimizados a 600px de ancho.
 */
const charHead = require('../../assets/mascot/char-head.png') as ImageSourcePropType;
const charTraining = require('../../assets/mascot/char-training.png') as ImageSourcePropType;
const charRest = require('../../assets/mascot/char-rest.png') as ImageSourcePropType;
const charNutrition = require('../../assets/mascot/char-nutrition.png') as ImageSourcePropType;
const charProgress = require('../../assets/mascot/char-progress.png') as ImageSourcePropType;
const charLogin = require('../../assets/mascot/char-login.png') as ImageSourcePropType;

export const illustrations = {
  /** Pose de cuerpo entero con shaker — onboarding / bienvenida / splash */
  hero: require('../../assets/mascot/hero.png') as ImageSourcePropType,

  /** Pose de bienvenida — pantalla de login */
  login: charLogin,

  /** Solo cabeza — avatares, chips y acentos compactos */
  head: charHead,

  /** Cabeceras de pilar — pose temática de cuerpo entero */
  pillarHeader: {
    training: charTraining,
    nutrition: charNutrition,
    progress: charProgress,
  } satisfies Record<Pillar, ImageSourcePropType>,

  /** Poses de cuerpo entero — empty states / pantallas temáticas */
  pose: {
    training: charTraining,
    nutrition: charNutrition,
    progress: charProgress,
    rest: charRest,
  },

  /** Logros / rachas — pose de progreso con stats flotantes */
  victory: charProgress,

  /** Trofeo 3D — día con todas las metas cumplidas */
  trophy: require('../../assets/trophy.png') as ImageSourcePropType,

  /** Tarjeta de perfil / loaders */
  profile: charHead,
} as const;

/**
 * Variantes para dar variedad: en lugar de repetir siempre la misma imagen,
 * `pickMascot(seed)` devuelve una pose de forma determinística a partir de una
 * semilla (id de usuario, fecha, índice…). Sin semilla, elige una al azar.
 */
export const mascotVariants: ImageSourcePropType[] = [
  charTraining,
  charNutrition,
  charProgress,
  charRest,
];

export function pickMascot(seed?: string | number): ImageSourcePropType {
  if (seed === undefined) {
    return mascotVariants[Math.floor(Math.random() * mascotVariants.length)];
  }
  const str = String(seed);
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return mascotVariants[hash % mascotVariants.length];
}

export const emptyStateIllustration: Record<Pillar | 'generic', ImageSourcePropType> = {
  training: illustrations.pose.training,
  nutrition: illustrations.pose.nutrition,
  progress: illustrations.pose.progress,
  generic: illustrations.hero,
};
