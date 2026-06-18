import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
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
  hideIllustration?: boolean;
  /** Menos padding y tipografía más chica — para no competir con el dashboard. */
  subdued?: boolean;
  titleColor?: string;
  messageColor?: string;
  actionBackgroundColor?: string;
  actionTextColor?: string;
}

export function EmptyState({
  pillar = 'generic',
  title,
  message,
  actionLabel,
  onAction,
  compact = false,
  hideIllustration = false,
  subdued = false,
  titleColor,
  messageColor,
  actionBackgroundColor,
  actionTextColor,
}: EmptyStateProps): React.JSX.Element {
  const { colors } = useTheme();
  const resolvedTitleColor = titleColor ?? colors.text.primary;
  const resolvedMessageColor = messageColor ?? colors.text.secondary;

  return (
    <View style={[styles.container, compact && styles.compact, subdued && styles.subdued]}>
      {!hideIllustration ? (
        <Image
          source={emptyStateIllustration[pillar]}
          style={compact ? styles.mascotCompact : styles.mascot}
          contentFit="contain"
          transition={200}
        />
      ) : null}
      <AppText
        variant={subdued ? 'body14Medium' : 'h3'}
        color={resolvedTitleColor}
        align="center"
        style={[styles.title, hideIllustration && styles.titleNoIllustration, subdued && styles.subduedTitle]}
      >
        {title}
      </AppText>
      <AppText
        variant={subdued ? 'body12' : 'body14'}
        color={resolvedMessageColor}
        align="center"
        style={[styles.message, subdued && styles.subduedMessage]}
      >
        {message}
      </AppText>
      {actionLabel && onAction ? (
        actionBackgroundColor ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            onPress={onAction}
            style={({ pressed }) => [
              styles.customAction,
              subdued && styles.subduedAction,
              { backgroundColor: actionBackgroundColor },
              pressed && styles.actionPressed,
            ]}
          >
            <AppText variant="body16SemiBold" color={actionTextColor ?? '#111111'}>
              {actionLabel}
            </AppText>
          </Pressable>
        ) : (
          <Button label={actionLabel} onPress={onAction} style={styles.action} />
        )
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
  subdued: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  mascot: { width: 180, height: 220 },
  mascotCompact: { width: 120, height: 150 },
  title: { marginTop: spacing.lg },
  titleNoIllustration: { marginTop: 0 },
  subduedTitle: { marginTop: spacing.sm },
  subduedMessage: { marginTop: spacing.xxs },
  message: { marginTop: spacing.xs, maxWidth: 280 },
  action: { marginTop: spacing.xl, minWidth: 200 },
  customAction: {
    marginTop: spacing.lg,
    minWidth: 200,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: spacing.xl,
  },
  subduedAction: {
    marginTop: spacing.md,
    minHeight: 40,
    borderRadius: 12,
  },
  actionPressed: { opacity: 0.85 },
});
