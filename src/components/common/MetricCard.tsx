import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { AppText } from './AppText';
import { Card } from './Card';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  /** Delta vs período anterior, ej "+1.2 kg" */
  delta?: string;
  deltaPositive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  accent?: string;
  onPress?: () => void;
  size?: 'medium' | 'large';
  style?: StyleProp<ViewStyle>;
}

export function MetricCard({
  label,
  value,
  unit,
  delta,
  deltaPositive = true,
  icon,
  accent = colors.primary.default,
  onPress,
  size = 'medium',
  style,
}: MetricCardProps): React.JSX.Element {
  return (
    <Card onPress={onPress} style={style} accessibilityLabel={`${label}: ${value} ${unit ?? ''}`}>
      <View style={styles.header}>
        <AppText variant="caps12" color={colors.text.tertiary}>
          {label}
        </AppText>
        {icon ? <Ionicons name={icon} size={16} color={accent} /> : null}
      </View>
      <View style={styles.valueRow}>
        <AppText variant={size === 'large' ? 'metricLarge' : 'metricMedium'} color={colors.text.primary}>
          {value}
        </AppText>
        {unit ? (
          <AppText variant="body13Medium" color={colors.text.tertiary} style={styles.unit}>
            {unit}
          </AppText>
        ) : null}
      </View>
      {delta ? (
        <AppText
          variant="body12Medium"
          color={deltaPositive ? colors.primary.default : colors.text.tertiary}
        >
          {delta}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xxs },
  unit: { marginBottom: 4 },
});
