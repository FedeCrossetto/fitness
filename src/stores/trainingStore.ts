import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { staleWhileRevalidate } from '../lib/cache';
import { todayISO } from '../lib/dates';
import { clientConfig } from '../config/clientConfig';
import type {
  ExerciseRow,
  TrainingDayRow,
  TrainingPhaseRow,
  WorkoutExerciseRow,
  WorkoutLogRow,
  WorkoutRow,
} from '../types/database';

export interface PhaseWithDays extends TrainingPhaseRow {
  days: (TrainingDayRow & { workout: WorkoutRow | null })[];
}

export interface WorkoutWithExercises extends WorkoutRow {
  exercises: (WorkoutExerciseRow & { exercise: ExerciseRow })[];
}

export interface ActiveSession {
  workoutId: string;
  workoutTitle: string;
  /** epoch ms de inicio: el timer sobrevive a cierres de app */
  startedAt: number;
  completedExerciseIds: string[];
  notes: string;
  rpe: number | null;
  heartRate: number | null;
  calories: number | null;
}

const ACTIVE_SESSION_KEY = 'habito:activeSession';

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

  loadProgram: () => Promise<void>;
  loadWorkoutDetail: (workoutId: string) => Promise<void>;
  restoreActiveSession: () => Promise<void>;
  startSession: (workoutId: string, workoutTitle: string) => Promise<void>;
  toggleExerciseDone: (exerciseRowId: string) => void;
  updateSessionMeta: (data: Partial<Pick<ActiveSession, 'notes' | 'rpe' | 'heartRate' | 'calories'>>) => void;
  finishSession: (userId: string) => Promise<WorkoutLogRow | null>;
  discardSession: () => Promise<void>;
  logCardio: (
    userId: string,
    data: { activity: string; distance: number; distanceUnit: string; durationSeconds: number }
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

  loadProgram: async () => {
    set({ phasesLoading: true, phasesError: null });
    try {
      await staleWhileRevalidate<PhaseWithDays[]>(
        `training:program:${clientConfig.programKey}`,
        async () => {
          const { data: phases, error } = await supabase
            .from('training_phases')
            .select('*')
            .eq('program_key', clientConfig.programKey)
            .eq('is_active', true)
            .order('sort_order');
          if (error) throw error;

          const phaseIds = phases.map((p) => p.id);
          if (phaseIds.length === 0) return [];

          const { data: days, error: daysError } = await supabase
            .from('training_days')
            .select('*, workout:workouts(*)')
            .in('phase_id', phaseIds)
            .order('day_number')
            .overrideTypes<PhaseWithDays['days'], { merge: false }>();
          if (daysError) throw daysError;

          return phases.map((phase) => ({
            ...phase,
            days: (days ?? []).filter((d) => d.phase_id === phase.id),
          }));
        },
        (data) => set({ phases: data, phasesLoading: false })
      );
    } catch {
      set({ phasesLoading: false, phasesError: 'No pudimos cargar tu programa.' });
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
      set({
        workoutDetail: {
          ...workoutRes.data,
          exercises: exercisesRes.data ?? [],
        },
        detailLoading: false,
      });
    } catch {
      set({ detailLoading: false, detailError: 'No pudimos cargar la rutina.' });
    }
  },

  restoreActiveSession: async () => {
    try {
      const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
      if (raw) set({ activeSession: JSON.parse(raw) as ActiveSession });
    } catch {
      // sesión no restaurable
    }
  },

  startSession: async (workoutId, workoutTitle) => {
    const session: ActiveSession = {
      workoutId,
      workoutTitle,
      startedAt: Date.now(),
      completedExerciseIds: [],
      notes: '',
      rpe: null,
      heartRate: null,
      calories: null,
    };
    set({ activeSession: session });
    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  },

  toggleExerciseDone: (exerciseRowId) => {
    const session = get().activeSession;
    if (!session) return;
    const done = session.completedExerciseIds.includes(exerciseRowId);
    const updated: ActiveSession = {
      ...session,
      completedExerciseIds: done
        ? session.completedExerciseIds.filter((id) => id !== exerciseRowId)
        : [...session.completedExerciseIds, exerciseRowId],
    };
    set({ activeSession: updated });
    void AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(updated));
  },

  updateSessionMeta: (data) => {
    const session = get().activeSession;
    if (!session) return;
    const updated = { ...session, ...data };
    set({ activeSession: updated });
    void AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(updated));
  },

  finishSession: async (userId) => {
    const session = get().activeSession;
    if (!session) return null;
    const elapsedSeconds = Math.floor((Date.now() - session.startedAt) / 1000);
    try {
      const { data, error } = await supabase
        .from('workout_logs')
        .insert({
          user_id: userId,
          date: todayISO(),
          workout_name: session.workoutTitle,
          workout_type: 'fuerza',
          duration_min: Math.max(1, Math.round(elapsedSeconds / 60)),
          elapsed_seconds: elapsedSeconds,
          completed_exercises: session.completedExerciseIds,
          rpe: session.rpe,
          comments: session.notes || null,
          completed: true,
        })
        .select()
        .single();
      if (error) throw error;
      set({ activeSession: null, lastSavedLog: data });
      await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
      return data;
    } catch {
      return null;
    }
  },

  discardSession: async () => {
    set({ activeSession: null });
    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
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
      });
      if (error) throw error;
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
            .order('date', { ascending: false })
            .limit(20);
          if (error) throw error;
          return data;
        },
        (data) => set({ recentLogs: data, logsLoading: false })
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
