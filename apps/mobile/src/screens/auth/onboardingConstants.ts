/** Opciones alineadas con Plan Base (Notion) y el formulario de consulta del panel web. */

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

/** Códigos de país para el dropdown de teléfono (LATAM primero). */
export const COUNTRY_CODES = [
  { code: '+54',  flag: '🇦🇷', name: 'Argentina' },
  { code: '+598', flag: '🇺🇾', name: 'Uruguay' },
  { code: '+56',  flag: '🇨🇱', name: 'Chile' },
  { code: '+595', flag: '🇵🇾', name: 'Paraguay' },
  { code: '+591', flag: '🇧🇴', name: 'Bolivia' },
  { code: '+51',  flag: '🇵🇪', name: 'Perú' },
  { code: '+593', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+57',  flag: '🇨🇴', name: 'Colombia' },
  { code: '+58',  flag: '🇻🇪', name: 'Venezuela' },
  { code: '+55',  flag: '🇧🇷', name: 'Brasil' },
  { code: '+52',  flag: '🇲🇽', name: 'México' },
  { code: '+1',   flag: '🇺🇸', name: 'EE.UU. / Canadá' },
  { code: '+34',  flag: '🇪🇸', name: 'España' },
  { code: '+39',  flag: '🇮🇹', name: 'Italia' },
  { code: '+44',  flag: '🇬🇧', name: 'Reino Unido' },
] as const;

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
