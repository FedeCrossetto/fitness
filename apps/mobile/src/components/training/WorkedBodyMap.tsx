import React, { useMemo } from 'react';
import { Image, ImageStyle, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collectWorkedZones,
  countCompletedSets,
  type BodyZoneId,
  type WorkoutSessionDetail,
} from '@reset-fitness/shared';
import { radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
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

/** PNG del diseñador: cuerpo completo + músculo en verde (assets/body/zones/). */
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

  const figure = (
    <View style={[styles.figureWrap, variant === 'hero' && styles.figureWrapHero, variant === 'mini' && styles.figureWrapMini]}>
      {hasZoneArt ? (
        illustratedZones.map((zone, index) => {
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
      ) : (
        <Image
          source={bodyBaseModel(gender)}
          style={styles.figure}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      )}
    </View>
  );

  if (variant === 'mini') {
    return figure;
  }

  const chips = (
    <View style={[styles.chips, variant === 'hero' && styles.chipsHero]}>
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
        ? {
            icon: 'fitness-outline' as const,
            label: t.training.exercises_metric,
            value: String(metrics.exerciseCount),
          }
        : null,
      metrics?.rpe != null
        ? { icon: 'speedometer-outline' as const, label: 'RPE', value: `${metrics.rpe}`, unit: '/10' }
        : null,
    ].filter(Boolean) as {
      icon: keyof typeof Ionicons.glyphMap;
      label: string;
      value: string;
      unit?: string;
    }[];

    return (
      <Card style={styles.heroCard}>
        <View style={styles.heroRow}>
          {figure}
          <View style={styles.heroMetrics}>
            <View style={styles.heroHeader}>
              <AppText variant="caps12" color={colors.text.tertiary}>
                {t.training.worked_zones_title}
              </AppText>
              <View style={[styles.zonesBadge, { backgroundColor: colors.surface.elevated }]}>
                <AppText variant="body12SemiBold" color={colors.primary.default}>
                  {i18n(t.training.zones_count, { n: workedZones.length })}
                </AppText>
              </View>
            </View>

            {topZone ? (
              <View style={styles.topZoneRow}>
                <AppText variant="body12" color={colors.text.tertiary}>
                  {t.training.top_zone_label}
                </AppText>
                <AppText variant="body13SemiBold" color={colors.text.primary} numberOfLines={1}>
                  {zoneLabel(t.training.body_zones, topZone.id)}
                </AppText>
              </View>
            ) : null}

            <View style={styles.statGrid}>
              {statItems.map((item) => (
                <View key={item.label} style={styles.statCell}>
                  <Ionicons name={item.icon} size={13} color={colors.text.tertiary} />
                  <AppText variant="caps11" color={colors.text.tertiary} numberOfLines={1}>
                    {item.label}
                  </AppText>
                  <View style={styles.statValueRow}>
                    <AppText variant="body14SemiBold" color={colors.text.primary}>
                      {item.value}
                    </AppText>
                    {item.unit ? (
                      <AppText variant="body12" color={colors.text.tertiary}>
                        {item.unit}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
        {chips}
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <AppText variant="caps12" color={colors.text.tertiary} style={styles.label}>
        {t.training.worked_zones_title}
      </AppText>
      {figure}
      {chips}
    </Card>
  );
}

function zoneLabel(
  labels: Record<BodyZoneId, string>,
  zoneId: BodyZoneId,
): string {
  return labels[zoneId] ?? zoneId;
}

const createStyles = (_colors: Colors) => StyleSheet.create({
  card: { marginTop: spacing.md },
  heroCard: { marginTop: spacing.sm },
  label: { marginBottom: spacing.sm },
  figureWrap: {
    alignSelf: 'center',
    width: 168,
    height: 252,
    marginBottom: spacing.sm,
  },
  figureWrapHero: {
    alignSelf: 'flex-start',
    width: 118,
    height: 178,
    marginBottom: 0,
    flexShrink: 0,
  },
  figureWrapMini: {
    width: 52,
    height: 78,
    marginBottom: 0,
    alignSelf: 'center',
  },
  figure: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  figureBlend: {
    mixBlendMode: 'lighten',
  } as ImageStyle,
  heroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  heroMetrics: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  zonesBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  topZoneRow: { gap: 1 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xxs,
  },
  statCell: {
    width: '47%',
    gap: 2,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipsHero: {
    paddingTop: spacing.xxs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: _colors.border.subtle,
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
