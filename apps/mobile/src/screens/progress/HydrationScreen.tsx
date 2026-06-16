import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { clientConfig } from '../../config/clientConfig';
import { hapticMedium, hapticSelect, hapticSuccess } from '../../lib/haptics';
import { playWaterSound } from '../../lib/sounds';
import {
  AppText,
  BottomSheet,
  Button,
  Card,
  CardSkeleton,
  IconButton,
  Input,
  WaterLevelBox,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useGoalsStore } from '../../stores/goalsStore';
import { useProgressStore } from '../../stores/progressStore';
import { useUiStore } from '../../stores/uiStore';

const QUICK_ACTIONS = [
  { label: '+1 vaso', sublabel: '250 ml', ml: 250, icon: 'water-outline' },
  { label: '+500 ml', sublabel: 'Botella chica', ml: 500, icon: 'water-outline' },
  { label: '+1 L', sublabel: 'Botella grande', ml: 1000, icon: 'water-outline' },
  { label: '-250 ml', sublabel: 'Corregir', ml: -250, icon: 'remove-circle-outline' },
] as const;

export function HydrationScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const hydration = useProgressStore((s) => s.hydrationToday);
  const hydrationLoading = useProgressStore((s) => s.hydrationLoading);
  const loadHydration = useProgressStore((s) => s.loadHydration);
  const addWater = useProgressStore((s) => s.addWater);
  const setHydrationGoal = useProgressStore((s) => s.setHydrationGoal);

  const [goalSheetVisible, setGoalSheetVisible] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  const { width: screenW, height: screenH } = useWindowDimensions();
  const boxW = screenW - layout.screenPadding * 2 - spacing.md * 2;
  const boxH = Math.min(boxW * 0.54, screenH * 0.26);

  const totalMl = hydration?.total_ml ?? 0;
  const goalMl = hydration?.goal_ml ?? clientConfig.defaultHydrationGoalMl;
  const progress = Math.min(totalMl / Math.max(goalMl, 1), 1);

  // Evita repetir la celebración: si ya arrancó cumplida, no vuelve a sonar
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (hydration && hydration.total_ml >= hydration.goal_ml) celebratedRef.current = true;
  }, [hydration]);

  useEffect(() => {
    if (userId) void loadHydration(userId);
  }, [userId, loadHydration]);

  const onAddWater = useCallback(
    async (ml: number) => {
      if (!userId) return;
      const newTotal = await addWater(userId, ml);
      if (newTotal === null) {
        useUiStore.getState().showToast('error', 'No pudimos registrar el agua. Probá de nuevo.');
        return;
      }
      if (ml > 0) {
        hapticMedium();
        void playWaterSound('add');
      } else {
        hapticSelect();
        void playWaterSound('remove');
      }
      void useGoalsStore.getState().syncAutoGoal(userId, 'hydration', newTotal);
      const goal = useProgressStore.getState().hydrationToday?.goal_ml ?? clientConfig.defaultHydrationGoalMl;
      if (newTotal >= goal && !celebratedRef.current) {
        celebratedRef.current = true;
        hapticSuccess();
        useUiStore.getState().showToast('success', '¡Meta de hidratación cumplida!');
      }
    },
    [userId, addWater]
  );

  const openGoalSheet = useCallback(() => {
    setGoalInput(String(goalMl));
    setGoalSheetVisible(true);
  }, [goalMl]);

  const onSaveGoal = useCallback(async () => {
    if (!userId) return;
    const parsed = Number.parseInt(goalInput, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      useUiStore.getState().showToast('error', 'Ingresá un objetivo válido en ml.');
      return;
    }
    setSavingGoal(true);
    await setHydrationGoal(userId, parsed);
    setSavingGoal(false);
    celebratedRef.current = (useProgressStore.getState().hydrationToday?.total_ml ?? 0) >= parsed;
    hapticSuccess();
    useUiStore.getState().showToast('success', 'Objetivo diario actualizado');
    setGoalSheetVisible(false);
  }, [userId, goalInput, setHydrationGoal]);

  const isLoading = hydrationLoading && hydration === null;

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <AppText variant="h3" color={colors.text.primary}>
          Hidratación
        </AppText>
        <IconButton icon="options-outline" onPress={openGoalSheet} accessibilityLabel="Editar objetivo diario" />
      </View>

      {isLoading ? (
        <View style={styles.content}>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Card elevated style={styles.waterCard}>
            <WaterLevelBox
              progress={progress}
              width={boxW}
              height={boxH}
              color={colors.water}
              surfaceColor={colors.surface.base}
            >
              <View style={styles.valueRow}>
                <AppText variant="metricLarge" color={colors.text.primary} style={styles.bigValue}>
                  {(totalMl / 1000).toFixed(1)}
                </AppText>
                <AppText variant="h3" color={colors.text.tertiary}>
                  / {(goalMl / 1000).toFixed(1)}
                </AppText>
              </View>
              <AppText variant="caps12" color={colors.water} style={styles.litrosLabel}>
                Litros diarios
              </AppText>
            </WaterLevelBox>

            <View style={styles.waterGlasses}>
              {Array.from({ length: 5 }).map((_, i) => {
                const blockPct = (i + 1) * 20;
                const filled = progress * 100 >= blockPct - 1;
                return (
                  <View
                    key={i}
                    style={[
                      styles.waterGlass,
                      { backgroundColor: colors.water, opacity: filled ? 1 : 0.2 },
                    ]}
                  />
                );
              })}
            </View>

            <AppText variant="body14" color={colors.text.secondary} align="center" style={styles.waterSub}>
              {progress >= 1 ? (
                <>
                  {'¡'}
                  <AppText variant="body14" color={colors.primary.default}>
                    Objetivo
                  </AppText>
                  {' del día cumplido!'}
                </>
              ) : (
                <>
                  {`Te faltan ${((goalMl - totalMl) / 1000).toFixed(1)} L para tu `}
                  <AppText variant="body14" color={colors.primary.default}>
                    objetivo
                  </AppText>
                </>
              )}
            </AppText>
          </Card>

          {/* Botones rápidos */}
          <AppText variant="caps12" color={colors.text.tertiary} style={styles.sectionTitle}>
            Registrar
          </AppText>
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.label}
                accessibilityRole="button"
                accessibilityLabel={`${action.label} (${action.sublabel})`}
                onPress={() => void onAddWater(action.ml)}
                style={({ pressed }) => [styles.quickItem, pressed && styles.quickPressed]}
              >
                <View style={styles.quickIcon}>
                  <Ionicons
                    name={action.icon}
                    size={20}
                    color={action.ml > 0 ? colors.water : colors.text.tertiary}
                  />
                </View>
                <AppText variant="body14SemiBold" color={colors.text.primary}>
                  {action.label}
                </AppText>
                <AppText variant="body12" color={colors.text.tertiary}>
                  {action.sublabel}
                </AppText>
              </Pressable>
            ))}
          </View>

          {/* Objetivo */}
          <Card style={styles.goalCard} onPress={openGoalSheet}>
            <View style={styles.goalRow}>
              <View style={styles.goalInfo}>
                <AppText variant="caps12" color={colors.text.tertiary}>
                  <AppText variant="caps12" color={colors.primary.default}>
                    Objetivo
                  </AppText>
                  {' diario'}
                </AppText>
                <AppText variant="metricSmall" color={colors.text.primary} style={styles.goalValue}>
                  {goalMl.toLocaleString('es-AR')} ml
                </AppText>
              </View>
              <Ionicons name="create-outline" size={20} color={colors.text.tertiary} />
            </View>
          </Card>
        </ScrollView>
      )}

      <BottomSheet visible={goalSheetVisible} onClose={() => setGoalSheetVisible(false)} title="Objetivo diario">
        <Input
          label="Objetivo (ml)"
          icon="water-outline"
          keyboardType="number-pad"
          value={goalInput}
          onChangeText={setGoalInput}
          placeholder="Ej: 3000"
          containerStyle={styles.sheetInput}
        />
        <Button label="Guardar objetivo" onPress={() => void onSaveGoal()} loading={savingGoal} fullWidth />
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
    paddingHorizontal: layout.screenPadding,
    marginBottom: spacing.md,
  },
  content: { paddingHorizontal: layout.screenPadding },
  scrollContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarHeight + spacing.xxl,
  },
  waterCard: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.lg },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  bigValue: { fontSize: 56, lineHeight: 64 },
  litrosLabel: { marginTop: spacing.xxs, letterSpacing: 2 },
  waterGlasses: {
    flexDirection: 'row',
    gap: spacing.xs,
    width: '100%',
    marginTop: spacing.md,
  },
  waterGlass: {
    flex: 1,
    height: 6,
    borderRadius: spacing.xxs,
  },
  waterSub: { marginTop: spacing.md },
  sectionTitle: { marginBottom: spacing.sm },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  quickItem: {
    width: '48%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    minHeight: layout.minHitTarget,
  },
  quickPressed: { opacity: 0.8 },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(79,176,247,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCard: { marginBottom: spacing.md },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalInfo: { flex: 1 },
  goalValue: { marginTop: spacing.xxs },
  sheetInput: { marginBottom: spacing.md },
});
