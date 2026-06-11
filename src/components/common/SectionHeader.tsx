import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../../theme';
import { AppText } from './AppText';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps): React.JSX.Element {
  return (
    <View style={styles.row}>
      <AppText variant="h3" color={colors.text.primary}>
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <AppText variant="body13SemiBold" color={colors.primary.default}>
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
  },
});
