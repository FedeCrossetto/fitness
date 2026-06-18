import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatLongDate, todayISO } from '../../lib/dates';
import {
  AppText,
  BottomSheet,
  Card,
  CardSkeleton,
  EmptyState,
  ErrorState,
  IconButton,
} from '../../components/common';
import { MacroDaySummary } from '../../components/nutrition/MacroDaySummary';
import { useAuthStore } from '../../stores/authStore';
import { useTranslation } from '../../stores/i18nStore';
import { computeMacroTotals, useNutritionStore } from '../../stores/nutritionStore';
import type { MacroSource, MealLogRow, MealType } from '../../types/database';
import type { NutritionStackParamList } from '../../types/navigation';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';

type Props = NativeStackScreenProps<NutritionStackParamList, 'MealsDay'>;

const MEAL_SECTION_KEYS: { type: MealType; labelKey: 'breakfast' | 'lunch' | 'snack' | 'dinner' }[] = [
  { type: 'DES', labelKey: 'breakfast' },
  { type: 'ALM', labelKey: 'lunch' },
  { type: 'MER', labelKey: 'snack' },
  { type: 'CEN', labelKey: 'dinner' },
];

function sourceIcon(source: MacroSource | null): keyof typeof Ionicons.glyphMap {
  switch (source) {
    case 'openfoodfacts':
    case 'barcode':
      return 'barcode-outline';
    case 'voice':
      return 'mic-outline';
    case 'user_food':
    case 'catalog':
      return 'bookmark-outline';
    default:
      return 'create-outline';
  }
}

