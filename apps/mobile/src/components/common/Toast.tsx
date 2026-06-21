import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Colors, radius, spacing, shadows, useTheme, useThemedStyles } from '../../theme';
import { useUiStore } from '../../stores/uiStore';
import { AppText } from './AppText';

const ICONS = {
  success: 'checkmark-circle' as const,
  error: 'alert-circle' as const,
  info: 'information-circle' as const,
};

const BRAND_LIME = '#31F37B';

/** Toast global controlado por uiStore. Montar una sola vez en App. */
export function ToastHost(): React.JSX.Element | null {
  const toast = useUiStore((s) => s.toast);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!toast) return null;

  const iconColors = {
    success: BRAND_LIME,
    error: colors.states.error,
    info: colors.states.info,
  };

  return (
    <Animated.View
      key={toast.id}
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.container, { top: insets.top + spacing.sm }]}
      pointerEvents="none"
    >
      <View
        style={[
          styles.toast,
          toast.kind === 'success' && {
            backgroundColor: 'rgba(49, 243, 123, 0.16)',
            borderColor: 'rgba(49, 243, 123, 0.35)',
          },
        ]}
      >
        <Ionicons name={ICONS[toast.kind]} size={20} color={iconColors[toast.kind]} />
        <AppText variant="body14Medium" color={colors.text.primary} style={styles.message}>
          {toast.message}
        </AppText>
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      left: spacing.lg,
      right: spacing.lg,
      zIndex: 100,
      alignItems: 'center',
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.surface.elevated,
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      maxWidth: '100%',
      ...shadows.soft,
    },
    message: { flexShrink: 1 },
  });
