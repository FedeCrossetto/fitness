import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, spacing, useThemedStyles, useTheme } from '../../theme';
import { useTranslation } from '../../stores/i18nStore';
import { AppText } from '../common/AppText';

interface FoodCreateActionsProps {
  onManual: () => void;
  onScan: () => void;
  onVoice: () => void;
}

export function FoodCreateActions({ onManual, onScan, onVoice }: FoodCreateActionsProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const actions = [
    { key: 'manual', icon: 'create-outline' as const, label: t.nutrition.manual_entry, onPress: onManual },
    { key: 'scan', icon: 'barcode-outline' as const, label: t.nutrition.scan, onPress: onScan },
    { key: 'voice', icon: 'mic-outline' as const, label: t.nutrition.voice, onPress: onVoice },
  ];

  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <View style={styles.iconWrap}>
            <Ionicons name={action.icon} size={20} color={colors.text.primary} />
          </View>
          <AppText variant="body12Medium" color={colors.text.secondary}>
            {action.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    action: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface.elevated,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      backgroundColor: colors.surface.base,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pressed: { opacity: 0.75 },
  });
