import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, radius, spacing, useThemedStyles, useTheme } from '../../theme';
import { AppText } from '../common/AppText';
import { BottomSheet } from '../common/BottomSheet';
import { MEAL_TYPES, mealLabelKey } from '../../lib/meals';
import { useTranslation } from '../../stores/i18nStore';
import type { MealType } from '../../types/database';

interface MealSectionActionsSheetProps {
  visible: boolean;
  sourceMealType: MealType;
  sourceTitle: string;
  itemCount: number;
  onClose: () => void;
  onDuplicate: (targetMealType: MealType) => void;
}

export function MealSectionActionsSheet({
  visible,
  sourceMealType,
  sourceTitle,
  itemCount,
  onClose,
  onDuplicate,
}: MealSectionActionsSheetProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t, i18n } = useTranslation();

  const targetMeals = MEAL_TYPES.filter((type) => type !== sourceMealType);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={sourceTitle}
      subtitle={t.nutrition.meal_actions_subtitle}
    >
      <View style={styles.section}>
        <AppText variant="caps12" color={colors.text.tertiary}>
          {t.nutrition.duplicate_meal_section}
        </AppText>
        <AppText variant="body13" color={colors.text.secondary} style={styles.hint}>
          {itemCount > 0
            ? i18n(t.nutrition.duplicate_meal_hint, { n: itemCount })
            : t.nutrition.duplicate_meal_empty}
        </AppText>

        {targetMeals.map((type) => (
          <Pressable
            key={type}
            accessibilityRole="button"
            disabled={itemCount === 0}
            onPress={() => onDuplicate(type)}
            style={({ pressed }) => [
              styles.targetRow,
              itemCount === 0 && styles.targetRowDisabled,
              pressed && itemCount > 0 && styles.pressed,
            ]}
          >
            <View style={styles.targetIcon}>
              <Ionicons name="copy-outline" size={18} color={colors.text.primary} />
            </View>
            <AppText variant="body16Medium" color={colors.text.primary} style={styles.targetLabel}>
              {t.nutrition[mealLabelKey(type)]}
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    section: {
      gap: spacing.sm,
      paddingBottom: spacing.sm,
    },
    hint: {
      marginBottom: spacing.xs,
    },
    targetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface.elevated,
      borderWidth: 1,
      borderColor: colors.border.subtle,
    },
    targetRowDisabled: {
      opacity: 0.45,
    },
    targetIcon: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: colors.surface.base,
      alignItems: 'center',
      justifyContent: 'center',
    },
    targetLabel: {
      flex: 1,
    },
    pressed: { opacity: 0.75 },
  });
