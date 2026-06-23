import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutSessionDetail } from '@reset-fitness/shared';
import { supabase } from '../lib/supabase';
import { staleWhileRevalidate } from '../lib/cache';
import { todayISO } from '../lib/dates';
import { defaultClientConfig } from '../config/clientConfig';
import { useAuthStore } from './authStore';
import { useBrandingStore } from './brandingStore';
import { useUiStore } from './uiStore';
import {
  addExerciseToSession,
  addSetToExercise,
  buildFinishPayload,
  buildSessionExercises,
  clearActiveRest,
  normalizeStoredSession,
  startRestAfterSet,
  toggleSessionRestEnabled,
  type ActiveSession,
  updateExerciseNotes,
  updateSetInSession,
} from '../lib/trainingSession';
import {
  startLiveWorkout,
  updateLiveWorkout,
  endLiveWorkout,
  buildLiveWorkoutState,
} from '../services/liveActivity';
import { useGoalsStore } from './goalsStore';
import type {
  ExerciseRow,
  TrainingDayRow,
  TrainingPhaseRow,
  WorkoutExerciseRow,
  WorkoutLogRow,
  WorkoutRow,
} from '../types/database';

export type { ActiveSession };

export interface WorkoutWithCover extends WorkoutRow {
  cover_image_url: string | null;
}

async function syncTrainingGoal(userId: string): Promise<void> {
  const goalsStore = useGoalsStore.getState();
  await goalsStore.loadToday(userId);
  await goalsStore.syncAutoGoal(userId, 'training', 1);
}

export interface PhaseWithDays extends TrainingPhaseRow {
  days: (TrainingDayRow & { workout: WorkoutWithCover | null })[];
}

export interface WorkoutWithExercises extends WorkoutRow {
  exercises: (WorkoutExerciseRow & { exercise: ExerciseRow })[];
}

const ACTIVE_SESSION_KEY = 'reset-fitness:activeSession';

function resolveProgramKey(): string {
  const assigned = useAuthStore.getState().profile?.assigned_program_key;
  if (assigned) return assigned;
  return useBrandingStore.getState().branding?.default_program_key ?? defaultClientConfig.programKey;
}

function liveStateFrom(session: ActiveSession) {
  return buildLiveWorkoutState(session);
}

async function persistSession(session: ActiveSession | null): Promise<void> {
  if (!session) {
    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    return;
  }
  await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
}

async function fetchPreviousLogs(userId: string): Promise<{ session_detail: WorkoutSessionDetail | null }[]> {
  const { data } = await supabase
    .from('workout_logs')
    .select('session_detail')
    .eq('user_id', userId)
    .eq('workout_type', 'fuerza')
    .not('session_detail', 'is', null)
    .order('created_at', { ascending: false })
    .limit(12);
  return (data ?? []) as { session_detail: WorkoutSessionDetail | null }[];
}

interface TrainingState {
  phases: PhaseWithDays[];
  phasesLoading: boolean;
  phasesError: string | null;

  workoutDetail: WorkoutWithExercises | null;
  detailLoading: boolean;
  detailError: string | null;

  activeSession: ActiveSession | null;
  lastSavedLog: WorkoutLogRow | null;

  recentLogs: WorkoutLogRow[];
  logsLoading: boolean;

  customWorkouts: WorkoutWithCover[];
  customLoading: boolean;

