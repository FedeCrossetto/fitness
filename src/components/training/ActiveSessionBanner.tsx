import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { colors, radius, spacing, shadows } from '../../theme';
import { formatDuration } from '../../lib/dates';
import { hapticTap } from '../../lib/haptics';
import { AppText } from '../common';
import { useTrainingStore } from '../../stores/trainingStore';
import type { MainTabsParamList } from '../../types/navigation';

/** Banner persistente de "entrenamiento activo": visible mientras haya una sesión en curso. */
export function ActiveSessionBanner(): React.JSX.Element | null {
  const session = useTrainingStore((s) => s.activeSession);
  const navigation = useNavigation<NavigationProp<MainTabsParamList>>();
  const [now, setNow] = useState(() => Date.now());

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
        <Ionicons name="barbell" size={18} color={colors.primary.onText} />
      </View>
      <View style={styles.info}>
        <AppText variant="caps11" color={colors.primary.darkest}>
          Entrenamiento activo
        </AppText>
        <AppText variant="body14SemiBold" color={colors.primary.onText} numberOfLines={1}>
          {session.workoutTitle}
        </AppText>
      </View>
      <AppText variant="metricSmall" color={colors.primary.onText}>
        {formatDuration(elapsed)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.default,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.glow,
  },
  pressed: { opacity: 0.9 },
  pulse: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(12,12,12,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1 },
});
