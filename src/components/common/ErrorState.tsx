import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../../theme';
import { AppText } from './AppText';
import { Button } from './Button';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="cloud-offline-outline" size={28} color={colors.text.tertiary} />
      </View>
      <AppText variant="body16SemiBold" color={colors.text.primary} align="center">
        Algo salió mal
      </AppText>
      <AppText variant="body14" color={colors.text.secondary} align="center" style={styles.message}>
        {message}
      </AppText>
      {onRetry ? (
        <Button label="Reintentar" variant="secondary" size="md" onPress={onRetry} style={styles.retry} />
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
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  message: { marginTop: spacing.xxs, maxWidth: 280 },
  retry: { marginTop: spacing.lg },
});
