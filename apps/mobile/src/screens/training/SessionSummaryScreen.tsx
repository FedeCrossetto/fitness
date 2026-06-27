import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TrainingStackParamList } from '../../types/navigation';
import { layout, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { hapticSuccess } from '../../lib/haptics';
import { formatShortDate } from '../../lib/dates';
import {
  AppText,
  Button,
  Card,
  CardSkeleton,
  Confetti,
  ErrorState,
  FadeInView,
  IconButton,
} from '../../components/common';
import { NUTRITION_MACRO_COLORS } from '../../components/nutrition/nutritionTheme';
import { useTranslation } from '../../stores/i18nStore';
import { useTrainingStore } from '../../stores/trainingStore';
import {
  formatWorkoutDuration,
  formatWorkoutVolume,
  summarizeWorkoutForFeed,
} from '@reset-fitness/shared';
import type { WorkoutLogRow } from '../../types/database';
import { WorkedBodyMap } from '../../components/training/WorkedBodyMap';
import type { BodyGender } from '../../components/progress';
import { useProgressStore } from '../../stores/progressStore';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';

type Props = NativeStackScreenProps<TrainingStackParamList, 'SessionSummary'>;

export function SessionSummaryScreen({ navigation, route }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const { logId, celebrate = true } = route.params;
  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();
  const loadLogById = useTrainingStore((s) => s.loadLogById);
  const measurements = useProgressStore((s) => s.measurements);

  const bodyGender: BodyGender =
    measurements[0]?.gender === 'female' ? 'female' : 'male';

  const [log, setLog] = useState<WorkoutLogRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await loadLogById(logId);
    setLog(result);
    setLoading(false);
  }, [logId, loadLogById]);

  useEffect(() => {
    if (celebrate) hapticSuccess();
    let cancelled = false;
    void (async () => {
      const result = await loadLogById(logId);
      if (cancelled) return;
      setLog(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [celebrate, logId, loadLogById]);

  const renderContent = () => {
    if (loading) {
      return (
        <View>
          <CardSkeleton />
          <CardSkeleton />
        </View>
      );
    }
    if (!log) {
      return (
        <ErrorState
          message={t.training.log_not_found}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      );
    }

    const exerciseLines = summarizeWorkoutForFeed(log.session_detail);
    const durationLabel = formatWorkoutDuration(log.duration_min, log.elapsed_seconds);
    const volumeLabel = formatWorkoutVolume(log.total_volume_kg);
    const completedSets =
      log.completed_sets ?? exerciseLines.reduce((s, l) => s + l.completedSets, 0);
    const isStrength = log.workout_type === 'fuerza';

    return (
      <View>
        <View style={celebrate ? styles.celebration : styles.detailHeader}>
          {celebrate ? (
            <Ionicons name="checkmark-circle" size={32} color={NUTRITION_MACRO_COLORS.carbs} />
          ) : null}
          <View style={styles.headerText}>
            <AppText variant="h3" color={colors.text.primary} numberOfLines={2}>
              {log.workout_name}
            </AppText>
            <AppText variant="body12" color={colors.text.tertiary}>
              {formatShortDate(log.date)} · {durationLabel}
            </AppText>
          </View>
        </View>

        {isStrength ? (
          <WorkedBodyMap
            sessionDetail={log.session_detail}
            gender={bodyGender}
            variant="hero"
            metrics={{
              durationLabel,
              volumeLabel,
              completedSets,
              exerciseCount: exerciseLines.length,
              rpe: log.rpe,
            }}
          />
        ) : (
          <Card style={styles.cardioMetrics}>
            <View style={styles.cardioGrid}>
              <MetricInline label={t.training.duration} value={durationLabel} icon="time-outline" />
              {log.distance != null && log.distance > 0 ? (
                <MetricInline
                  label={t.training.distance}
                  value={`${log.distance}`}
                  unit={log.distance_unit ?? 'km'}
                  icon="navigate-outline"
                />
              ) : null}
              {log.rpe != null ? (
                <MetricInline label="RPE" value={String(log.rpe)} unit="/10" icon="speedometer-outline" />
              ) : null}
            </View>
          </Card>
        )}

        {exerciseLines.length > 0 ? (
          <Card elevated style={styles.exerciseCard}>
            <AppText variant="caps12" color={colors.text.tertiary} style={styles.sectionLabel}>
              {i18n(t.training.exercises_count, { n: exerciseLines.length })}
            </AppText>
            {exerciseLines.map((line, index) => (
              <View
                key={line.name}
                style={[styles.exerciseLine, index < exerciseLines.length - 1 && styles.exerciseLineBorder]}
              >
                <AppText variant="body13Medium" color={colors.text.primary} style={styles.exerciseLineName}>
                  {line.name}
                </AppText>
                <AppText variant="body12" color={colors.text.secondary}>
                  {i18n(t.training.sets_count_line, { n: line.completedSets })}
                </AppText>
              </View>
            ))}
          </Card>
        ) : null}

        {log.comments ? (
          <Card style={styles.commentsCard}>
            <AppText variant="caps12" color={colors.text.tertiary} style={styles.sectionLabel}>
              {t.training.comments}
            </AppText>
            <AppText variant="body14" color={colors.text.secondary}>
              {log.comments}
            </AppText>
          </Card>
        ) : null}

        <Button
          label={celebrate ? t.training.back_to_program : t.training.go_back}
          icon={celebrate ? 'arrow-back' : 'chevron-back'}
          onPress={() => {
            if (celebrate) {
              navigation.reset({
                index: 0,
                routes: [{ name: 'Program' }],
              });
            } else {
              navigation.goBack();
            }
          }}
          fullWidth
          style={styles.cta}
        />
      </View>
    );
  };

  return (
    <View style={styles.flex}>
      {celebrate ? <Confetti active /> : null}
    <ScrollView
      style={styles.flex}
      contentContainerStyle={{
        paddingTop: insets.top + (celebrate ? spacing.lg : spacing.sm),
        paddingBottom: scrollBottom,
        paddingHorizontal: layout.screenPadding,
      }}
      showsVerticalScrollIndicator={false}
    >
      {!celebrate ? (
        <View style={styles.navRow}>
          <IconButton
            icon="chevron-back"
            onPress={() => navigation.goBack()}
            accessibilityLabel={t.training.go_back}
          />
          <AppText variant="body14SemiBold" color={colors.text.secondary}>
            {t.training.session_summary_title}
          </AppText>
          <View style={styles.navSpacer} />
        </View>
      ) : null}
      <FadeInView delay={120}>
        {renderContent()}
      </FadeInView>
    </ScrollView>
    </View>
  );
}

interface MetricInlineProps {
  label: string;
  value: string;
  unit?: string;
  icon: keyof typeof Ionicons.glyphMap;
}

function MetricInline({ label, value, unit, icon }: MetricInlineProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={metricStyles.cell}>
      <Ionicons name={icon} size={14} color={colors.text.tertiary} />
      <AppText variant="caps11" color={colors.text.tertiary}>
        {label}
      </AppText>
      <View style={metricStyles.valueRow}>
        <AppText variant="body14SemiBold" color={colors.text.primary}>
          {value}
        </AppText>
        {unit ? (
          <AppText variant="body12" color={colors.text.tertiary}>
            {unit}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const metricStyles = StyleSheet.create({
  cell: { gap: 2, minWidth: '30%' },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
});

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  navSpacer: { width: layout.minHitTarget },
  celebration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  detailHeader: {
    marginBottom: spacing.sm,
  },
  headerText: { flex: 1, gap: 2 },
  cardioMetrics: { marginTop: spacing.sm },
  cardioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  exerciseCard: { marginTop: spacing.sm },
  exerciseLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  exerciseLineBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  exerciseLineName: { flex: 1 },
  commentsCard: { marginTop: spacing.sm },
  sectionLabel: { marginBottom: spacing.xs },
  cta: { marginTop: spacing.lg },
});
