import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { staleWhileRevalidate } from '../lib/cache';
import { todayISO } from '../lib/dates';
import { clientConfig } from '../config/clientConfig';
import type { FoodRow, FoodSubmissionRow, MealLogRow, MealType, MacroSource, ServingUnit, TrainerFoodRow } from '../types/database';
import { useGoalsStore } from './goalsStore';
import { useUiStore } from './uiStore';

function toastError(message: string): void {
  useUiStore.getState().showToast('error', message);
}

function syncMealsGoalIfToday(userId: string, date: string): void {
  if (date === todayISO()) {
    void useGoalsStore.getState().syncMealsGoal(userId);
  }
}

export interface MacroTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function computeMacroTotals(meals: MealLogRow[]): MacroTotals {
  return meals.reduce<MacroTotals>(
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
}

export interface NewMealEntry {
  mealType: MealType;
  title: string;
  foodId?: string | null;
  trainerFoodId?: string | null;
  openfoodfactsCode?: string | null;
  macroSource: MacroSource;
  portionGrams: number | null;
  portionUnit?: ServingUnit;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  iconKey?: string | null;
  photoUrl?: string | null;
  isIncluded?: boolean;
}

interface NutritionState {
  date: string;
  meals: MealLogRow[];
  loading: boolean;
  error: string | null;

  myFoods: FoodRow[];
  trainerFoods: TrainerFoodRow[];
  mySubmissions: FoodSubmissionRow[];
  foodsLoading: boolean;

  kcalGoal: number;
  macroGoals: { protein: number; carbs: number; fat: number };

