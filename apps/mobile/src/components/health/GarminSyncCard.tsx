import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, Card } from '../common';
import { spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { showGarminSetupGuide } from '../../services/wearables';
import { useTranslation } from '../../stores/i18nStore';

export function GarminSyncCard(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => showGarminSetupGuide({ ...t.profile, ok: t.profile.ok })}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons name="watch-outline" size={18} color={colors.primary.default} />
          </View>
          <View style={styles.body}>
            <AppText variant="body16Medium" color={colors.text.primary}>
              {t.profile.garmin_title}
            </AppText>
            <AppText variant="body12" color={colors.text.tertiary} style={styles.sub}>
              {t.profile.garmin_sub}
            </AppText>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
        </View>
      </Card>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    card: { marginTop: spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.surface.elevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1 },
    sub: { marginTop: 2 },
    pressed: { opacity: 0.85 },
  });
