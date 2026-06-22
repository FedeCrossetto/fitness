import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, spacing, useThemedStyles, useTheme } from '../../theme';
import { hapticTap } from '../../lib/haptics';
import { NUTRITION_MACRO_COLORS } from '../nutrition/nutritionTheme';
import { AppText, ProgressBar } from '../common';

const PROGRESS_BAR_COLOR = NUTRITION_MACRO_COLORS.carbs;

interface HomeProgressMetricCardProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  suffix?: string;
  subtitle?: string;
  subtitleColor?: string;
  subtitleIcon?: keyof typeof Ionicons.glyphMap;
  /** 0..1 — omit to hide the bar */
  progress?: number;
  progressColor?: string;
  valueLarge?: boolean;
  accessibilityLabel: string;
  onPress: () => void;
}

export function HomeProgressMetricCard({
  label,
  icon,
  value,
  suffix,
  subtitle,
  subtitleColor,
  subtitleIcon,
  progress,
  progressColor,
  valueLarge = true,
  accessibilityLabel,
  onPress,
}: HomeProgressMetricCardProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const handlePress = (): void => {
    hapticTap();
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <AppText variant="caps11" color={colors.text.tertiary} style={styles.label}>
          {label}
        </AppText>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={15} color={colors.text.primary} />
        </View>
      </View>

      <View style={styles.valueRow}>
        <AppText
          variant={valueLarge ? 'metricSmall' : 'body16SemiBold'}
          color={colors.text.primary}
          numberOfLines={2}
          style={styles.value}
        >
          {value}
        </AppText>
        {suffix ? (
          <AppText variant="body13Medium" color={colors.text.tertiary} style={styles.suffix}>
            {suffix}
          </AppText>
        ) : null}
      </View>

      {subtitle ? (
        <View style={styles.subtitleRow}>
          {subtitleIcon ? (
            <Ionicons
              name={subtitleIcon}
              size={12}
              color={subtitleColor ?? colors.text.tertiary}
            />
          ) : null}
          <AppText
            variant="body12"
            color={subtitleColor ?? colors.text.tertiary}
            numberOfLines={1}
            style={styles.subtitle}
          >
            {subtitle}
          </AppText>
        </View>
      ) : null}

      {progress !== undefined ? (
        <ProgressBar
          progress={progress}
          height={4}
          color={progressColor ?? PROGRESS_BAR_COLOR}
          style={styles.bar}
        />
      ) : (
        <View style={styles.barSpacer} />
      )}
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.surface.base,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.sm + 2,
      paddingVertical: spacing.sm + 2,
      gap: spacing.xxs,
      minHeight: 104,
      justifyContent: 'space-between',
    },
    pressed: {
      opacity: 0.92,
      transform: [{ scale: 0.985 }],
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.xs,
    },
    label: {
      flex: 1,
      letterSpacing: 0.5,
    },
    iconWrap: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      backgroundColor: colors.surface.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      flexWrap: 'wrap',
      gap: spacing.xxs,
      marginTop: spacing.xxs,
    },
    value: {
      flexShrink: 1,
    },
    suffix: {
      marginBottom: 2,
    },
    subtitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 16,
    },
    subtitle: {
      flex: 1,
    },
    bar: {
      marginTop: spacing.xxs,
    },
    barSpacer: {
      height: 4,
      marginTop: spacing.xxs,
    },
  });
