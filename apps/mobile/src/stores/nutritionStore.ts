import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { staleWhileRevalidate } from '../lib/cache';
import { todayISO } from '../lib/dates';
import { clientConfig } from '../config/clientConfig';
import type { FoodRow, MealLogRow, MealType, MacroSource } from '../types/database';

export interface MacroTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NewMealEntry {
  mealType: MealType;
  title: string;
  foodId?: string | null;
  openfoodfactsCode?: string | null;
  macroSource: MacroSource;
  portionGrams: number | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface NutritionState {
  date: string;
  meals: MealLogRow[];
  loading: boolean;
  error: string | null;

  myFoods: FoodRow[];
  foodsLoading: boolean;

  kcalGoal: number;
  macroGoals: { protein: number; carbs: number; fat: number };

  loadDay: (userId: string, date?: string) => Promise<void>;
  addMeal: (userId: string, entry: NewMealEntry) => Promise<boolean>;
  updateMeal: (mealLogId: string, data: Partial<MealLogRow>) => Promise<boolean>;
  deleteMeal: (mealLogId: string) => Promise<boolean>;
  toggleIncluded: (mealLogId: string) => Promise<void>;
  loadMyFoods: (userId: string) => Promise<void>;
  saveFood: (userId: string, food: Omit<Partial<FoodRow>, 'id'> & { name: string; source: FoodRow['source'] }) => Promise<FoodRow | null>;
  toggleFavoriteFood: (foodId: string) => Promise<void>;

  totals: () => MacroTotals;
  mealsByType: (type: MealType) => MealLogRow[];
  includedMealsCount: () => number;
}

export const useNutritionStore = create<NutritionState>((set, get) => ({
  date: todayISO(),
  meals: [],
  loading: false,
  error: null,
  myFoods: [],
  foodsLoading: false,
  kcalGoal: clientConfig.defaultKcalGoal,
  macroGoals: clientConfig.defaultMacroGoals,

  loadDay: async (userId, date = todayISO()) => {
    set({ loading: true, error: null, date });
    try {
      await staleWhileRevalidate<MealLogRow[]>(
        `nutrition:${userId}:${date}`,
        async () => {
          const { data, error } = await supabase
            .from('meal_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('date', date)
            .order('created_at');
          if (error) throw error;
          return data;
        },
        (data) => set({ meals: data, loading: false })
      );
    } catch {
      set({ loading: false, error: 'No pudimos cargar tus comidas.' });
    }
  },

  addMeal: async (userId, entry) => {
    try {
      const { data, error } = await supabase
        .from('meal_logs')
        .insert({
          user_id: userId,
          date: get().date,
          meal_type: entry.mealType,
          title: entry.title,
          product_display_name: entry.title,
          food_id: entry.foodId ?? null,
          openfoodfacts_code: entry.openfoodfactsCode ?? null,
          macro_source: entry.macroSource,
          portion_grams: entry.portionGrams,
          energy_kcal: entry.kcal,
          protein_g: entry.protein,
          carbs_g: entry.carbs,
          fat_g: entry.fat,
          is_included: true,
        })
        .select()
        .single();
      if (error) throw error;
      set({ meals: [...get().meals, data] });
      return true;
    } catch {
      set({ error: 'No pudimos registrar la comida.' });
      return false;
    }
  },

  updateMeal: async (mealLogId, data) => {
    try {
      const { data: updated, error } = await supabase
        .from('meal_logs')
        .update(data)
        .eq('id', mealLogId)
        .select()
        .single();
      if (error) throw error;
      set({ meals: get().meals.map((m) => (m.id === mealLogId ? updated : m)) });
      return true;
    } catch {
      return false;
    }
  },

  deleteMeal: async (mealLogId) => {
    const previous = get().meals;
    set({ meals: previous.filter((m) => m.id !== mealLogId) });
    const { error } = await supabase.from('meal_logs').delete().eq('id', mealLogId);
    if (error) {
      set({ meals: previous });
      return false;
    }
    return true;
  },

  toggleIncluded: async (mealLogId) => {
    const meal = get().meals.find((m) => m.id === mealLogId);
    if (!meal) return;
    await get().updateMeal(mealLogId, { is_included: !meal.is_included });
  },

  loadMyFoods: async (userId) => {
    set({ foodsLoading: true });
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('user_id', userId)
        .order('is_favorite', { ascending: false })
        .order('name');
      if (error) throw error;
      set({ myFoods: data, foodsLoading: false });
    } catch {
      set({ foodsLoading: false });
    }
  },

  saveFood: async (userId, food) => {
    try {
      const { data, error } = await supabase
        .from('foods')
        .upsert({ ...food, user_id: userId }, { onConflict: 'user_id,barcode', ignoreDuplicates: false })
        .select()
        .single();
      if (error) throw error;
      const existing = get().myFoods.filter((f) => f.id !== data.id);
      set({ myFoods: [data, ...existing] });
      return data;
    } catch {
      return null;
    }
  },

  toggleFavoriteFood: async (foodId) => {
    const food = get().myFoods.find((f) => f.id === foodId);
    if (!food) return;
    const isFavorite = !food.is_favorite;
    set({ myFoods: get().myFoods.map((f) => (f.id === foodId ? { ...f, is_favorite: isFavorite } : f)) });
    await supabase.from('foods').update({ is_favorite: isFavorite }).eq('id', foodId);
  },

  totals: () => {
    return get().meals.reduce<MacroTotals>(
      (acc, meal) => {
        if (!meal.is_included) return acc;
        return {
          kcal: acc.kcal + (meal.energy_kcal ?? 0),
          protein: acc.protein + (meal.protein_g ?? 0),
          carbs: acc.carbs + (meal.carbs_g ?? 0),
          fat: acc.fat + (meal.fat_g ?? 0),
        };
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
  },

  mealsByType: (type) => get().meals.filter((m) => m.meal_type === type),

  includedMealsCount: () => get().meals.filter((m) => m.is_included).length,
}));
