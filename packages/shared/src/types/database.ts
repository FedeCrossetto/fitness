/**
 * Tipos de la base de datos Supabase (espejo de supabase/migrations).
 * Mantener sincronizado con el esquema SQL.
 */

import type { ServingUnit } from '../nutrition/servingUnits';
import type { WorkoutSessionDetail } from '../training/workoutSession';

export type { ServingUnit };

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'client' | 'trainer' | 'admin';
export type GoalType = 'hydration' | 'steps' | 'training' | 'meals' | 'custom';
export type GoalUnit = 'ml' | 'steps' | 'minutes' | 'meals' | 'boolean';
export type WorkoutType = 'fuerza' | 'cardio' | 'descanso' | 'movilidad' | 'tecnica';
export type MealType = 'DES' | 'ALM' | 'MER' | 'CEN' | 'COL';
export type FoodSource = 'manual' | 'voice' | 'barcode' | 'openfoodfacts' | 'import';
export type MacroSource = 'openfoodfacts' | 'manual' | 'user_food' | 'catalog' | 'voice' | 'barcode';
export type PhotoPosition = 'frente' | 'perfil' | 'espalda';
export type SubscriptionStatus = 'pending' | 'active' | 'expired' | 'cancelled' | 'paused';
export type SenderRole = 'client' | 'trainer';
export type PlanId = 'monthly' | 'quarterly' | 'semiannual';