  loadDay: (userId: string, date?: string) => Promise<void>;
  addMeal: (userId: string, entry: NewMealEntry) => Promise<boolean>;
  duplicateMeals: (userId: string, fromMealType: MealType, toMealType: MealType) => Promise<number>;
  updateMeal: (mealLogId: string, data: Partial<MealLogRow>) => Promise<boolean>;
  deleteMeal: (mealLogId: string) => Promise<boolean>;
  toggleIncluded: (mealLogId: string) => Promise<void>;
  loadMyFoods: (userId: string) => Promise<void>;
  loadTrainerCatalog: (userId: string) => Promise<void>;
  saveFood: (userId: string, food: Omit<Partial<FoodRow>, 'id'> & { name: string; source: FoodRow['source'] }) => Promise<FoodRow | null>;
  updateFood: (foodId: string, data: Partial<FoodRow>) => Promise<FoodRow | null>;
  deleteFood: (foodId: string) => Promise<boolean>;
  submitFoodForApproval: (userId: string, food: FoodRow) => Promise<void>;
  toggleFavoriteFood: (foodId: string) => Promise<void>;
  toggleFavoriteTrainerFood: (userId: string, trainerFoodId: string) => Promise<void>;

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
  trainerFoods: [],
  mySubmissions: [],
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
        (data) => {
          if (get().date !== date) return;
          set({ meals: data, loading: false });
        },
      );
    } catch {
      if (get().date !== date) return;
      set({ loading: false, error: 'No pudimos cargar tus comidas.' });
      toastError('No pudimos cargar tus comidas.');
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
          trainer_food_id: entry.trainerFoodId ?? null,
          openfoodfacts_code: entry.openfoodfactsCode ?? null,
          macro_source: entry.macroSource,
          portion_grams: entry.portionGrams,
          portion_unit: entry.portionUnit ?? 'g',
          energy_kcal: entry.kcal,
          protein_g: entry.protein,
          carbs_g: entry.carbs,
          fat_g: entry.fat,
          icon_key: entry.iconKey ?? null,
          photo_url: entry.photoUrl ?? null,
          is_included: entry.isIncluded ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      set({ meals: [...get().meals, data] });
      syncMealsGoalIfToday(userId, get().date);
      return true;
    } catch {
      set({ error: 'No pudimos registrar la comida.' });
      toastError('No pudimos registrar la comida.');
      return false;
    }
  },

  duplicateMeals: async (userId, fromMealType, toMealType) => {
    if (fromMealType === toMealType) return 0;
    const sourceMeals = get().meals.filter(
      (m) => m.meal_type === fromMealType && m.date === get().date,
    );
    if (sourceMeals.length === 0) return 0;

    let copied = 0;
    for (const meal of sourceMeals) {
      const title = meal.title ?? meal.product_display_name ?? 'Comida';
      const ok = await get().addMeal(userId, {
        mealType: toMealType,
        title,
        foodId: meal.food_id,
        trainerFoodId: meal.trainer_food_id,
        openfoodfactsCode: meal.openfoodfacts_code,
        macroSource: meal.macro_source ?? 'manual',
        portionGrams: meal.portion_grams,
        portionUnit: meal.portion_unit,
        kcal: meal.energy_kcal ?? 0,
        protein: meal.protein_g ?? 0,
        carbs: meal.carbs_g ?? 0,
        fat: meal.fat_g ?? 0,
        iconKey: meal.icon_key,
        photoUrl: meal.photo_url,
        isIncluded: meal.is_included,
      });
      if (ok) copied += 1;
    }
    return copied;
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
      toastError('No pudimos actualizar la comida.');
      return false;
    }
  },

  deleteMeal: async (mealLogId) => {
    const previous = get().meals;
    const meal = previous.find((m) => m.id === mealLogId);
    set({ meals: previous.filter((m) => m.id !== mealLogId) });
    const { error } = await supabase.from('meal_logs').delete().eq('id', mealLogId);
    if (error) {
      set({ meals: previous });
      toastError('No pudimos eliminar la comida.');
      return false;
    }
    if (meal) syncMealsGoalIfToday(meal.user_id, meal.date);
    return true;
  },

  toggleIncluded: async (mealLogId) => {
    const meal = get().meals.find((m) => m.id === mealLogId);
    if (!meal) return;
    const nextIncluded = !meal.is_included;
    const previous = get().meals;
    set({
      meals: previous.map((m) => (m.id === mealLogId ? { ...m, is_included: nextIncluded } : m)),
    });
    const ok = await get().updateMeal(mealLogId, { is_included: nextIncluded });
    if (!ok) set({ meals: previous });
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

  loadTrainerCatalog: async (userId) => {
    try {
      const [catalogRes, subsRes] = await Promise.all([
        supabase.from('trainer_foods').select('*').eq('active', true).order('name'),
        supabase.from('food_submissions').select('*').eq('submitted_by', userId).eq('status', 'pending'),
      ]);
      if (catalogRes.error) throw catalogRes.error;
      set({
        trainerFoods: catalogRes.data ?? [],
        mySubmissions: subsRes.data ?? [],
      });
    } catch {
      set({ trainerFoods: [], mySubmissions: [] });
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
      toastError('No pudimos guardar el alimento.');
      return null;
    }
  },

  updateFood: async (foodId, data) => {
    try {
      const { data: updated, error } = await supabase
        .from('foods')
        .update(data)
        .eq('id', foodId)
        .select()
        .single();
      if (error) throw error;
      set({ myFoods: get().myFoods.map((f) => (f.id === foodId ? updated : f)) });
      return updated;
    } catch {
      toastError('No pudimos actualizar el alimento.');
      return null;
    }
  },

  deleteFood: async (foodId) => {
    const previous = get().myFoods;
    set({ myFoods: previous.filter((f) => f.id !== foodId) });
    const { error } = await supabase.from('foods').delete().eq('id', foodId);
    if (error) {
      set({ myFoods: previous });
      toastError('No pudimos eliminar el alimento.');
      return false;
    }
    return true;
  },

  submitFoodForApproval: async (userId, food) => {
    try {
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('trainer_id')
        .eq('id', userId)
        .single();
      if (profileErr || !profile?.trainer_id) return;

      const existing = get().mySubmissions.find(
        (s) => s.personal_food_id === food.id && s.status === 'pending',
      );
      if (existing) return;

      const { data, error } = await supabase
        .from('food_submissions')
        .insert({
          trainer_id: profile.trainer_id,
          submitted_by: userId,
          personal_food_id: food.id,
          name: food.name,
          brand: food.brand,
          barcode: food.barcode,
          kcal_100g: food.kcal_100g,
          protein_g_100g: food.protein_g_100g,
          carbs_g_100g: food.carbs_g_100g,
          fat_g_100g: food.fat_g_100g,
          default_serving_grams: food.default_serving_grams,
          serving_unit: food.serving_unit ?? 'g',
          icon_key: food.icon_key,
        })
        .select()
        .single();
      if (error) throw error;
      set({ mySubmissions: [data, ...get().mySubmissions] });
    } catch {
      // Silencioso: el alumno igual tiene su copia personal.
    }
  },

  toggleFavoriteFood: async (foodId) => {
    const food = get().myFoods.find((f) => f.id === foodId);
    if (!food) return;
    const isFavorite = !food.is_favorite;
    set({ myFoods: get().myFoods.map((f) => (f.id === foodId ? { ...f, is_favorite: isFavorite } : f)) });
    await supabase.from('foods').update({ is_favorite: isFavorite }).eq('id', foodId);
  },

  toggleFavoriteTrainerFood: async (userId, trainerFoodId) => {
    const trainerFood = get().trainerFoods.find((f) => f.id === trainerFoodId);
    if (!trainerFood) return;

    const existing = get().myFoods.find((f) => f.trainer_food_id === trainerFoodId);
    if (existing) {
      await get().toggleFavoriteFood(existing.id);
      return;
    }

    await get().saveFood(userId, {
      name: trainerFood.name,
      brand: trainerFood.brand,
      barcode: trainerFood.barcode,
      kcal_100g: trainerFood.kcal_100g,
      protein_g_100g: trainerFood.protein_g_100g,
      carbs_g_100g: trainerFood.carbs_g_100g,
      fat_g_100g: trainerFood.fat_g_100g,
      default_serving_grams: trainerFood.default_serving_grams,
      serving_unit: trainerFood.serving_unit ?? 'g',
      source: 'import',
      openfoodfacts_code: trainerFood.openfoodfacts_code,
      voice_transcript: null,
      is_favorite: true,
      icon_key: trainerFood.icon_key,
      trainer_food_id: trainerFoodId,
    });
  },

  totals: () => computeMacroTotals(get().meals),

  mealsByType: (type) => get().meals.filter((m) => m.meal_type === type),

  includedMealsCount: () => get().meals.filter((m) => m.is_included).length,
}));
