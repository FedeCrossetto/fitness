import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { Colors, radius, spacing, useTheme, useThemedStyles } from '../../theme';
import { hapticSelect } from '../../lib/haptics';
import { AppText } from './AppText';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, active = false, onPress, style }: ChipProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const content = (
    <AppText
      variant="body13SemiBold"
      color={active ? colors.primary.onText : colors.text.secondary}
    >
      {label}
    </AppText>
  );

  if (!onPress) {
    return (
      <Pressable disabled style={[styles.base, active && styles.active, style]}>
        {content}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        hapticSelect();
        onPress();
      }}
      style={({ pressed }) => [styles.base, active && styles.active, pressed && styles.pressed, style]}
    >
      {content}
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    base: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.surface.elevated,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    active: {
      backgroundColor: colors.primary.default,
      borderColor: colors.primary.default,
    },
    pressed: { opacity: 0.8 },
  });
