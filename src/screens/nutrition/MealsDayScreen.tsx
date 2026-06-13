import React, { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { illustrations, layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatLongDate, todayISO } from '../../lib/dates';
import {
  AppText,
  BottomSheet,
  Card,
  CardSkeleton,
  EmptyState,
  ErrorState,
  IconButton,
  ProgressBar,
  ProgressRing,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useNutritionStore } from '../../stores/nutritionStore';
import type { MacroSource, MealLogRow, MealType } from '../../types/database';
import type { NutritionStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<NutritionStackParamList, 'MealsDay'>;

const MEAL_SECTIONS: { type: MealType; label: string }[] = [
  { type: 'DES', label: 'Desayuno' },
  { type: 'ALM', label: 'Almuerzo' },
  { type: 'MER', label: 'Merienda' },
  { type: 'CEN', label: 'Cena' },
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
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const meals = useNutritionStore((s) => s.meals);
  const loading = useNutritionStore((s) => s.loading);
  const error = useNutritionStore((s) => s.error);
  const kcalGoal = useNutritionStore((s) => s.kcalGoal);
  const macroGoals = useNutritionStore((s) => s.macroGoals);
  const loadDay = useNutritionStore((s) => s.loadDay);
  const toggleIncluded = useNutritionStore((s) => s.toggleIncluded);

  const [refreshing, setRefreshing] = useState(false);
  const [sheetType, setSheetType] = useState<MealType | null>(null);

  // Recalcula al re-renderizar; el componente ya se re-renderiza cuando cambia `meals`.
  const totals = useNutritionStore.getState().totals();

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
          paddingBottom: layout.tabBarHeight + spacing.xxl,
          paddingHorizontal: layout.screenPadding,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary.default} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera del pilar */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="body14" color={colors.text.tertiary}>
              {formatLongDate(todayISO())}
            </AppText>
            <AppText variant="h1" color={colors.text.primary}>
              Nutrición
            </AppText>
          </View>
          <Image source={illustrations.pillarHeader.nutrition} style={styles.mascot} contentFit="contain" />
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
            {/* Resumen del día */}
            <Card elevated style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <ProgressRing progress={kcalGoal > 0 ? totals.kcal / kcalGoal : 0} size={104} strokeWidth={10}>
                  <AppText variant="metricSmall" color={colors.text.primary}>
                    {Math.round(totals.kcal)}
                  </AppText>
                  <AppText variant="caps11" color={colors.text.tertiary}>
                    / {kcalGoal} kcal
                  </AppText>
                </ProgressRing>
                <View style={styles.macrosCol}>
                  {(
                    [
                      { key: 'P', value: totals.protein, goal: macroGoals.protein, color: colors.primary.default },
                      { key: 'C', value: totals.carbs, goal: macroGoals.carbs, color: colors.primary.dark },
                      { key: 'G', value: totals.fat, goal: macroGoals.fat, color: colors.primary.deep },
                    ] as const
                  ).map((macro) => (
                    <View key={macro.key} style={styles.macroRow}>
                      <AppText variant="body12SemiBold" color={colors.text.secondary} style={styles.macroKey}>
                        {macro.key}
                      </AppText>
                      <ProgressBar
                        progress={macro.goal > 0 ? macro.value / macro.goal : 0}
                        height={6}
                        color={macro.color}
                        style={styles.macroBar}
                      />
                      <AppText variant="body12Medium" color={colors.text.tertiary} style={styles.macroValue}>
                        {Math.round(macro.value)}/{macro.goal}g
                      </AppText>
                    </View>
                  ))}
                </View>
              </View>
            </Card>

            {showEmpty ? (
              <EmptyState
                pillar="nutrition"
                title="Todavía no registraste comidas"
                message="Sumá tu primera comida del día para seguir tus calorías y macros."
                actionLabel="Agregar comida"
                onAction={() => setSheetType('DES')}
              />
            ) : null}

            {/* Secciones por comida */}
            {MEAL_SECTIONS.map((section) => {
              const sectionMeals = useNutritionStore.getState().mealsByType(section.type);
              return (
                <View key={section.type} style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <AppText variant="h3" color={colors.text.primary}>
                      {section.label}
                    </AppText>
                    <IconButton
                      icon="add"
                      onPress={() => setSheetType(section.type)}
                      accessibilityLabel={`Agregar comida a ${section.label}`}
                      size={18}
                      color={colors.primary.default}
                    />
                  </View>
                  {sectionMeals.length === 0 ? (
                    <AppText variant="body13" color={colors.text.disabled} style={styles.sectionEmpty}>
                      Sin registros
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
      <BottomSheet visible={sheetType !== null} onClose={() => setSheetType(null)} title="Agregar comida">
        {(
          [
            { label: 'Buscar en mis alimentos', icon: 'search-outline', target: 'FoodDetail' },
            { label: 'Escanear código', icon: 'barcode-outline', target: 'BarcodeScanner' },
            { label: 'Por voz', icon: 'mic-outline', target: 'VoiceLog' },
            { label: 'Manual', icon: 'create-outline', target: 'FoodDetail' },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerText: { flex: 1 },
  mascot: { width: 72, height: 88 },
  summaryCard: { marginBottom: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  macrosCol: { flex: 1, gap: spacing.sm },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  macroKey: { width: 16 },
  macroBar: { flex: 1 },
  macroValue: { width: 64, textAlign: 'right' },
  section: { marginTop: spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionEmpty: { paddingVertical: spacing.xs, paddingLeft: spacing.xxs },
  sectionCard: { paddingVertical: spacing.xxs, paddingHorizontal: spacing.sm },
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
