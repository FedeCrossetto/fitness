import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { AppText, CardSkeleton, ErrorState, HeaderAvatar, WeekStrip } from '../../components/common';
import { FoodSearchBar } from '../../components/nutrition/FoodSearchBar';
import { FoodSearchSheet } from '../../components/nutrition/FoodSearchSheet';
import { MacroDaySummary } from '../../components/nutrition/MacroDaySummary';
import { MealSectionActionsSheet } from '../../components/nutrition/MealSectionActionsSheet';
import { MealSectionCard } from '../../components/nutrition/MealSectionCard';
import { hapticTap } from '../../lib/haptics';
import { isTodayDate } from '../../lib/dates';
import { defaultMealTypeForNow, mealLabelKey } from '../../lib/meals';
import { hapticSuccess } from '../../lib/haptics';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../stores/i18nStore';
import { computeMacroTotals, useNutritionStore } from '../../stores/nutritionStore';
import { useUiStore } from '../../stores/uiStore';
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
  const { t, i18n } = useTranslation();
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
  const deleteMeal = useNutritionStore((s) => s.deleteMeal);
  const duplicateMeals = useNutritionStore((s) => s.duplicateMeals);

  const activeDate = useUiStore((s) => s.activeDate);
  const canEditDay = isTodayDate(activeDate);
  const dayMeals = useMemo(
    () => meals.filter((m) => m.date === activeDate),
    [meals, activeDate],
  );
  const totals = useMemo(() => computeMacroTotals(dayMeals), [dayMeals]);

  const [refreshing, setRefreshing] = useState(false);
  const [searchSheetVisible, setSearchSheetVisible] = useState(false);
  const [searchMealType, setSearchMealType] = useState<MealType>(defaultMealTypeForNow());
  const [actionsMealType, setActionsMealType] = useState<MealType | null>(null);

  const load = useCallback(() => {
    if (!userId) return;
    void loadDay(userId, activeDate);
    void loadMyFoods(userId);
  }, [userId, activeDate, loadDay, loadMyFoods]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!userId) return;
    void loadDay(userId, activeDate);
  }, [userId, activeDate, loadDay]);

  useEffect(() => {
    if (canEditDay) return;
    setSearchSheetVisible(false);
    setActionsMealType(null);
  }, [canEditDay]);

  const onRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    await Promise.all([loadDay(userId, activeDate), loadMyFoods(userId)]);
    setRefreshing(false);
  }, [userId, activeDate, loadDay, loadMyFoods]);

  const hasOffData = dayMeals.some((m) => m.openfoodfacts_code !== null);
  const showSkeletons = loading && dayMeals.length === 0;
  const showError = !loading && error !== null && dayMeals.length === 0;

  const openSearch = useCallback((mealType: MealType) => {
    hapticTap();
    setSearchMealType(mealType);
    setSearchSheetVisible(true);
  }, []);

  const quickAddFood = useCallback(() => {
    openSearch(defaultMealTypeForNow());
  }, [openSearch]);

  const editMeal = (meal: MealLogRow) => {
    navigation.navigate('FoodDetail', { mealType: meal.meal_type, mealLogId: meal.id });
  };

  const removeMeal = (mealId: string) => {
    void (async () => {
      const ok = await deleteMeal(mealId);
      if (ok) {
        useUiStore.getState().showToast('success', t.nutrition.meal_deleted);
      } else {
        useUiStore.getState().showToast('error', t.nutrition.meal_delete_error);
      }
    })();
  };

  const actionsSection = MEAL_SECTIONS.find((s) => s.type === actionsMealType);
  const actionsMeals = actionsMealType ? dayMeals.filter((m) => m.meal_type === actionsMealType) : [];

  const duplicateSectionMeals = (targetMealType: MealType) => {
    if (!userId || !actionsMealType) return;
    void (async () => {
      const copied = await duplicateMeals(userId, actionsMealType, targetMealType);
      setActionsMealType(null);
      if (copied > 0) {
        hapticSuccess();
        useUiStore.getState().showToast(
          'success',
          i18n(t.nutrition.duplicate_meal_success, { meal: t.nutrition[mealLabelKey(targetMealType)] }),
        );
      } else {
        useUiStore.getState().showToast('error', t.nutrition.duplicate_meal_empty);
      }
    })();
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
          <HeaderAvatar />
          <AppText variant="h1" color={colors.text.primary} style={styles.headerTitle}>
            {t.nutrition.title}
          </AppText>
        </View>

        <WeekStrip
          headerAction={
            canEditDay
              ? {
                  icon: 'restaurant-outline',
                  accessibilityLabel: t.nutrition.search_foods,
                  onPress: quickAddFood,
                  active: searchSheetVisible,
                }
              : undefined
          }
        />

        {!canEditDay ? (
          <AppText variant="body13" color={colors.text.tertiary} style={styles.readonlyHint}>
            {t.nutrition.readonly_day_hint}
          </AppText>
        ) : null}

        {showSkeletons ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : showError ? (
          <ErrorState message={error ?? t.nutrition.load_meals_error} onRetry={load} />
        ) : (
          <>
            <View style={styles.summaryBlock}>
              <MacroDaySummary totals={totals} kcalGoal={kcalGoal} macroGoals={macroGoals} />
            </View>

            <View style={styles.mealsList}>
              {MEAL_SECTIONS.map((section) => {
                const sectionMeals = dayMeals.filter((m) => m.meal_type === section.type);
                return (
                  <MealSectionCard
                    key={section.type}
                    title={t.nutrition[section.labelKey]}
                    mealType={section.type}
                    meals={sectionMeals}
                    myFoods={myFoods}
                    readOnly={!canEditDay}
                    onAdd={() => openSearch(section.type)}
                    onMenuPress={() => setActionsMealType(section.type)}
                    onEditMeal={editMeal}
                    onToggleIncluded={(id) => void toggleIncluded(id)}
                    onDeleteMeal={removeMeal}
                  />
                );
              })}
            </View>

            {canEditDay ? (
              <View style={styles.searchBlock}>
                <FoodSearchBar
                  placeholder={t.nutrition.search_foods}
                  onPress={() => openSearch(defaultMealTypeForNow())}
                />
              </View>
            ) : null}

            {hasOffData ? (
              <AppText variant="body12" color={colors.text.tertiary} align="center" style={styles.attribution}>
                Datos de producto: © Open Food Facts (ODbL)
              </AppText>
            ) : null}
          </>
        )}
      </ScrollView>

      {canEditDay ? (
        <FoodSearchSheet
          visible={searchSheetVisible}
          mealType={searchMealType}
          onClose={() => setSearchSheetVisible(false)}
          navigation={navigation}
        />
      ) : null}

      {canEditDay && actionsSection ? (
        <MealSectionActionsSheet
          visible={actionsMealType !== null}
          sourceMealType={actionsSection.type}
          sourceTitle={t.nutrition[actionsSection.labelKey]}
          itemCount={actionsMeals.length}
          onClose={() => setActionsMealType(null)}
          onDuplicate={duplicateSectionMeals}
        />
      ) : null}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    headerTitle: { flex: 1 },
    readonlyHint: {
      marginBottom: spacing.md,
    },
    summaryBlock: {
      marginBottom: spacing.md,
    },
    mealsList: {
      gap: spacing.sm,
    },
    searchBlock: {
      marginTop: spacing.md,
    },
    attribution: { marginTop: spacing.xl },
  });
