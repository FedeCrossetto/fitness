import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { staleWhileRevalidate } from '../lib/cache';
import { deletePrivateImage } from '../services/storage';
import { todayISO } from '../lib/dates';
import { clientConfig } from '../config/clientConfig';
import type { BodyMeasurementRow, HydrationLogRow, PhotoPosition, ProgressPhotoRow } from '../types/database';

interface ProgressState {
  measurements: BodyMeasurementRow[];
  measurementsLoading: boolean;
  measurementsError: string | null;

  photos: ProgressPhotoRow[];
  photosLoading: boolean;

  hydrationToday: HydrationLogRow | null;
  hydrationLoading: boolean;

  steps: number;
  setSteps: (steps: number) => void;
  healthConnected: boolean;
  setHealthConnected: (v: boolean) => void;
  /** Oculta las fotos de progreso en el home (preferencia local). */
  homePhotosHidden: boolean;
  toggleHomePhotosHidden: () => void;

  loadMeasurements: (userId: string) => Promise<void>;
  saveMeasurement: (userId: string, data: Partial<BodyMeasurementRow>) => Promise<boolean>;
  loadPhotos: (userId: string) => Promise<void>;
  addPhoto: (userId: string, position: PhotoPosition, photoUrl: string, weekNumber: number) => Promise<boolean>;
  deletePhoto: (photoId: string, photoUrl: string) => Promise<boolean>;
  loadHydration: (userId: string) => Promise<void>;
  addWater: (userId: string, ml: number) => Promise<number | null>;
  setHydrationGoal: (userId: string, goalMl: number) => Promise<void>;
}

export const useProgressStore = create<ProgressState>()(
  persist(
    (set, get) => ({
  measurements: [],
  measurementsLoading: false,
  measurementsError: null,
  photos: [],
  photosLoading: false,
  hydrationToday: null,
  hydrationLoading: false,
  steps: 0,
  healthConnected: false,
  homePhotosHidden: false,

  setSteps: (steps) => set({ steps }),
  setHealthConnected: (v) => set({ healthConnected: v }),
  toggleHomePhotosHidden: () => set({ homePhotosHidden: !get().homePhotosHidden }),

  loadMeasurements: async (userId) => {
    set({ measurementsLoading: true, measurementsError: null });
    try {
      await staleWhileRevalidate<BodyMeasurementRow[]>(
        `progress:measurements:${userId}`,
        async () => {
          const { data, error } = await supabase
            .from('body_measurements')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(90);
          if (error) throw error;
          return data;
        },
        (data) => set({ measurements: data, measurementsLoading: false })
      );
    } catch {
      set({ measurementsLoading: false, measurementsError: 'No pudimos cargar tus medidas.' });
    }
  },

  saveMeasurement: async (userId, data) => {
    try {
      const { data: saved, error } = await supabase
        .from('body_measurements')
        .upsert({ ...data, user_id: userId, date: data.date ?? todayISO() }, { onConflict: 'user_id,date' })
        .select()
        .single();
      if (error) throw error;
      const rest = get().measurements.filter((m) => m.id !== saved.id);
      set({ measurements: [saved, ...rest].sort((a, b) => (a.date < b.date ? 1 : -1)) });
      return true;
    } catch {
      set({ measurementsError: 'No pudimos guardar la medición.' });
      return false;
    }
  },

  loadPhotos: async (userId) => {
    set({ photosLoading: true });
    try {
      const { data, error } = await supabase
        .from('progress_photos')
        .select('*')
        .eq('user_id', userId)
        .order('recorded_at', { ascending: false });
      if (error) throw error;
      set({ photos: data, photosLoading: false });
    } catch {
      set({ photosLoading: false });
    }
  },

  addPhoto: async (userId, position, photoUrl, weekNumber) => {
    try {
      const { data, error } = await supabase
        .from('progress_photos')
        .insert({ user_id: userId, position, photo_url: photoUrl, week_number: weekNumber, recorded_at: todayISO() })
        .select()
        .single();
      if (error) throw error;
      set({ photos: [data, ...get().photos] });
      return true;
    } catch {
      return false;
    }
  },

  deletePhoto: async (photoId, photoUrl) => {
    const previous = get().photos;
    // Optimista: la sacamos de la UI al instante.
    set({ photos: previous.filter((p) => p.id !== photoId) });
    try {
      const { error } = await supabase.from('progress_photos').delete().eq('id', photoId);
      if (error) throw error;
      await deletePrivateImage('progress-photos', photoUrl);
      return true;
    } catch {
      set({ photos: previous }); // revertir si falla
      return false;
    }
  },

  loadHydration: async (userId) => {
    set({ hydrationLoading: true });
    const date = todayISO();
    try {
      await staleWhileRevalidate<HydrationLogRow | null>(
        `hydration:${userId}:${date}`,
        async () => {
          const { data, error } = await supabase
            .from('hydration_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .maybeSingle();
          if (error) throw error;
          return data;
        },
        (data) => set({ hydrationToday: data, hydrationLoading: false })
      );
    } catch {
      set({ hydrationLoading: false });
    }
  },

  addWater: async (userId, ml) => {
    const current = get().hydrationToday;
    const totalMl = Math.max(0, (current?.total_ml ?? 0) + ml);
    const goalMl = current?.goal_ml ?? clientConfig.defaultHydrationGoalMl;
    try {
      const { data, error } = await supabase
        .from('hydration_logs')
        .upsert(
          { user_id: userId, date: todayISO(), total_ml: totalMl, goal_ml: goalMl },
          { onConflict: 'user_id,date' }
        )
        .select()
        .single();
      if (error) throw error;
      set({ hydrationToday: data });
      return data.total_ml;
    } catch {
      return null;
    }
  },

  setHydrationGoal: async (userId, goalMl) => {
    const current = get().hydrationToday;
    const { data } = await supabase
      .from('hydration_logs')
      .upsert(
        { user_id: userId, date: todayISO(), total_ml: current?.total_ml ?? 0, goal_ml: goalMl },
        { onConflict: 'user_id,date' }
      )
      .select()
      .single();
    if (data) set({ hydrationToday: data });
  },
    }),
    {
      name: 'habito-progress',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo persistimos la conexión a Salud; los pasos se re-leen frescos al abrir.
      partialize: (state) => ({
        healthConnected: state.healthConnected,
        homePhotosHidden: state.homePhotosHidden,
      }),
    },
  ),
);
