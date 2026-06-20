import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { spacing, useTheme } from '../../theme';
import { bodyModels } from '../../theme/illustrations';
import { AppText } from '../common';
import { useTranslation } from '../../stores/i18nStore';
import type { BodyMeasurementRow } from '../../types/database';

export type BodyGender = 'male' | 'female';

function formatCm(value: number | null | undefined): string {
  return value !== null && value !== undefined ? `${value} cm` : '—';
}

export function BodyAvatar({
  latest,
  gender,
}: {
  latest: BodyMeasurementRow | undefined;
  gender: BodyGender;
}): React.JSX.Element {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <View style={styles.sideColumn}>
        <View style={styles.labelBlock}>
          <AppText variant="caps11" color={colors.text.tertiary}>
            {t.progress.arms}
          </AppText>
          <AppText variant="body14SemiBold" color={colors.text.primary}>
            {formatCm(latest?.arms_cm)}
          </AppText>
        </View>
        <View style={styles.labelBlock}>
          <AppText variant="caps11" color={colors.text.tertiary}>
            {t.progress.waist}
          </AppText>
          <AppText variant="body14SemiBold" color={colors.text.primary}>
            {formatCm(latest?.waist_cm)}
          </AppText>
        </View>
      </View>

      <Image
        source={bodyModels[gender]}
        style={styles.bodyImage}
        resizeMode="contain"
        accessibilityLabel={gender === 'female' ? 'Figura corporal femenina' : 'Figura corporal masculina'}
      />

      <View style={styles.sideColumn}>
        <View style={styles.labelBlock}>
          <AppText variant="caps11" color={colors.text.tertiary}>
            {t.progress.chest}
          </AppText>
          <AppText variant="body14SemiBold" color={colors.text.primary}>
            {formatCm(latest?.chest_cm)}
          </AppText>
        </View>
        <View style={styles.labelBlock}>
          <AppText variant="caps11" color={colors.text.tertiary}>
            {t.progress.hips}
          </AppText>
          <AppText variant="body14SemiBold" color={colors.text.primary}>
            {formatCm(latest?.hips_cm)}
          </AppText>
        </View>
        <View style={styles.labelBlock}>
          <AppText variant="caps11" color={colors.text.tertiary}>
            {t.progress.legs}
          </AppText>
          <AppText variant="body14SemiBold" color={colors.text.primary}>
            {formatCm(latest?.legs_cm)}
          </AppText>
        </View>
      </View>
    </View>
  );
}

export function hasBodyMeasures(latest: BodyMeasurementRow | undefined): boolean {
  if (!latest) return false;
  return [latest.chest_cm, latest.waist_cm, latest.hips_cm, latest.arms_cm, latest.legs_cm].some(
    (v) => v !== null
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideColumn: {
    flex: 1,
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  labelBlock: { gap: 2 },
  bodyImage: { width: 132, height: 248 },
});