export function MealsDayScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const meals = useNutritionStore((s) => s.meals);
  const loading = useNutritionStore((s) => s.loading);
  const error = useNutritionStore((s) => s.error);
  const kcalGoal = useNutritionStore((s) => s.kcalGoal);
  const macroGoals = useNutritionStore((s) => s.macroGoals);
  const loadDay = useNutritionStore((s) => s.loadDay);
  const toggleIncluded = useNutritionStore((s) => s.toggleIncluded);
  const totals = useMemo(() => computeMacroTotals(meals), [meals]);

  const [refreshing, setRefreshing] = useState(false);
  const [sheetType, setSheetType] = useState<MealType | null>(null);

  const load = useCallback(() => {
    if (userId) void loadDay(userId);
  }, [userId, loadDay]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    await loadDay(userId);
    setRefreshing(false);
  }, [userId, loadDay]);

  const hasOffData = meals.some((m) => m.openfoodfacts_code !== null);
  const showSkeletons = loading && meals.length === 0;
  const showError = !loading && error !== null && meals.length === 0;
  const showEmpty = !loading && !showError && meals.length === 0;

  const openAddOption = (target: 'FoodDetail' | 'BarcodeScanner' | 'VoiceLog') => {
    const mealType = sheetType;
    setSheetType(null);
    if (!mealType) return;
    if (target === 'FoodDetail') navigation.navigate('FoodDetail', { mealType });
    if (target === 'BarcodeScanner') navigation.navigate('BarcodeScanner', { mealType });
    if (target === 'VoiceLog') navigation.navigate('VoiceLog', { mealType });
  };

  const renderMeal = (meal: MealLogRow, mealType: MealType) => (
    <Pressable
      key={meal.id}
      accessibilityRole="button"
      accessibilityLabel={`Editar ${meal.title ?? 'comida'}`}
      onPress={() => navigation.navigate('FoodDetail', { mealType, mealLogId: meal.id })}
      style={({ pressed }) => [styles.mealRow, !meal.is_included && styles.mealExcluded, pressed && styles.mealPressed]}
    >
      <View style={styles.mealIconWrap}>
        <Ionicons name={sourceIcon(meal.macro_source)} size={16} color={colors.text.tertiary} />
      </View>
      <View style={styles.mealInfo}>
        <AppText variant="body14Medium" color={colors.text.primary} numberOfLines={1}>
          {meal.title ?? meal.product_display_name ?? 'Comida'}
        </AppText>
        <AppText variant="body12" color={colors.text.tertiary}>
          {Math.round(meal.energy_kcal ?? 0)} kcal · P {Math.round(meal.protein_g ?? 0)}g · C {Math.round(meal.carbs_g ?? 0)}g · G{' '}
          {Math.round(meal.fat_g ?? 0)}g
        </AppText>
      </View>
      <IconButton
        icon={meal.is_included ? 'eye-outline' : 'eye-off-outline'}
        onPress={() => void toggleIncluded(meal.id)}
        accessibilityLabel={meal.is_included ? 'Excluir de los totales' : 'Incluir en los totales'}
        size={18}
        color={meal.is_included ? colors.text.secondary : colors.text.disabled}
        backgroundColor="transparent"
        style={styles.eyeButton}
      />
    </Pressable>
  );

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
                onCheckCalories={() => navigation.navigate('BarcodeScanner', { mealType: 'DES' })}
              />
            </View>

            {showEmpty ? (
              <EmptyState
                hideIllustration
                subdued
                title={t.nutrition.empty_title}
                message={t.nutrition.empty_message}
                titleColor={colors.text.primary}
                messageColor={colors.text.secondary}
                actionLabel={t.nutrition.add_meal}
                actionBackgroundColor={colors.primary.default}
                actionTextColor={colors.primary.onText}
                onAction={() => setSheetType('DES')}
              />
            ) : null}

            {/* Secciones por comida */}
            {MEAL_SECTION_KEYS.map((section) => {
              const sectionMeals = meals.filter((m) => m.meal_type === section.type);
              const sectionLabel = t.nutrition[section.labelKey];
              return (
                <View key={section.type} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <AppText variant="h3" color={colors.text.primary}>
                      {sectionLabel}
                    </AppText>
                    <IconButton
                      icon="add"
                      onPress={() => setSheetType(section.type)}
                      accessibilityLabel={`${t.nutrition.add_meal} — ${sectionLabel}`}
                      size={18}
                      color={colors.primary.default}
                    />
                  </View>
                  {sectionMeals.length === 0 ? (
                    <AppText variant="body13" color={colors.text.disabled} style={styles.sectionEmpty}>
                      {t.nutrition.no_records}
                    </AppText>
                  ) : (
                    <Card style={styles.sectionCard}>{sectionMeals.map((meal) => renderMeal(meal, section.type))}</Card>
                  )}
                </View>
              );
            })}

            {hasOffData ? (
              <AppText variant="body12" color={colors.text.tertiary} align="center" style={styles.attribution}>
                Datos de producto: © Open Food Facts (ODbL)
              </AppText>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Opciones para agregar comida */}
      <BottomSheet visible={sheetType !== null} onClose={() => setSheetType(null)} title={t.nutrition.add_meal}>
        {(
          [
            { label: t.nutrition.search, icon: 'search-outline', target: 'FoodDetail' },
            { label: t.nutrition.scan, icon: 'barcode-outline', target: 'BarcodeScanner' },
            { label: t.nutrition.voice, icon: 'mic-outline', target: 'VoiceLog' },
            { label: t.nutrition.manual_entry, icon: 'create-outline', target: 'FoodDetail' },
          ] as const
        ).map((option) => (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            onPress={() => openAddOption(option.target)}
            style={({ pressed }) => [styles.sheetOption, pressed && styles.mealPressed]}
          >
            <View style={styles.sheetIconWrap}>
              <Ionicons name={option.icon} size={20} color={colors.primary.default} />
            </View>
            <AppText variant="body16Medium" color={colors.text.primary}>
              {option.label}
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} style={styles.sheetChevron} />
          </Pressable>
        ))}
      </BottomSheet>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    marginBottom: spacing.xl,
  },
  summaryBlock: {
    marginBottom: spacing.sm,
  },
  section: { marginTop: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionEmpty: { paddingVertical: spacing.xs, paddingLeft: spacing.xxs },
  sectionCard: {
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  mealExcluded: { opacity: 0.45 },
  mealPressed: { opacity: 0.7 },
  mealIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealInfo: { flex: 1 },
  eyeButton: { borderWidth: 0, width: 36, height: 36 },
  attribution: { marginTop: spacing.xl },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: layout.minHitTarget,
  },
  sheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetChevron: { marginLeft: 'auto' },
});