  loadProgram: () => Promise<void>;
  loadCustomWorkouts: (userId: string) => Promise<void>;
  createCustomWorkout: (userId: string, title?: string) => Promise<WorkoutRow | null>;
  addExerciseToCustomWorkout: (
    userId: string,
    workoutId: string,
    exercise: Pick<ExerciseRow, 'id' | 'name' | 'image_url'>,
    sortOrder: number,
  ) => Promise<string | null>;
  loadWorkoutDetail: (workoutId: string) => Promise<void>;
  restoreActiveSession: () => Promise<void>;
  startSession: (userId: string, workoutId: string, workoutTitle: string) => Promise<void>;
  updateSet: (
    workoutExerciseId: string,
    setId: string,
    patch: Partial<{ weightKg: number | null; reps: number | null; completed: boolean }>,
  ) => void;
  addSet: (workoutExerciseId: string) => void;
  setExerciseNotes: (workoutExerciseId: string, notes: string) => void;
  toggleRestEnabled: () => void;
  skipRest: () => void;
  searchExercises: (query: string) => Promise<Pick<ExerciseRow, 'id' | 'name' | 'image_url' | 'target_muscles'>[]>;
  addExerciseToSession: (userId: string, exercise: Pick<ExerciseRow, 'id' | 'name' | 'image_url'>) => Promise<void>;
  updateSessionMeta: (data: Partial<Pick<ActiveSession, 'notes' | 'rpe' | 'heartRate' | 'calories'>>) => void;
  finishSession: (userId: string) => Promise<WorkoutLogRow | null>;
  discardSession: () => Promise<void>;
  logCardio: (
    userId: string,
    data: { activity: string; distance: number; distanceUnit: string; durationSeconds: number },
  ) => Promise<boolean>;
  loadRecentLogs: (userId: string) => Promise<void>;
  loadLogById: (logId: string) => Promise<WorkoutLogRow | null>;
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  phases: [],
  phasesLoading: false,
  phasesError: null,
  workoutDetail: null,
  detailLoading: false,
  detailError: null,
  activeSession: null,
  lastSavedLog: null,
  recentLogs: [],
  logsLoading: false,
  customWorkouts: [],
  customLoading: false,

  loadProgram: async () => {
    const programKey = resolveProgramKey();
    set({ phasesLoading: true, phasesError: null });
    try {
      await staleWhileRevalidate<PhaseWithDays[]>(
        `training:program:${programKey}`,
        async () => {
          const { data: phases, error } = await supabase
            .from('training_phases')
            .select('*')
            .eq('program_key', programKey)
            .eq('is_active', true)
            .order('sort_order');
          if (error) throw error;

          const phaseIds = phases.map((p) => p.id);
          if (phaseIds.length === 0) return [];

          const { data: days, error: daysError } = await supabase
            .from('training_days')
            .select(
              '*, workout:workouts(*, exercises:workout_exercises(sort_order, exercise:exercises(image_url)))',
            )
            .in('phase_id', phaseIds)
            .order('day_number');
          if (daysError) throw daysError;

          type RawCoverEx = { sort_order: number; exercise: { image_url: string | null } | null };
          type RawDay = TrainingDayRow & {
            workout: (WorkoutRow & { exercises: RawCoverEx[] }) | null;
          };

          const mappedDays = ((days ?? []) as unknown as RawDay[]).map((d) => {
            const workout: WorkoutWithCover | null = d.workout
              ? {
                  ...d.workout,
                  cover_image_url:
                    [...(d.workout.exercises ?? [])]
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .find((e) => e.exercise?.image_url)?.exercise?.image_url ?? null,
                }
              : null;
            return { ...d, workout } as PhaseWithDays['days'][number];
          });

          return phases.map((phase) => ({
            ...phase,
            days: mappedDays.filter((d) => d.phase_id === phase.id),
          }));
        },
        (data) => set({ phases: data, phasesLoading: false }),
      );
    } catch {
      set({ phasesLoading: false, phasesError: 'No pudimos cargar tu programa.' });
      useUiStore.getState().showToast('error', 'No pudimos cargar tu programa.');
    }
  },

