/** Opciones alineadas con Plan Base (Notion) y el formulario de consulta del panel web. */
import worldCountries from 'world-countries';

export const ONBOARDING_GOALS = [
  'Bajar de peso',
  'Ganar masa muscular',
  'Mejorar resistencia',
  'Tonificar',
  'Salud general',
  'Fuerza y potencia',
  'Rendimiento deportivo',
] as const;

export const ONBOARDING_LEVELS = ['Principiante', 'Intermedio', 'Avanzado'] as const;

export const ONBOARDING_GENDERS = [
  { label: 'Masculino', value: 'male' as const },
  { label: 'Femenino', value: 'female' as const },
  { label: 'Otro', value: 'other' as const },
] as const;

export interface CountryOption {
  /** Código de marcado internacional, ej. "+54". */
  code: string;
  /** ISO 3166-1 alpha-2, ej. "AR". Usado para validar el teléfono con libphonenumber-js. */
  cca2: string;
  flag: string;
  /** Nombre en español, el que se muestra en la UI. */
  name: string;
  /** Nombre en inglés, el que esperan las APIs públicas de ciudades. */
  nameEn: string;
}

/** Países cuyo nombre en español va primero en el listado (LATAM + España). */
const PRIORITY_CCA2 = ['AR', 'UY', 'CL', 'PY', 'BO', 'PE', 'EC', 'CO', 'VE', 'BR', 'MX', 'ES'];

function buildCountryOptions(): CountryOption[] {
  const all: CountryOption[] = worldCountries
    .filter((c) => c.idd?.root)
    .map((c) => ({
      code: `${c.idd.root}${c.idd.suffixes?.[0] ?? ''}`,
      cca2: c.cca2,
      flag: c.flag,
      name: c.translations.spa?.common ?? c.name.common,
      nameEn: c.name.common,
    }));

  const byCca2 = new Map(all.map((c) => [c.cca2, c]));
  const priority = PRIORITY_CCA2.map((cca2) => byCca2.get(cca2)).filter((c): c is CountryOption => !!c);
  const rest = all
    .filter((c) => !PRIORITY_CCA2.includes(c.cca2))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return [...priority, ...rest];
}

/** Listado estándar ISO de países (LATAM + España primero), con código de marcado y bandera. */
export const COUNTRY_CODES: CountryOption[] = buildCountryOptions();

export const EXERCISE_HABITS = [
  'Nunca hice ejercicio regularmente',
  'Solía hacer ejercicio regularmente',
  'Actualmente hago ejercicio regularmente',
] as const;

export const WEEKLY_FREQUENCY = [
  '1-3 días a la semana',
  '4-5 días a la semana',
  '6-7 días a la semana',
  'A decisión del entrenador',
] as const;

export const TRAINING_DAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

export const EQUIPMENT_OPTIONS = [
  'Pesas (mancuernas/barra)',
  'Máquinas de gimnasio',
  'Bandas de resistencia',
  'Kettlebells',
  'Bandas TRX',
  'Solo peso corporal',
] as const;

export const ONBOARDING_STEPS = [
  { key: 'profile',  title: 'SOBRE VOS',          subtitle: 'DATOS DE CONTACTO Y UBICACIÓN' },
  { key: 'body',     title: 'TU CUERPO',          subtitle: 'TU ENTRENADOR USA ESTO PARA ARMAR TU PLAN' },
  { key: 'training', title: 'TU ENTRENAMIENTO',   subtitle: 'OBJETIVOS, NIVEL Y HÁBITOS ACTUALES' },
  { key: 'details',  title: 'DETALLES',           subtitle: 'DISPONIBILIDAD, EQUIPAMIENTO Y SALUD' },
] as const;
