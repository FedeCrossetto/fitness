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
  { key: 'profile', title: 'Sobre vos', subtitle: 'Datos de contacto y perfil.' },
  { key: 'body', title: 'Tu cuerpo', subtitle: 'Tu entrenador usa esto para armar tu plan.' },
  { key: 'training', title: 'Tu entrenamiento', subtitle: 'Objetivos, nivel y hábitos actuales.' },
  { key: 'details', title: 'Detalles', subtitle: 'Disponibilidad, equipamiento y salud.' },
] as const;
