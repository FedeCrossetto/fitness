import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { colors, radius, spacing, shadows } from '../../theme';
import { useUiStore } from '../../stores/uiStore';
import { AppText } from './AppText';

const ICONS = {
  success: 'checkmark-circle' as const,
  error: 'alert-circle' as const,
  info: 'information-circle' as const,
};

const ICON_COLORS = {
  success: colors.states.success,
  error: colors.states.error,
  info: colors.states.info,
};

/** Toast global controlado por uiStore. Montar una sola vez en App. */
export function ToastHost(): React.JSX.Element | null {
  const toast = useUiStore((s) => s.toast);
  const insets = useSafeAreaInsets();

  if (!toast) return null;

  return (
    <Animated.View
      key={toast.id}
      entering={FadeInUp.duration(250)}
      exiting={FadeOutUp.duration(200)}
      style={[styles.container, { top: insets.top + spacing.sm }]}
      pointerEvents="none"
    >
      <View style={styles.toast}>
        <Ionicons name={ICONS[toast.kind]} size={20} color={ICON_COLORS[toast.kind]} />
        <AppText variant="body14Medium" color={colors.text.primary} style={styles.message}>
          {toast.message}
        </AppText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