export interface ProfileRow {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  goal: string | null;
  role: UserRole;
  trainer_id: string | null;
  client_status: 'active' | 'pending';
  locale: string;
  /** Programa de entrenamiento asignado por el coach (training_phases.program_key). */
  assigned_program_key: string | null;
  /** Momento de creación de cuenta = aceptación implícita de los Términos y
   * Condiciones (sin checkbox — ver TERMS_VERSION en legal/termsAndConditions.ts).
   * Null para cuentas creadas antes de que este registro existiera. */
  terms_accepted_at: string | null;
  terms_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfileRow {
  id: string;
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  level: string;
  plan_name: string | null;
  plan_duration_weeks: number | null;
  plan_current_week: number;
  created_at: string;
  updated_at: string;
}

export interface GoalTemplateRow {
  id: string;
  title: string;
  goal_type: GoalType;
  target_value: number;
  target_unit: GoalUnit;
  icon: string | null;
  color: string | null;
  is_active: boolean | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface GoalAssignmentRow {
  id: string;
  user_id: string;
  assigned_by: string | null;
  template_id: string | null;
  title: string;
  goal_type: GoalType;
  target_value: number;
  target_unit: GoalUnit;
  icon: string | null;
  color: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyGoalRow {
  id: string;
  user_id: string;
  date: string;
  text: string;
  goal_type: GoalType | null;
  target_value: number | null;
  current_value: number | null;
  target_unit: GoalUnit | null;
  auto_track: boolean | null;
  template_id: string | null;
  completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface WorkoutLogRow {
  id: string;
  user_id: string;
  date: string;
  workout_name: string;
  workout_type: string | null;
  workout_id: string | null;
  duration_min: number | null;
  rpe: number | null;
  comments: string | null;
  completed: boolean;
  elapsed_seconds: number | null;
  completed_exercises: string[] | null;
  session_detail: WorkoutSessionDetail | null;
  total_volume_kg: number | null;
  completed_sets: number;
  cardio_activity: string | null;
  distance: number | null;
  distance_unit: string | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseRow {
  id: string;
  external_source: string | null;
  external_id: string | null;
  slug: string | null;
  name: string;
  body_part: string | null;
  body_parts: string[] | null;
  target_muscles: string[] | null;
  secondary_muscles: string[] | null;
  equipment: string[] | null;
  exercise_type: string | null;
  image_url: string | null;
  video_url: string | null;
  instructions: string[] | null;
  metadata: Json;
  created_at: string;
  updated_at: string;
}

export interface ProgramFolderRow {
  id: string;
  trainer_id: string;
  name: string;
  created_at: string;
}

/** Metadata de un programa de la Librería. Por debajo sigue siendo un grupo
 * de `training_phases` con `program_key === this.program_key` — ver comentario
 * en la migración 20260708010000_program_library.sql. */
export interface ProgramRow {
  id: string;
  trainer_id: string;
  program_key: string;
  name: string;
  note: string | null;
  duration_weeks: number | null;
  start_date: string | null;
  /** null = plantilla compartida; con valor = clon personalizado de ese cliente. */
  client_id: string | null;
  /** Si es un clon personalizado, el programa plantilla del que se copió. */
  source_program_id: string | null;
  folder_id: string | null;
  /** Orden manual en la Biblioteca (drag & drop). Menor = primero. */
  sort_order: number;
  /** Si tiene valor, se archivó (p.ej. al asignar otro programa sin fecha) y no compite por ser el "activo hoy". */
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutLikeRow {
  id: string;
  workout_log_id: string;
  author_id: string;
  created_at: string;
}

export interface WorkoutCommentRow {
  id: string;
  workout_log_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ClientCoachNotesRow {
  client_id: string;
  trainer_id: string;
  notes: string | null;
  updated_at: string;
}

export interface TrainingPhaseRow {
  id: string;
  program_key: string | null;
  trainer_id: string | null;
  phase_number: number;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkoutRow {
  id: string;
  trainer_id: string | null;
  /** Rutina personalizada del alumno (no forma parte del plan del entrenador). */
  client_id: string | null;
  title: string;
  workout_type: WorkoutType;
  duration_min: number | null;
  blocks: number;
  calories_est: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutExerciseRow {
  id: string;
  workout_id: string;
  exercise_id: string;
  sort_order: number;
  sets: number;
  reps: string;
  weight_kg: number | null;
  tempo: string | null;
  rest_seconds: number | null;
  /** Sets individuales [{ reps, kg }] (editor de rutina estilo Hevy). Las
   * columnas sets/reps/weight_kg se mantienen como resumen. */
  sets_detail: WorkoutSet[];
  /** Nota fijada del ejercicio en la rutina. */
  notes: string | null;
  /** Superserie: los ejercicios adyacentes con el mismo id se ejecutan
   * alternando series. `null` = ejercicio suelto. */
  superset_group: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSet {
  reps: string | null;
  kg: number | null;
  /** RPE objetivo de la serie (6–10, en pasos de 0.5). `undefined` = el
   * ejercicio no tiene tracking de RPE activado; `null` = activado pero sin
   * valor elegido todavía. Se guarda dentro de `sets_detail` (JSONB), sin
   * columna propia. */
  rpe?: number | null;
}

export interface TrainingDayRow {
  id: string;
  phase_id: string;
  day_number: number;
  title: string;
  day_type: WorkoutType;
  workout_id: string | null;
  sort_order: number;
  /** Día de semana recurrente asignado (0=Lunes..6=Domingo), o null si no tiene uno fijo. */
  day_of_week: number | null;
  created_at: string;
  updated_at: string;
}

export type FoodSubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface TrainerFoodRow {
  id: string;
  trainer_id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  kcal_100g: number | null;
  protein_g_100g: number | null;
  carbs_g_100g: number | null;
  fat_g_100g: number | null;
  default_serving_grams: number | null;
  serving_unit: ServingUnit;
  icon_key: string | null;
  openfoodfacts_code: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FoodSubmissionRow {
  id: string;
  trainer_id: string;
  submitted_by: string;
  personal_food_id: string | null;
  trainer_food_id: string | null;
  status: FoodSubmissionStatus;
  name: string;
  brand: string | null;
  barcode: string | null;
  kcal_100g: number | null;
  protein_g_100g: number | null;
  carbs_g_100g: number | null;
  fat_g_100g: number | null;
  default_serving_grams: number | null;
  serving_unit: ServingUnit;
  icon_key: string | null;
  rejection_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FoodRow {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  kcal_100g: number | null;
  protein_g_100g: number | null;
  carbs_g_100g: number | null;
  fat_g_100g: number | null;
  default_serving_grams: number | null;
  serving_unit: ServingUnit;
  source: FoodSource;
  openfoodfacts_code: string | null;
  voice_transcript: string | null;
  is_favorite: boolean;
  icon_key: string | null;
  trainer_food_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MealLogRow {
  id: string;
  user_id: string;
  date: string;
  meal_type: MealType;
  title: string | null;
  photo_url: string | null;
  food_id: string | null;
  trainer_food_id: string | null;
  openfoodfacts_code: string | null;
  product_display_name: string | null;
  macro_source: MacroSource | null;
  portion_grams: number | null;
  portion_unit: ServingUnit;
  energy_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  is_included: boolean;
  icon_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface FoodImageRow {
  id: string;
  key: string;
  name: string | null;
  image_url: string;
  created_at: string;
}

export interface HydrationLogRow {
  id: string;
  user_id: string;
  date: string;
  total_ml: number;
  goal_ml: number;
  created_at: string;
  updated_at: string;
}

export interface BodyMeasurementRow {
  id: string;
  user_id: string;
  date: string;
  gender: 'male' | 'female' | null;
  weight_kg: number | null;
  body_fat_pct: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hips_cm: number | null;
  arms_cm: number | null;
  legs_cm: number | null;
  // Medidas ampliadas (estilo Hevy).
  abdomen_cm: number | null;
  neck_cm: number | null;
  shoulder_cm: number | null;
  left_bicep_cm: number | null;
  right_bicep_cm: number | null;
  left_forearm_cm: number | null;
  right_forearm_cm: number | null;
  left_thigh_cm: number | null;
  right_thigh_cm: number | null;
  left_calf_cm: number | null;
  right_calf_cm: number | null;
  lean_body_mass_kg: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProgressPhotoRow {
  id: string;
  user_id: string;
  position: PhotoPosition;
  photo_url: string;
  week_number: number;
  recorded_at: string;
  created_at: string;
}

export interface PushTokenRow {
  id: string;
  user_id: string;
  expo_token: string;
  device_id: string | null;
  platform: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export type PlanType = 'base' | 'mentoria';

export interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  price_ars: number;
  duration_days: number;
  /** 'base' | 'mentoria' son los tipos built-in con lógica propia (gating de
   * mobile, formulario de consulta). Un entrenador puede crear tipos propios
   * desde /payments/planes — esos solo se gestionan/asignan a mano (Manage
   * Plans + pago manual), no aparecen en el selector de checkout de mobile. */
  plan_type: string;
  active: boolean | null;
  created_at: string;
  /** null = plan built-in (catálogo global). Si tiene valor, es una
   * frecuencia custom creada por ese entrenador — solo visible para
   * él/ella y sus alumnos. */
  trainer_id: string | null;
  /** Soft-delete: si tiene valor, la frecuencia ya no se ofrece en la
   * gestión ni en checkout nuevo, pero sigue existiendo para no romper
   * la FK de subscriptions ni la renovación de MercadoPago de quien ya
   * la tenía elegida. */
  deleted_at: string | null;
}

export interface TrainerPlanPriceRow {
  trainer_id: string;
  plan_id: string;
  price_ars: number;
  active: boolean;
  updated_at: string;
  /** Soft-delete por-entrenador de una frecuencia built-in: si tiene valor,
   * este entrenador la sacó de su oferta sin afectar el catálogo global. */
  deleted_at: string | null;
}

export interface TrainerPlanGroupSettingsRow {
  trainer_id: string;
  plan_type: string;
  /** Nombre custom para el grupo (ej. "Base" → "Plan Estándar"). Null = usar
   * el label por defecto. */
  display_name: string | null;
  active: boolean;
  /** Soft-delete del grupo completo (todas las frecuencias de ese plan_type
   * para este entrenador quedan ocultas en gestión y checkout). */
  deleted_at: string | null;
  updated_at: string;
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus | null;
  mp_payment_id: string | null;
  mp_preference_id: string | null;
  /** Id del contrato recurrente en MercadoPago (Preapproval). Null en
   * suscripciones de pago único (Preferencias) o pagos manuales. */
  mp_preapproval_id: string | null;
  mp_status: string | null;
  started_at: string | null;
  expires_at: string | null;
  locale: string | null;
  /** Monto realmente facturado — puede diferir de plans.price_ars por un override manual. Null en filas viejas. */
  amount_ars: number | null;
  /** Deep link de la app (ej. exp://…/--/pago) al que /pago/:result debe
   * redirigir tras el checkout de Preapproval. Null en pagos únicos/manuales. */
  client_return_url: string | null;
  created_at: string;
}

export interface RoutineRow {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  days_per_week: number | null;
  active: boolean | null;
  created_at: string;
}

export interface RoutineExerciseRow {
  id: string;
  routine_id: string;
  name: string;
  sets: number | null;
  reps: string | null;
  rest_secs: number | null;
  notes: string | null;
  order_index: number | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  client_id: string;
  content: string;
  sender_role: SenderRole;
  read: boolean | null;
  created_at: string;
}

export interface TrainerBrandingModules {
  training: boolean;
  nutrition: boolean;
  progress: boolean;
  goals: boolean;
  community: boolean;
  subscriptions: boolean;
  coachChat: boolean;
  achievements: boolean;
  healthKit: boolean;
}

export interface TrainerBrandingRow {
  trainer_id: string;
  app_name: string;
  invite_code: string;
  color_primary: string | null;
  color_accent: string | null;
  color_background: string | null;
  logo_url: string | null;
  splash_url: string | null;
  theme: Json | null;
  modules: TrainerBrandingModules;
  welcome_title: string | null;
  welcome_subtitle: string | null;
  onboarding_cta: string | null;
  default_program_key: string;
  created_at: string;
  updated_at: string;
}

export interface AutoMessageConfigRow {
  id: string;
  trainer_id: string;
  trigger_key: string;
  schedule: string;
  message: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommunityRow {
  id: string;
  trainer_id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  is_active: boolean;
  trainer_last_read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityMemberRow {
  id: string;
  community_id: string;
  user_id: string;
  role: 'member';
  last_read_at: string | null;
  joined_at: string;
}

export type CommunityMessageKind = 'user' | 'system' | 'auto';

export interface CommunityMessageRow {
  id: string;
  community_id: string;
  sender_id: string | null;
  content: string;
  kind: CommunityMessageKind;
  created_at: string;
}

export type AnnouncementTargetType = 'all_clients' | 'groups' | 'clients';
export type AnnouncementStatus = 'scheduled' | 'sent' | 'failed' | 'cancelled';

export interface AnnouncementRow {
  id: string;
  trainer_id: string;
  title: string | null;
  content: string;
  target_type: AnnouncementTargetType;
  target_ids: string[];
  send_at: string;
  status: AnnouncementStatus;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserTrophyDayRow {
  id: string;
  user_id: string;
  date: string;
  created_at: string;
}

export interface ConsultationFormConfigRow {
  id: string;
  trainer_id: string;
  form_code: string;
  plan_type: PlanType;
  updated_at: string;
}

/**
 * Convierte una interface en un object type anónimo. Las interfaces no son
 * asignables a `Record<string, unknown>` (TS las trata como aumentables), lo
 * que rompe la conformidad con `GenericSchema` de postgrest-js y colapsa
 * Insert/Update/Returns a `never`. El mapped type elimina ese problema.
 */
type Normalize<T> = { [K in keyof T]: T[K] };

type TableDef<Row, Required extends keyof Row = never> = {
  Row: Normalize<Row>;
  Insert: Normalize<Partial<Row> & Pick<Row, Extract<Required, keyof Row>>>;
  Update: Normalize<Partial<Row>>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<ProfileRow, 'id'>;
      user_profiles: TableDef<UserProfileRow, 'user_id'>;
      goal_templates: TableDef<GoalTemplateRow, 'title' | 'goal_type'>;
      goal_assignments: TableDef<GoalAssignmentRow, 'user_id' | 'title' | 'start_date' | 'end_date'>;
      daily_goals: TableDef<DailyGoalRow, 'user_id' | 'text'>;
      workout_logs: TableDef<WorkoutLogRow, 'user_id'>;
      exercises: TableDef<ExerciseRow, 'name'>;
      programs: TableDef<ProgramRow, 'trainer_id' | 'program_key' | 'name'>;
      program_folders: TableDef<ProgramFolderRow, 'trainer_id' | 'name'>;
      training_phases: TableDef<TrainingPhaseRow, 'name'>;
      workouts: TableDef<WorkoutRow, 'title'>;
      workout_exercises: TableDef<WorkoutExerciseRow, 'workout_id' | 'exercise_id'>;
      training_days: TableDef<TrainingDayRow, 'phase_id' | 'day_number' | 'title'>;
      foods: TableDef<FoodRow, 'user_id' | 'name' | 'source'>;
      trainer_foods: TableDef<TrainerFoodRow, 'trainer_id' | 'name'>;
      food_submissions: TableDef<FoodSubmissionRow, 'trainer_id' | 'submitted_by' | 'name'>;
      meal_logs: TableDef<MealLogRow, 'user_id' | 'meal_type'>;
      food_images: TableDef<FoodImageRow, 'key' | 'image_url'>;
      hydration_logs: TableDef<HydrationLogRow, 'user_id'>;
      body_measurements: TableDef<BodyMeasurementRow, 'user_id'>;
      progress_photos: TableDef<ProgressPhotoRow, 'user_id' | 'position' | 'photo_url' | 'week_number'>;
      push_tokens: TableDef<PushTokenRow, 'user_id' | 'expo_token'>;
      plans: TableDef<PlanRow, 'name' | 'price_ars' | 'duration_days' | 'plan_type'>;
      trainer_plan_prices: TableDef<TrainerPlanPriceRow, 'trainer_id' | 'plan_id' | 'price_ars'>;
      trainer_plan_group_settings: TableDef<TrainerPlanGroupSettingsRow, 'trainer_id' | 'plan_type'>;
      subscriptions: TableDef<SubscriptionRow, 'user_id' | 'plan_id'>;
      routines: TableDef<RoutineRow, 'client_id' | 'name'>;
      routine_exercises: TableDef<RoutineExerciseRow, 'routine_id' | 'name'>;
      messages: TableDef<MessageRow, 'client_id' | 'content' | 'sender_role'>;
      trainer_branding: TableDef<TrainerBrandingRow, 'trainer_id' | 'invite_code'>;
      auto_message_configs: TableDef<AutoMessageConfigRow, 'trainer_id' | 'trigger_key'>;
      consultation_form_configs: TableDef<ConsultationFormConfigRow, 'trainer_id'>;
      communities: TableDef<CommunityRow, 'trainer_id' | 'name'>;
      community_members: TableDef<CommunityMemberRow, 'community_id' | 'user_id'>;
      community_messages: TableDef<CommunityMessageRow, 'community_id' | 'content' | 'kind'>;
      announcements: TableDef<AnnouncementRow, 'trainer_id' | 'content' | 'target_type'>;
      user_trophy_days: TableDef<UserTrophyDayRow, 'user_id' | 'date'>;
      workout_likes: TableDef<WorkoutLikeRow, 'workout_log_id' | 'author_id'>;
      workout_comments: TableDef<WorkoutCommentRow, 'workout_log_id' | 'author_id' | 'body'>;
      client_coach_notes: TableDef<ClientCoachNotesRow, 'client_id' | 'trainer_id'>;
    };
    Views: Record<string, never>;
    Functions: {
      update_goal_progress: {
        Args: { p_user_id: string; p_date: string; p_goal_type: string; p_current_value: number };
        Returns: { goal_id: string; was_completed: boolean; is_now_completed: boolean }[];
      };
      assign_goals_for_date: {
        Args: { p_user_id: string; p_date: string };
        Returns: undefined;
      };
      get_invite_preview: {
        Args: { p_invite_code: string };
        Returns: Json;
      };
      link_client_by_invite_code: {
        Args: { p_invite_code: string };
        Returns: Json;
      };
      delete_client_account: {
        Args: { p_client_id: string };
        Returns: undefined;
      };
      try_send_auto_message: {
        Args: { p_client_id: string; p_trigger_key: string };
        Returns: boolean;
      };
      deliver_announcement: {
        Args: { p_announcement_id: string };
        Returns: boolean;
      };
      process_due_announcements: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_client_waiver_gate: {
        Args: Record<string, never>;
        Returns: Json;
      };
      save_client_waiver_signature: {
        Args: {
          p_trainer_id: string;
          p_full_name: string;
          p_signature_data: string;
          p_document_snapshot: string;
          p_document_title: string;
        };
        Returns: string;
      };
      get_client_image_consent_gate: {
        Args: Record<string, never>;
        Returns: Json;
      };
      get_client_image_consent_status: {
        Args: Record<string, never>;
        Returns: Json;
      };
      save_client_image_consent: {
        Args: {
          p_trainer_id: string;
          p_full_name: string;
          p_document_snapshot: string;
          p_document_title: string;
          p_signature_data?: string | null;
          p_status?: string;
        };
        Returns: string;
      };
      save_client_onboarding_intake: {
        Args: {
          p_phone: string;
          p_goal: string;
          p_level: string;
          p_gender: string | null;
          p_weight_kg: number | null;
          p_responses: Json;
        };
        Returns: undefined;
      };
      register_manual_payment: {
        Args: { p_client_id: string; p_plan_id: string; p_started_at?: string };
        Returns: string;
      };
      trainer_mp_connected: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_subscription_return_url: {
        Args: { p_id: string };
        Returns: string | null;
      };
      account_exists: {
        Args: { p_user_id: string };
        Returns: boolean;
      };
      clone_program: {
        Args: { p_program_id: string; p_new_name: string; p_client_id?: string | null };
        Returns: string;
      };
      resolve_active_program_key: {
        Args: { p_client_id: string };
        Returns: string | null;
      };
      get_my_active_program_key: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      i_have_ever_had_a_program: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      get_client_email: {
        Args: { p_client: string };
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
