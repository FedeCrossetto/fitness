import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { spacing, emptyStateIllustration, Pillar, useTheme } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';

interface EmptyStateProps {
  pillar?: Pillar | 'generic';
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

/** Estado vacío con la mascota de la marca como protagonista. */
export function EmptyState({
  pillar = 'generic',
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, compact && styles.compact]}>
      <Image
        source={emptyStateIllustration[pillar]}
        style={compact ? styles.mascotCompact : styles.mascot}
        contentFit="contain"
        transition={200}
      />
      <AppText variant="h3" color={colors.text.primary} align="center" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="body14" color={colors.text.secondary} align="center" style={styles.message}>
        {message}
      </AppText>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  compact: { paddingVertical: spacing.lg },
  mascot: { width: 180, height: 220 },
  mascotCompact: { width: 120, height: 150 },
  title: { marginTop: spacing.lg },
  message: { marginTop: spacing.xs, maxWidth: 280 },
  action: { marginTop: spacing.xl, minWidth: 200 },
});
