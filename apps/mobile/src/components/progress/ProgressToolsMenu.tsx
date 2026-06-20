import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { hapticTap } from '../../lib/haptics';
import { AppText } from '../common';
import { useTranslation } from '../../stores/i18nStore';

interface MenuItem {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}

interface ProgressToolsMenuProps {
  onMeasurements: () => void;
  onPhotos: () => void;
  onHydration: () => void;
  onWeightDetail?: () => void;
  showWeightDetail?: boolean;
}

export function ProgressToolsMenu({
  onMeasurements,
  onPhotos,
  onHydration,
  onWeightDetail,
  showWeightDetail = false,
}: ProgressToolsMenuProps): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const items: MenuItem[] = [
    {
      key: 'measurements',
      icon: 'scale-outline',
      title: t.progress.register_cta_title,
      subtitle: t.progress.register_cta_sub,
      onPress: onMeasurements,
    },
    ...(showWeightDetail && onWeightDetail
      ? [{
          key: 'weight',
          icon: 'trending-up-outline' as const,
          title: t.progress.weight,
          subtitle: t.progress.evolution,
          onPress: onWeightDetail,
        }]
      : []),
    {
      key: 'photos',
      icon: 'camera-outline',
      title: t.progress.photos,
      subtitle: t.progress.photos_sub,
      onPress: onPhotos,
    },
    {
      key: 'hydration',
      icon: 'water-outline',
      title: t.progress.hydration,
      subtitle: t.progress.hydration_sub,
      onPress: onHydration,
    },
  ];

  return (
    <View style={styles.list}>
      {items.map((item, index) => (
        <Pressable
          key={item.key}
          accessibilityRole="button"
          onPress={() => {
            hapticTap();
            item.onPress();
          }}
          style={({ pressed }) => [
            styles.row,
            index > 0 && styles.rowBorder,
            pressed && styles.rowPressed,
          ]}
        >
          <View style={styles.icon}>
            <Ionicons name={item.icon} size={20} color={colors.primary.dark} />
          </View>
          <View style={styles.text}>
            <AppText variant="body16SemiBold" color={colors.text.primary}>
              {item.title}
            </AppText>
            <AppText variant="body13" color={colors.text.tertiary}>
              {item.subtitle}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.disabled} />
        </Pressable>
      ))}
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  list: { gap: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.subtle,
  },
  rowPressed: { opacity: 0.75 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 1 },
});
