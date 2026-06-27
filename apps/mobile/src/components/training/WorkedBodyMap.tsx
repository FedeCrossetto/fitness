import React, { useMemo } from 'react';
import { Image, ImageStyle, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collectWorkedZones,
  countCompletedSets,
  type BodyZoneId,
  type WorkoutSessionDetail,
} from '@reset-fitness/shared';
import { radius, shadows, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { bodyBaseModel, bodyZoneOverlay } from '../../theme/bodyZoneAssets';
import { AppText, Card } from '../common';
import type { BodyGender } from '../progress';
import { useTranslation } from '../../stores/i18nStore';

export type WorkedBodyMapMetrics = {
  durationLabel?: string;
  volumeLabel?: string;
  completedSets?: number;
  exerciseCount?: number;
  rpe?: number | null;
};

type Props = {
  sessionDetail: WorkoutSessionDetail | null | undefined;
  gender?: BodyGender;
  variant?: 'hero' | 'card' | 'mini';
  metrics?: WorkedBodyMapMetrics;
};

export function WorkedBodyMap({
  sessionDetail,
  gender = 'male',
  variant = 'card',
  metrics,
}: Props): React.JSX.Element | null {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const styles = useThemedStyles(createStyles);

  const workedZones = useMemo(() => collectWorkedZones(sessionDetail), [sessionDetail]);
  const illustratedZones = useMemo(
    () => workedZones.filter((zone) => bodyZoneOverlay(gender, zone.id) != null),
    [gender, workedZones],
  );

  if (workedZones.length === 0) return null;

  const hasZoneArt = illustratedZones.length > 0;
  const topZone = workedZones[0];
  const completedSets =
    metrics?.completedSets ??
    (sessionDetail ? countCompletedSets(sessionDetail) : 0);

  const figureLayers = hasZoneArt
    ? illustratedZones.map((zone, index) => {
        const source = bodyZoneOverlay(gender, zone.id);
        if (!source) return null;
        return (
          <Image
            key={zone.id}
            source={source}
            style={[styles.figure, index > 0 && styles.figureBlend]}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
        );
      })
    : [
        <Image
          key="base"
          source={bodyBaseModel(gender)}
          style={styles.figure}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />,
      ];

  if (variant === 'mini') {
    // Sin wrapper propio: llena el contenedor del padre (miniMapWrap en RecentWorkoutFeed)
    return <>{figureLayers}</>;
  }

  const chips = (
    <View style={styles.chips}>
      {workedZones.map((zone) => (
        <View
          key={zone.id}
          style={[
            styles.chip,
            {
              backgroundColor: colors.surface.elevated,
              borderColor: illustratedZones.some((item) => item.id === zone.id)
                ? colors.primary.default
                : colors.border.subtle,
            },
          ]}
        >
          <AppText variant="body12SemiBold" color={colors.text.primary}>
            {zoneLabel(t.training.body_zones, zone.id)}
          </AppText>
          <AppText variant="body12" color={colors.text.tertiary}>
            {i18n(t.training.zone_sets_count, { n: zone.completedSets })}
          </AppText>
        </View>
      ))}
    </View>
  );

  if (variant === 'hero') {
    const statItems = [
      metrics?.durationLabel
        ? { icon: 'time-outline' as const, label: t.training.duration, value: metrics.durationLabel }
        : null,
      metrics?.volumeLabel
        ? { icon: 'barbell-outline' as const, label: t.training.volume, value: metrics.volumeLabel }
        : null,
      {
        icon: 'layers-outline' as const,
        label: t.training.sets_completed,
        value: String(completedSets),
      },
      metrics?.exerciseCount != null
        ? { icon: 'fitness-outline' as const, label: t.training.exercises_metric, value: String(metrics.exerciseCount) }
        : null,
    ].filter(Boolean) as { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[];

    return (
      <View style={[styles.heroCard, { backgroundColor: colors.surface.elevated, borderColor: colors.border.subtle }]}>
        {/* Badge row */}
        <View style={styles.heroBadgeRow}>
          <View style={[styles.zonesBadge, { backgroundColor: colors.primary.muted }]}>
            <AppText variant="body12SemiBold" color={colors.primary.default}>
              {i18n(t.training.zones_count, { n: workedZones.length })}
            </AppText>
          </View>
          {topZone ? (
            <AppText variant="body12" color={colors.text.tertiary} numberOfLines={1} style={styles.topZoneLabel}>
              {t.training.top_zone_label}{' '}
              <AppText variant="body12SemiBold" color={colors.text.secondary}>
                {zoneLabel(t.training.body_zones, topZone.id)}
              </AppText>
            </AppText>
          ) : null}
        </View>

        {/* Body + zone list */}
        <View style={styles.heroBody}>
          <View style={styles.figureWrapHero}>
            {figureLayers}
          </View>

          <View style={styles.heroZoneList}>
            {workedZones.slice(0, 5).map((zone, i) => (
              <View key={zone.id} style={styles.heroZoneItem}>
                <View
                  style={[
                    styles.heroZoneTick,
                    { backgroundColor: i === 0 ? colors.primary.default : colors.border.strong },
                  ]}
                />
                <View style={styles.heroZoneText}>
                  <AppText
                    variant={i === 0 ? 'body13SemiBold' : 'body13'}
                    color={i === 0 ? colors.text.primary : colors.text.secondary}
                    numberOfLines={1}
                  >
                    {zoneLabel(t.training.body_zones, zone.id)}
                  </AppText>
                  <AppText variant="body12" color={colors.text.tertiary}>
                    {zone.completedSets} {zone.completedSets === 1 ? 'serie' : 'series'}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Stats strip */}
        <View style={[styles.heroStatsRow, { borderTopColor: colors.border.subtle }]}>
          {statItems.map((item) => (
            <View key={item.label} style={styles.heroStatCell}>
              <Ionicons name={item.icon} size={12} color={colors.text.tertiary} />
              <AppText variant="caps11" color={colors.text.tertiary} numberOfLines={1}>
                {item.label}
              </AppText>
              <AppText variant="body14SemiBold" color={colors.text.primary}>
                {item.value}
              </AppText>
            </View>
          ))}
        </View>

        {/* Zone chips */}
        <View style={[styles.heroChips, { borderTopColor: colors.border.subtle }]}>
          {chips}
        </View>
      </View>
    );
  }

  return (
    <Card style={styles.card}>
      <AppText variant="caps12" color={colors.text.tertiary} style={styles.label}>
        {t.training.worked_zones_title}
      </AppText>
      <View style={styles.figureWrap}>
        {figureLayers}
      </View>
      {chips}
    </Card>
  );
}

function zoneLabel(labels: Record<BodyZoneId, string>, zoneId: BodyZoneId): string {
  return labels[zoneId] ?? zoneId;
}

const createStyles = (_colors: Colors) => StyleSheet.create({
  card: { marginTop: spacing.md },
  label: { marginBottom: spacing.sm },
  figureWrap: {
    alignSelf: 'center',
    width: 168,
    height: 252,
    marginBottom: spacing.sm,
  },
  figureWrapHero: {
    width: 148,
    height: 222,
    flexShrink: 0,
  },
figure: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  figureBlend: {
    mixBlendMode: 'lighten',
  } as ImageStyle,

  // Hero layout
  heroCard: {
    marginTop: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.soft,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  zonesBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  topZoneLabel: {
    flex: 1,
    textAlign: 'right',
  },
  heroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  heroZoneList: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
  },
  heroZoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroZoneTick: {
    width: 16,
    height: 2,
    borderRadius: 1,
    flexShrink: 0,
  },
  heroZoneText: {
    flex: 1,
    gap: 1,
  },
  heroStatsRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  heroStatCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  heroChips: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  // Chips (shared)
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
});
