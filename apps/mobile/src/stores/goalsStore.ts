import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { staleWhileRevalidate } from '../lib/cache';
import { todayISO } from '../lib/dates';
import type { DailyGoalRow, GoalType, GoalUnit } from '../types/database';

interface GoalsState {
  goals: DailyGoalRow[];
  loading: boolean;
  error: string | null;

  loadToday: (userId: string) => Promise<void>;
  createGoal: (
    userId: string,
    data: { text: string; goalType: GoalType; targetValue: number; targetUnit: GoalUnit }
  ) => Promise<boolean>;
  updateGoal: (goalId: string, data: Partial<Pick<DailyGoalRow, 'text' | 'target_value' | 'target_unit'>>) => Promise<boolean>;
  deleteGoal: (goalId: string) => Promise<boolean>;
  toggleGoal: (goalId: string) => Promise<void>;
  /** Sincroniza una meta auto-trackeable con la actividad real (vía RPC). */
  syncAutoGoal: (userId: string, goalType: GoalType, currentValue: number) => Promise<boolean>;
  /** Actualiza la meta de comidas según los registros del día. */
  syncMealsGoal: (userId: string) => Promise<boolean>;
}

export const useGoalsStore = create<GoalsState>((set, get) => ({
  goals: [],
  loading: false,
  error: null,

  loadToday: async (userId) => {
    set({ loading: true, error: null });
    const date = todayISO();
    try {
      // Asegura que existan metas del día (asignaciones del coach o plantillas)
      await supabase.rpc('assign_goals_for_date', { p_user_id: userId, p_date: date });

      await staleWhileRevalidate<DailyGoalRow[]>(
        `goals:${userId}:${date}`,
        async () => {
          const { data, error } = await supabase
            .from('daily_goals')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .order('sort_order', { ascending: true });
          if (error) throw error;
          return data;
        },
        (data) => set({ goals: data, loading: false })
      );

      await get().syncMealsGoal(userId);
    } catch {
      set({ loading: false, error: 'No pudimos cargar tus metas de hoy.' });
    }
  },

  createGoal: async (userId, { text, goalType, targetValue, targetUnit }) => {
    try {
      const { data, error } = await supabase
        .from('daily_goals')
        .insert({
          user_id: userId,
          date: todayISO(),
          text,
          goal_type: goalType,
          target_value: targetValue,
          target_unit: targetUnit,
          auto_track: goalType !== 'custom',
          sort_order: get().goals.length,
        })
        .select()
        .single();
      if (error) throw error;
      set({ goals: [...get().goals, data] });
      return true;
    } catch {
      set({ error: 'No pudimos crear la meta.' });
      return false;
    }
  },

  updateGoal: async (goalId, data) => {
    try {
      const { data: updated, error } = await supabase
        .from('daily_goals')
        .update(data)
        .eq('id', goalId)
        .select()
        .single();
      if (error) throw error;
      set({ goals: get().goals.map((g) => (g.id === goalId ? updated : g)) });
      return true;
    } catch {
      set({ error: 'No pudimos actualizar la meta.' });
      return false;
    }
  },

  deleteGoal: async (goalId) => {
    const previous = get().goals;
    set({ goals: previous.filter((g) => g.id !== goalId) });
    const { error } = await supabase.from('daily_goals').delete().eq('id', goalId);
    if (error) {
      set({ goals: previous, error: 'No pudimos eliminar la meta.' });
      return false;
    }
    return true;
  },

  toggleGoal: async (goalId) => {
    const goal = get().goals.find((g) => g.id === goalId);
    if (!goal) return;
    const completed = !goal.completed;
    // Optimista
    set({ goals: get().goals.map((g) => (g.id === goalId ? { ...g, completed } : g)) });
    const { error } = await supabase.from('daily_goals').update({ completed }).eq('id', goalId);
    if (error) {
      set({ goals: get().goals.map((g) => (g.id === goalId ? { ...g, completed: !completed } : g)) });
    }
  },

  syncAutoGoal: async (userId, goalType, currentValue) => {
    try {
      const { data, error } = await supabase.rpc('update_goal_progress', {
        p_user_id: userId,
        p_date: todayISO(),
        p_goal_type: goalType,
        p_current_value: currentValue,
      });
      if (error) throw error;
      if (data && data.length > 0) {
        set({
          goals: get().goals.map((g) => {
            const hit = data.find((d) => d.goal_id === g.id);
            return hit ? { ...g, current_value: currentValue, completed: hit.is_now_completed } : g;
          }),
        });
        return data.some((d) => !d.was_completed && d.is_now_completed);
      }
      return false;
    } catch {
      return false;
    }
  },

  syncMealsGoal: async (userId) => {
    const date = todayISO();
    try {
      const { data, error } = await supabase
        .from('meal_logs')
        .select('meal_type')
        .eq('user_id', userId)
        .eq('date', date);
      if (error) throw error;
      const count = new Set((data ?? []).map((r) => r.meal_type)).size;
      return get().syncAutoGoal(userId, 'meals', count);
    } catch {
      return false;
    }
  },
}));
