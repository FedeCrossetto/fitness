import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Card } from './Card';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  /** Delta vs período anterior, ej "+1.2 kg" */
  delta?: string;
  deltaPositive?: boolean;
  /** Texto de estado debajo del label (ej "Conectar Apple Health") */
  labelBadge?: string;
  labelBadgeColor?: string;
  labelBadgeIcon?: keyof typeof Ionicons.glyphMap;
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
  labelBadge,
  labelBadgeColor,
  labelBadgeIcon,
  icon,
  accent,
  onPress,
  size = 'medium',
  style,
}: MetricCardProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} style={style} accessibilityLabel={`${label}: ${value} ${unit ?? ''}`}>
      <View style={styles.header}>
        <View style={styles.labelCol}>
          <AppText variant="caps12" color={colors.text.tertiary}>
            {label}
          </AppText>
          {labelBadge ? (
            <View style={styles.badgeRow}>
              {labelBadgeIcon ? (
                <Ionicons
                  name={labelBadgeIcon}
                  size={13}
                  color={labelBadgeColor ?? colors.primary.default}
                />
              ) : null}
              <AppText variant="body12Medium" color={labelBadgeColor ?? colors.primary.default}>
                {labelBadge}
              </AppText>
            </View>
          ) : null}
        </View>
        {icon ? <Ionicons name={icon} size={16} color={accent ?? colors.primary.default} /> : null}
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
  labelCol: { flex: 1, gap: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xxs },
  unit: { marginBottom: 4 },
});