  loadCustomWorkouts: async (userId) => {
    set({ customLoading: true });
    try {
      const { data, error } = await supabase
        .from('workouts')
        .select('*, exercises:workout_exercises(sort_order, exercise:exercises(image_url))')
        .eq('client_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;

      type RawCoverEx = { sort_order: number; exercise: { image_url: string | null } | null };
      type RawWorkout = WorkoutRow & { exercises: RawCoverEx[] };

      const mapped = ((data ?? []) as unknown as RawWorkout[]).map((workout) => ({
        ...workout,
        cover_image_url:
          [...(workout.exercises ?? [])]
            .sort((a, b) => a.sort_order - b.sort_order)
            .find((e) => e.exercise?.image_url)?.exercise?.image_url ?? null,
      }));

      set({ customWorkouts: mapped, customLoading: false });
    } catch {
      set({ customLoading: false });
    }
  },

  createCustomWorkout: async (userId, title) => {
    const workoutTitle = title?.trim();
    if (!workoutTitle) return null;
    try {
      const { data, error } = await supabase
        .from('workouts')
        .insert({
          client_id: userId,
          title: workoutTitle,
          workout_type: 'fuerza',
        })
        .select()
        .single();
      if (error) throw error;
      const created = data as WorkoutRow;
      set((state) => ({
        customWorkouts: [{ ...created, cover_image_url: null }, ...state.customWorkouts],
      }));
      return created;
    } catch {
      useUiStore.getState().showToast('error', 'No pudimos crear la rutina.');
      return null;
    }
  },

  addExerciseToCustomWorkout: async (_userId, workoutId, exercise, sortOrder) => {
    try {
      const { data, error } = await supabase
        .from('workout_exercises')
        .insert({
          workout_id: workoutId,
          exercise_id: exercise.id,
          sort_order: sortOrder,
          sets: 3,
          reps: '10',
          rest_seconds: 90,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    } catch {
      useUiStore.getState().showToast('error', 'No pudimos agregar el ejercicio.');
      return null;
    }
  },

  loadWorkoutDetail: async (workoutId) => {
    set({ detailLoading: true, detailError: null, workoutDetail: null });
    try {
      const [workoutRes, exercisesRes] = await Promise.all([
        supabase.from('workouts').select('*').eq('id', workoutId).single(),
        supabase
          .from('workout_exercises')
          .select('*, exercise:exercises(*)')
          .eq('workout_id', workoutId)
          .order('sort_order')
          .overrideTypes<WorkoutWithExercises['exercises'], { merge: false }>(),
      ]);
      if (workoutRes.error) throw workoutRes.error;
      if (exercisesRes.error) throw exercisesRes.error;
      const detail: WorkoutWithExercises = {
        ...workoutRes.data,
        exercises: exercisesRes.data ?? [],
      };
      set({ workoutDetail: detail, detailLoading: false });
      const active = get().activeSession;
      if (active?.workoutId === detail.id) {
        void updateLiveWorkout(liveStateFrom(active));
      }
    } catch {
      set({ detailLoading: false, detailError: 'No pudimos cargar la rutina.' });
    }
  },

  restoreActiveSession: async () => {
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      const session = normalizeStoredSession(parsed, get().workoutDetail);
      if (!session) {
        await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
        return;
      }
      set({ activeSession: session });
      void startLiveWorkout(liveStateFrom(session));
    } catch {
      // sesión no restaurable
    }
  },

  startSession: async (userId, workoutId, workoutTitle) => {
    let detail = get().workoutDetail;
    if (!detail || detail.id !== workoutId) {
      await get().loadWorkoutDetail(workoutId);
      detail = get().workoutDetail;
    }
    if (!detail) return;

    const previousLogs = await fetchPreviousLogs(userId);
    const exercises = await buildSessionExercises(detail, previousLogs);
    const session: ActiveSession = {
      workoutId,
      workoutTitle,
      isCustomWorkout: detail.client_id === userId,
      startedAt: Date.now(),
      exercises,
      notes: '',
      rpe: null,
      heartRate: null,
      calories: null,
      restEnabled: true,
      activeRest: null,
    };
    set({ activeSession: session });
    await persistSession(session);
    void startLiveWorkout(liveStateFrom(session));
  },

  updateSet: (workoutExerciseId, setId, patch) => {
    const session = get().activeSession;
    if (!session) return;
    let updated = updateSetInSession(session, workoutExerciseId, setId, patch);
    if (patch.completed === true) {
      updated = startRestAfterSet(updated, workoutExerciseId);
    } else if (patch.completed === false && updated.activeRest?.workoutExerciseId === workoutExerciseId) {
      updated = clearActiveRest(updated);
    }
    set({ activeSession: updated });
    void persistSession(updated);
    void updateLiveWorkout(liveStateFrom(updated));
  },

  addSet: (workoutExerciseId) => {
    const session = get().activeSession;
    if (!session) return;
    const updated = addSetToExercise(session, workoutExerciseId);
    set({ activeSession: updated });
    void persistSession(updated);
    void updateLiveWorkout(liveStateFrom(updated));
  },

  setExerciseNotes: (workoutExerciseId, notes) => {
    const session = get().activeSession;
    if (!session) return;
    const updated = updateExerciseNotes(session, workoutExerciseId, notes);
    set({ activeSession: updated });
    void persistSession(updated);
  },

  toggleRestEnabled: () => {
    const session = get().activeSession;
    if (!session) return;
    const updated = toggleSessionRestEnabled(session);
    set({ activeSession: updated });
    void persistSession(updated);
  },

  skipRest: () => {
    const session = get().activeSession;
    if (!session) return;
    const updated = clearActiveRest(session);
    set({ activeSession: updated });
    void persistSession(updated);
  },

  searchExercises: async (query) => {
    let request = supabase
      .from('exercises')
      .select('id, name, image_url, target_muscles')
      .order('name')
      .limit(40);
    if (query.trim()) {
      request = request.ilike('name', `%${query.trim()}%`);
    }
    const { data } = await request;
    return (data ?? []) as Pick<ExerciseRow, 'id' | 'name' | 'image_url' | 'target_muscles'>[];
  },

  addExerciseToSession: async (userId, exercise) => {
    const session = get().activeSession;
    if (!session || !session.isCustomWorkout) return;
    if (session.exercises.some((item) => item.exerciseId === exercise.id)) return;

    let persistedId: string | undefined;
    const workoutExerciseId = await get().addExerciseToCustomWorkout(
      userId,
      session.workoutId,
      exercise,
      session.exercises.length,
    );
    if (!workoutExerciseId) return;
    persistedId = workoutExerciseId;

    const previousLogs = await fetchPreviousLogs(userId);
    const updated = addExerciseToSession(session, exercise, previousLogs, persistedId);
    set({ activeSession: updated });
    await persistSession(updated);
    void updateLiveWorkout(liveStateFrom(updated));
  },

  updateSessionMeta: (data) => {
    const session = get().activeSession;
    if (!session) return;
    const updated = { ...session, ...data };
    set({ activeSession: updated });
    void persistSession(updated);
  },

  finishSession: async (userId) => {
    const session = get().activeSession;
    if (!session) return null;
    const elapsedSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
    try {
      const { data, error } = await supabase
        .from('workout_logs')
        .insert(buildFinishPayload(session, userId, elapsedSeconds))
        .select()
        .single();
      if (error) throw error;
      set({ activeSession: null, lastSavedLog: data });
      await persistSession(null);
      void endLiveWorkout();
      void syncTrainingGoal(userId);
      void get().loadRecentLogs(userId);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No pudimos guardar el entreno.';
      useUiStore.getState().showToast('error', message);
      return null;
    }
  },

  discardSession: async () => {
    set({ activeSession: null });
    await persistSession(null);
    void endLiveWorkout();
  },

  logCardio: async (userId, { activity, distance, distanceUnit, durationSeconds }) => {
    try {
      const { error } = await supabase.from('workout_logs').insert({
        user_id: userId,
        date: todayISO(),
        workout_name: activity,
        workout_type: 'cardio',
        cardio_activity: activity,
        distance,
        distance_unit: distanceUnit,
        duration_seconds: durationSeconds,
        duration_min: Math.max(1, Math.round(durationSeconds / 60)),
        completed: true,
        completed_sets: 0,
      });
      if (error) throw error;
      void syncTrainingGoal(userId);
      void get().loadRecentLogs(userId);
      return true;
    } catch {
      return false;
    }
  },

  loadRecentLogs: async (userId) => {
    set({ logsLoading: true });
    try {
      await staleWhileRevalidate<WorkoutLogRow[]>(
        `training:logs:${userId}`,
        async () => {
          const { data, error } = await supabase
            .from('workout_logs')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);
          if (error) throw error;
          return data;
        },
        (data) => set({ recentLogs: data, logsLoading: false }),
      );
    } catch {
      set({ logsLoading: false });
    }
  },

  loadLogById: async (logId) => {
    const local = get().lastSavedLog;
    if (local?.id === logId) return local;
    const { data } = await supabase.from('workout_logs').select('*').eq('id', logId).maybeSingle();
    return data ?? null;
  },
}));
