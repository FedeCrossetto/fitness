import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatLongDate, todayISO } from '../../lib/dates';
import { hapticSuccess } from '../../lib/haptics';
import {
  AppText,
  BottomSheet,
  Button,
  Card,
  CardSkeleton,
  Chip,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  ProgressBar,
  ProgressRing,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useGoalsStore } from '../../stores/goalsStore';
import { useUiStore } from '../../stores/uiStore';
import type { DailyGoalRow, GoalType } from '../../types/database';
import type { HomeStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<HomeStackParamList, 'Goals'>;

const GOAL_ICONS: Record<GoalType, keyof typeof Ionicons.glyphMap> = {
  hydration: 'water-outline',
  steps: 'walk-outline',
  training: 'barbell-outline',
  meals: 'restaurant-outline',
  custom: 'star-outline',
};

function formatGoalProgress(goal: DailyGoalRow): string {
  const current = goal.current_value ?? 0;
  const target = goal.target_value ?? 0;
  switch (goal.target_unit) {
    case 'ml':
      return `${(current / 1000).toFixed(1)} / ${(target / 1000).toFixed(1)} L`;
    case 'steps':
      return `${current.toLocaleString('es-AR')} / ${target.toLocaleString('es-AR')} pasos`;
    case 'meals':
      return `${current} / ${target} comidas`;
    case 'minutes':
      return `${current} / ${target} min`;
    default:
      return '';
  }
}

export function GoalsScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const goals = useGoalsStore((s) => s.goals);
  const loading = useGoalsStore((s) => s.loading);
  const error = useGoalsStore((s) => s.error);
  const loadToday = useGoalsStore((s) => s.loadToday);
  const createGoal = useGoalsStore((s) => s.createGoal);
  const updateGoal = useGoalsStore((s) => s.updateGoal);
  const deleteGoal = useGoalsStore((s) => s.deleteGoal);
  const toggleGoal = useGoalsStore((s) => s.toggleGoal);

  const [createVisible, setCreateVisible] = useState(false);
  const [newText, setNewText] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingGoal, setEditingGoal] = useState<DailyGoalRow | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (userId) void loadToday(userId);
    }, [userId, loadToday])
  );

  const onToggle = useCallback(
    (goal: DailyGoalRow) => {
      if (goal.auto_track) {
        useUiStore.getState().showToast('info', 'Esta meta se completa sola con tu actividad');
        return;
      }
      if (!goal.completed) hapticSuccess();
      void toggleGoal(goal.id);
    },
    [toggleGoal]
  );

  const openEdit = useCallback((goal: DailyGoalRow) => {
    setEditingGoal(goal);
    setEditText(goal.text);
  }, []);

  const onCreate = useCallback(async () => {
    const text = newText.trim();
    if (!text || !userId) return;
    setCreating(true);
    const ok = await createGoal(userId, {
      text,
      goalType: 'custom',
      targetValue: 1,
      targetUnit: 'boolean',
    });
    setCreating(false);
    if (ok) {
      hapticSuccess();
      useUiStore.getState().showToast('success', 'Meta creada');
      setCreateVisible(false);
      setNewText('');
    } else {
      useUiStore.getState().showToast('error', 'No pudimos crear la meta.');
    }
  }, [newText, userId, createGoal]);

  const onSaveEdit = useCallback(async () => {
    const text = editText.trim();
    if (!text || !editingGoal) return;
    setSavingEdit(true);
    const ok = await updateGoal(editingGoal.id, { text });
    setSavingEdit(false);
    if (ok) {
      useUiStore.getState().showToast('success', 'Meta actualizada');
      setEditingGoal(null);
    } else {
      useUiStore.getState().showToast('error', 'No pudimos actualizar la meta.');
    }
  }, [editText, editingGoal, updateGoal]);

  const onDelete = useCallback(() => {
    if (!editingGoal) return;
    const goal = editingGoal;
    Alert.alert('Eliminar meta', `¿Querés eliminar "${goal.text}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          setEditingGoal(null);
          void deleteGoal(goal.id).then((ok) => {
            useUiStore
              .getState()
              .showToast(ok ? 'success' : 'error', ok ? 'Meta eliminada' : 'No pudimos eliminar la meta.');
          });
        },
      },
    ]);
  }, [editingGoal, deleteGoal]);

  const completed = goals.filter((g) => g.completed).length;
  const progress = goals.length > 0 ? completed / goals.length : 0;

  const renderGoal = useCallback(
    ({ item }: { item: DailyGoalRow }) => {
      const canEdit = item.goal_type === 'custom' && !item.auto_track;
      const icon = GOAL_ICONS[item.goal_type ?? 'custom'];
      const showProgress = item.target_unit !== null && item.target_unit !== 'boolean';
      const target = item.target_value ?? 0;
      const barProgress = target > 0 ? (item.current_value ?? 0) / target : 0;

      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.text}
          onLongPress={canEdit ? () => openEdit(item) : undefined}
          delayLongPress={350}
          style={({ pressed }) => [styles.goalCard, pressed && canEdit && styles.goalPressed]}
        >
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.completed }}
            accessibilityLabel={item.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
            onPress={() => onToggle(item)}
            hitSlop={8}
            style={[styles.check, item.completed && styles.checkDone]}
          >
            {item.completed ? (
              <Ionicons name="checkmark" size={16} color={colors.text.inverse} />
            ) : null}
          </Pressable>

          <View style={styles.goalIcon}>
            <Ionicons name={icon} size={18} color={colors.primary.default} />
          </View>

          <View style={styles.goalBody}>
            <AppText
              variant="body16Medium"
              color={item.completed ? colors.text.tertiary : colors.text.primary}
              style={item.completed ? styles.goalTextDone : undefined}
            >
              {item.text}
            </AppText>
            {showProgress ? (
              <View style={styles.goalProgress}>
                <ProgressBar progress={barProgress} height={6} style={styles.goalBar} />
                <AppText variant="body12Medium" color={colors.text.tertiary} style={styles.goalProgressText}>
                  {formatGoalProgress(item)}
                </AppText>
              </View>
            ) : null}
          </View>

          {item.auto_track ? <Chip label="Auto" style={styles.autoChip} /> : null}
        </Pressable>
      );
    },
    [onToggle, openEdit, colors, styles]
  );

  let content: React.JSX.Element;
  if (loading && goals.length === 0) {
    content = (
      <View style={styles.body}>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </View>
    );
  } else if (error && goals.length === 0) {
    content = (
      <ErrorState
        message={error}
        onRetry={() => {
          if (userId) void loadToday(userId);
        }}
      />
    );
  } else if (goals.length === 0) {
    content = (
      <EmptyState
        pillar="generic"
        title="Sin metas para hoy"
        message="Creá tu primera meta del día y empezá a sumar racha."
        actionLabel="Crear meta"
        onAction={() => setCreateVisible(true)}
      />
    );
  } else {
    content = (
      <FlatList
        data={goals}
        keyExtractor={(g) => g.id}
        renderItem={renderGoal}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Card elevated style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <ProgressRing progress={progress} size={96} strokeWidth={9}>
                <AppText variant="metricSmall" color={colors.text.primary}>
                  {completed}/{goals.length}
                </AppText>
                <AppText variant="caps11" color={colors.text.tertiary}>
                  Metas
                </AppText>
              </ProgressRing>
              <View style={styles.summaryInfo}>
                <AppText variant="h3" color={colors.text.primary}>
                  {progress >= 1 ? '¡Día completo!' : 'Tu progreso de hoy'}
                </AppText>
                <AppText variant="body13" color={colors.text.secondary} style={styles.summarySub}>
                  {progress >= 1
                    ? 'Cumpliste todas tus metas. Sos imparable.'
                    : completed > 0
                      ? 'Buen ritmo, te falta poco para completar el día.'
                      : 'Completá tus metas para sumar racha.'}
                </AppText>
              </View>
            </View>
          </Card>
        }
      />
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <View style={styles.headerCenter}>
          <AppText variant="h3" color={colors.text.primary} align="center">
            Metas de hoy
          </AppText>
          <AppText variant="body12" color={colors.text.tertiary} align="center">
            {formatLongDate(todayISO())}
          </AppText>
        </View>
        <IconButton icon="add" onPress={() => setCreateVisible(true)} accessibilityLabel="Crear meta" />
      </View>

      {content}

      <BottomSheet
        visible={createVisible}
        onClose={() => {
          setCreateVisible(false);
          setNewText('');
        }}
        title="Nueva meta"
      >
        <Input
          label="Meta"
          placeholder="Ej: Estirar 10 minutos"
          value={newText}
          onChangeText={setNewText}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={() => void onCreate()}
        />
        <AppText variant="caps12" color={colors.text.tertiary} style={styles.sheetLabel}>
          Tipo
        </AppText>
        <View style={styles.chipRow}>
          <Chip label="Personalizada" active />
        </View>
        <AppText variant="body13" color={colors.text.tertiary} style={styles.sheetHint}>
          Se marca como completada con un tap en el círculo.
        </AppText>
        <Button
          label="Crear meta"
          onPress={() => void onCreate()}
          loading={creating}
          disabled={!newText.trim()}
          fullWidth
        />
      </BottomSheet>

      <BottomSheet visible={editingGoal !== null} onClose={() => setEditingGoal(null)} title="Editar meta">
        <Input
          label="Meta"
          value={editText}
          onChangeText={setEditText}
          returnKeyType="done"
          onSubmitEditing={() => void onSaveEdit()}
        />
        <Button
          label="Guardar cambios"
          onPress={() => void onSaveEdit()}
          loading={savingEdit}
          disabled={!editText.trim()}
          fullWidth
          style={styles.sheetButton}
        />
        <Button label="Eliminar meta" variant="secondary" onPress={onDelete} fullWidth style={styles.sheetButton} />
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
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerCenter: { flex: 1 },
  body: { paddingHorizontal: layout.screenPadding },
  listContent: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: layout.tabBarHeight + spacing.xxl,
  },
  summaryCard: { marginBottom: spacing.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryInfo: { flex: 1 },
  summarySub: { marginTop: spacing.xxs },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  goalPressed: { opacity: 0.85 },
  check: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    backgroundColor: colors.primary.default,
    borderColor: colors.primary.default,
  },
  goalIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalBody: { flex: 1 },
  goalTextDone: { textDecorationLine: 'line-through' },
  goalProgress: { marginTop: spacing.xs },
  goalBar: { alignSelf: 'stretch' },
  goalProgressText: { marginTop: spacing.xxs },
  autoChip: { minHeight: 28, paddingVertical: spacing.xxs },
  sheetLabel: { marginTop: spacing.md, marginBottom: spacing.xs },
  chipRow: { flexDirection: 'row', gap: spacing.xs },
  sheetHint: { marginTop: spacing.sm, marginBottom: spacing.lg },
  sheetButton: { marginTop: spacing.sm },
});
