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
}

export function RecentWorkoutFeed({ logs, loading = false, limit = 6 }: RecentWorkoutFeedProps): React.JSX.Element {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const navigation = useNavigation<NavigationProp<MainTabsParamList>>();

  const entries = useMemo(
    () => logs.filter((log) => log.workout_type === 'fuerza' || log.workout_type === 'cardio').slice(0, limit),
    [logs, limit],
  );

  if (loading && entries.length === 0) {
    return (
      <View style={styles.wrap}>
        <AppText variant="caps12" color={colors.text.tertiary} style={styles.heading}>
          {t.training.recent_activity}
        </AppText>
        <CardSkeleton />
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.wrap}>
        <AppText variant="caps12" color={colors.text.tertiary} style={styles.heading}>
          {t.training.recent_activity}
        </AppText>
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
    <View style={styles.wrap}>
      <AppText variant="caps12" color={colors.text.tertiary} style={styles.heading}>
        {t.training.recent_activity}
      </AppText>
      <View style={styles.list}>
        {entries.map((log) => {
          const isCardio = log.workout_type === 'cardio';
          const lines = summarizeWorkoutForFeed(log.session_detail);
          const hiddenCount = Math.max(0, lines.length - 3);
          const duration = formatWorkoutDuration(log.duration_min, log.elapsed_seconds ?? log.duration_seconds);
          const volume = !isCardio ? formatWorkoutVolume(log.total_volume_kg) : null;

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
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <View style={styles.cardTop}>
                <View style={[styles.iconWrap, isCardio && styles.iconWrapCardio]}>
                  <Ionicons
                    name={isCardio ? 'pulse-outline' : 'barbell-outline'}
                    size={18}
                    color={colors.primary.default}
                  />
                </View>
                <View style={styles.cardHead}>
                  <AppText variant="body14SemiBold" color={colors.text.primary} numberOfLines={2}>
                    {log.workout_name}
                  </AppText>
                  <AppText variant="body12" color={colors.text.tertiary}>
                    {formatShortDate(log.date)}
                  </AppText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
              </View>

              <View style={styles.statsRow}>
                <AppText variant="body12Medium" color={colors.text.secondary}>
                  {duration}
                </AppText>
                {volume ? (
                  <AppText variant="body12Medium" color={colors.text.secondary}>
                    {volume}
                  </AppText>
                ) : null}
                {isCardio && log.distance != null && log.distance > 0 ? (
                  <AppText variant="body12Medium" color={colors.text.secondary}>
                    {log.distance} {log.distance_unit ?? 'km'}
                  </AppText>
                ) : null}
              </View>

              {lines.length > 0 ? (
                <View style={styles.lines}>
                  {lines.slice(0, 3).map((line) => (
                    <AppText key={`${log.id}-${line.name}`} variant="body12" color={colors.text.secondary} numberOfLines={1}>
                      {i18n(t.training.sets_count_line, { n: line.completedSets })} · {line.name}
                    </AppText>
                  ))}
                  {hiddenCount > 0 ? (
                    <AppText variant="body12" color={colors.text.tertiary}>
                      {i18n(t.training.see_more_exercises, { n: hiddenCount })}
                    </AppText>
                  ) : null}
                </View>
              ) : null}
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
    heading: { marginBottom: spacing.sm },
    list: { gap: spacing.sm },
    card: {
      backgroundColor: colors.surface.base,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      padding: spacing.md,
      gap: spacing.sm,
    },
    pressed: { opacity: 0.9 },
    cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.primary.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapCardio: { backgroundColor: colors.surface.elevated },
    cardHead: { flex: 1, gap: 2 },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    lines: { gap: 4 },
  });
