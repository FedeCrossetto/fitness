import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import {
  formatWorkoutDuration,
  formatWorkoutVolume,
  summarizeWorkoutForFeed,
} from '@reset-fitness/shared';
import { AppText, CardSkeleton, EmptyState } from '../common';
import { radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatShortDate } from '../../lib/dates';
import { hapticTap } from '../../lib/haptics';
import { useTranslation } from '../../stores/i18nStore';
import type { WorkoutLogRow } from '../../types/database';
import type { MainTabsParamList } from '../../types/navigation';

interface RecentWorkoutFeedProps {
  logs: WorkoutLogRow[];
  loading?: boolean;
  limit?: number;
  compact?: boolean;
}

export function RecentWorkoutFeed({
  logs,
  loading = false,
  limit = 6,
  compact = false,
}: RecentWorkoutFeedProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NavigationProp<MainTabsParamList>>();

  const entries = useMemo(
    () => logs.filter((log) => log.workout_type === 'fuerza' || log.workout_type === 'cardio').slice(0, limit),
    [logs, limit],
  );

  const heading = (
    <View style={styles.headingWrap}>
      <AppText variant="caps11" color={colors.text.secondary}>
        {t.training.recent_activity}
      </AppText>
      {compact ? (
        <AppText variant="body12" color={colors.text.tertiary}>
          {t.training.recent_activity_subtitle}
        </AppText>
      ) : null}
    </View>
  );

  if (loading && entries.length === 0) {
    return (
      <View style={[styles.wrap, compact && styles.wrapCompact]}>
        {heading}
        <CardSkeleton />
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={[styles.wrap, compact && styles.wrapCompact]}>
        {heading}
        <EmptyState
          pillar="training"
          hideIllustration
          title={t.training.no_recent_workouts}
          message={t.training.no_recent_workouts_message}
          compact
        />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {heading}
      <View style={styles.list}>
        {entries.map((log) => {
          const isCardio = log.workout_type === 'cardio';
          const lines = summarizeWorkoutForFeed(log.session_detail);
          const duration = formatWorkoutDuration(log.duration_min, log.elapsed_seconds ?? log.duration_seconds);
          const volume = !isCardio ? formatWorkoutVolume(log.total_volume_kg) : null;
          const stats = [
            duration,
            volume,
            isCardio && log.distance != null && log.distance > 0
              ? `${log.distance} ${log.distance_unit ?? 'km'}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ');
          const topExercise = lines[0];

          return (
            <Pressable
              key={log.id}
              accessibilityRole="button"
              onPress={() => {
                hapticTap();
                navigation.navigate('TrainingTab', {
                  screen: 'SessionSummary',
                  params: { logId: log.id },
                });
              }}
              style={({ pressed }) => [styles.card, compact && styles.cardCompact, pressed && styles.pressed]}
            >
              <View style={[styles.iconWrap, compact && styles.iconWrapCompact]}>
                <Ionicons
                  name={isCardio ? 'pulse-outline' : 'barbell-outline'}
                  size={compact ? 14 : 18}
                  color={colors.text.secondary}
                />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <AppText
                    variant={compact ? 'body13Medium' : 'body14SemiBold'}
                    color={colors.text.primary}
                    numberOfLines={1}
                    style={styles.cardTitle}
                  >
                    {log.workout_name}
                  </AppText>
                  <AppText variant="body12" color={colors.text.tertiary}>
                    {formatShortDate(log.date)}
                  </AppText>
                </View>
                {stats ? (
                  <AppText variant="body12" color={colors.text.secondary} numberOfLines={1}>
                    {stats}
                  </AppText>
                ) : null}
                {!compact && topExercise ? (
                  <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1}>
                    {i18n(t.training.sets_count_line, { n: topExercise.completedSets })} · {topExercise.name}
                    {lines.length > 1
                      ? ` · ${i18n(t.training.see_more_exercises, { n: lines.length - 1 })}`
                      : ''}
                  </AppText>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={14} color={colors.text.tertiary} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: { marginTop: spacing.lg },
    wrapCompact: {
      marginTop: spacing.xl,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.border.default,
    },
    headingWrap: { gap: 2, marginBottom: spacing.sm },
    list: { gap: spacing.xs },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface.base,
      borderRadius: radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border.subtle,
      padding: spacing.md,
    },
    cardCompact: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      gap: spacing.xs,
    },
    pressed: { opacity: 0.88 },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.surface.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border.subtle,
    },
    iconWrapCompact: {
      width: 28,
      height: 28,
    },
    cardBody: { flex: 1, gap: 2, minWidth: 0 },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    cardTitle: { flex: 1 },
  });
