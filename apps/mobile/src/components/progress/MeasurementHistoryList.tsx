import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, useTheme } from '../../theme';
import { formatLongDate } from '../../lib/dates';
import { weightDeltaColor } from '../../lib/weightDeltaColor';
import { AppText } from '../common';
import type { BodyMeasurementRow } from '../../types/database';

interface MeasurementHistoryListProps {
  measurements: BodyMeasurementRow[];
  limit?: number;
  weightOnly?: boolean;
  footerLabel?: string;
  onFooterPress?: () => void;
}

export function MeasurementHistoryList({
  measurements,
  limit = 5,
  weightOnly = false,
  footerLabel,
  onFooterPress,
}: MeasurementHistoryListProps): React.JSX.Element | null {
  const { colors } = useTheme();
  const rows = weightOnly ? measurements.filter((m) => m.weight_kg !== null) : measurements;
  const history = rows.slice(0, limit);
  if (history.length === 0) return null;

  return (
    <View>
      {history.map((m, index) => {
        const prev = history[index + 1];
        const delta =
          m.weight_kg !== null && prev?.weight_kg !== null && prev?.weight_kg !== undefined
            ? m.weight_kg - prev.weight_kg
            : null;
        const isLast = index === history.length - 1 && !footerLabel;
        return (
          <View
            key={m.id}
            style={[
              styles.row,
              !isLast && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border.subtle,
              },
            ]}
          >
            <View style={styles.info}>
              <AppText variant="body14Medium" color={colors.text.primary}>
                {formatLongDate(m.date)}
              </AppText>
              {delta !== null ? (
                <AppText
                  variant="body12Medium"
                  color={weightDeltaColor(delta, colors)}
                >
                  {delta > 0 ? '+' : ''}
                  {delta.toFixed(1)} kg
                </AppText>
              ) : null}
            </View>
            <AppText variant="body14SemiBold" color={colors.text.primary}>
              {m.weight_kg !== null ? `${m.weight_kg.toFixed(1)} kg` : '—'}
            </AppText>
          </View>
        );
      })}
      {footerLabel && onFooterPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onFooterPress}
          style={styles.footer}
        >
          <AppText variant="body14SemiBold" color={colors.primary.default}>
            {footerLabel}
          </AppText>
          <Ionicons name="chevron-forward" size={16} color={colors.primary.default} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  info: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingTop: spacing.sm,
    marginTop: spacing.xxs,
  },
});
