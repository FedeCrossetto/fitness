import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatLongDate, todayISO } from '../../lib/dates';
import { AppText, CardSkeleton, ErrorState } from '../../components/common';
import { MacroDaySummary } from '../../components/nutrition/MacroDaySummary';
import { MealSectionCard } from '../../components/nutrition/MealSectionCard';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../stores/i18nStore';
import { computeMacroTotals, useNutritionStore } from '../../stores/nutritionStore';
import type { MealLogRow, MealType } from '../../types/database';
import type { NutritionStackParamList } from '../../types/navigation';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';

type Props = NativeStackScreenProps<NutritionStackParamList, 'MealsDay'>;

const MEAL_SECTIONS: { type: MealType; labelKey: 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'intermediate' }[] = [
  { type: 'DES', labelKey: 'breakfast' },
  { type: 'ALM', labelKey: 'lunch' },
  { type: 'MER', labelKey: 'snack' },
  { type: 'CEN', labelKey: 'dinner' },
  { type: 'COL', labelKey: 'intermediate' },
];

export function MealsDayScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const meals = useNutritionStore((s) => s.meals);
  const myFoods = useNutritionStore((s) => s.myFoods);
  const loading = useNutritionStore((s) => s.loading);
  const error = useNutritionStore((s) => s.error);
  const kcalGoal = useNutritionStore((s) => s.kcalGoal);
  const macroGoals = useNutritionStore((s) => s.macroGoals);
  const loadDay = useNutritionStore((s) => s.loadDay);
  const loadMyFoods = useNutritionStore((s) => s.loadMyFoods);
  const toggleIncluded = useNutritionStore((s) => s.toggleIncluded);
  const totals = useMemo(() => computeMacroTotals(meals), [meals]);

  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    if (!userId) return;
    void loadDay(userId);
    void loadMyFoods(userId);
  }, [userId, loadDay, loadMyFoods]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    await Promise.all([loadDay(userId), loadMyFoods(userId)]);
    setRefreshing(false);
  }, [userId, loadDay, loadMyFoods]);

  const hasOffData = meals.some((m) => m.openfoodfacts_code !== null);
  const showSkeletons = loading && meals.length === 0;
  const showError = !loading && error !== null && meals.length === 0;

  const openSearch = (mealType: MealType) => {
    navigation.navigate('FoodDetail', { mealType, entryMode: 'pick' });
  };

  const editMeal = (meal: MealLogRow) => {
    navigation.navigate('FoodDetail', { mealType: meal.meal_type, mealLogId: meal.id });
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: scrollBottom,
          paddingHorizontal: layout.screenPadding,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary.default} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <AppText variant="body14" color={colors.text.tertiary}>
            {formatLongDate(todayISO())}
          </AppText>
          <AppText variant="h1" color={colors.text.primary}>
            {t.nutrition.title}
          </AppText>
        </View>

        {showSkeletons ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : showError ? (
          <ErrorState message={error ?? 'No pudimos cargar tus comidas.'} onRetry={load} />
        ) : (
          <>
            <View style={styles.summaryBlock}>
              <MacroDaySummary
                totals={totals}
                kcalGoal={kcalGoal}
                macroGoals={macroGoals}
                onCheckCalories={() => openSearch('DES')}
              />
            </View>

            <View style={styles.mealsList}>
              {MEAL_SECTIONS.map((section) => {
                const sectionMeals = meals.filter((m) => m.meal_type === section.type);
                return (
                  <MealSectionCard
                    key={section.type}
                    title={t.nutrition[section.labelKey]}
                    mealType={section.type}
                    meals={sectionMeals}
                    myFoods={myFoods}
                    onAdd={() => openSearch(section.type)}
                    onEditMeal={editMeal}
                    onToggleIncluded={(id) => void toggleIncluded(id)}
                  />
                );
              })}
            </View>

            {hasOffData ? (
              <AppText variant="body12" color={colors.text.tertiary} align="center" style={styles.attribution}>
                Datos de producto: © Open Food Facts (ODbL)
              </AppText>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: {
      marginBottom: spacing.lg,
    },
    summaryBlock: {
      marginBottom: spacing.md,
    },
    mealsList: {
      gap: spacing.sm,
    },
    attribution: { marginTop: spacing.xl },
  });
