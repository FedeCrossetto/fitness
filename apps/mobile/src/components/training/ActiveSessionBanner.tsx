import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { Colors, radius, spacing, useTheme, useThemedStyles } from '../../theme';
import { formatDuration } from '../../lib/dates';
import { hapticTap } from '../../lib/haptics';
import { AppText } from '../common';
import { useTranslation } from '../../stores/i18nStore';
import { useTrainingStore } from '../../stores/trainingStore';
import type { MainTabsParamList } from '../../types/navigation';

/** Banner persistente de "entrenamiento activo": visible mientras haya una sesión en curso. */
export function ActiveSessionBanner(): React.JSX.Element | null {
  const session = useTrainingStore((s) => s.activeSession);
  const navigation = useNavigation<NavigationProp<MainTabsParamList>>();
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [session]);

  if (!session) return null;

  const elapsed = Math.floor((now - session.startedAt) / 1000);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Entrenamiento activo: ${session.workoutTitle}`}
      onPress={() => {
        hapticTap();
        navigation.navigate('TrainingTab', {
          screen: 'LiveSession',
          params: { workoutId: session.workoutId, workoutTitle: session.workoutTitle },
        });
      }}
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
    >
      <View style={styles.pulse}>
        <Ionicons name="barbell" size={16} color={colors.text.primary} />
      </View>
      <View style={styles.info}>
        <AppText variant="caps11" color={colors.text.tertiary}>
          {t.training.active_session}
        </AppText>
        <AppText variant="body14SemiBold" color={colors.text.primary} numberOfLines={1}>
          {session.workoutTitle}
        </AppText>
      </View>
      <AppText variant="body13Medium" color={colors.text.secondary}>
        {formatDuration(elapsed)}
      </AppText>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface.base,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border.default,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    pressed: { opacity: 0.88 },
    pulse: {
      width: 34,
      height: 34,
      borderRadius: radius.pill,
      backgroundColor: colors.surface.elevated,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border.subtle,
    },
    info: { flex: 1 },
  });
