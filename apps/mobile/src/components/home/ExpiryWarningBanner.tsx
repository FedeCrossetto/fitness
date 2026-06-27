import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { spacing, radius, Colors, useThemedStyles, useTheme } from '../../theme';
import { AppText } from '../common';
import { useAuthStore } from '../../stores/authStore';
import { fetchActiveSubscriptionWithPlan } from '../../services/payments';
import { isStaffProfile } from '../../services/clientAccess';

const WARN_DAYS = 7;

function daysUntil(isoDate: string): number {
  const diff = new Date(isoDate).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface Props {
  onPress: () => void;
}

export function ExpiryWarningBanner({ onPress }: Props): React.JSX.Element | null {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const userId = session?.user.id;

  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId || isStaffProfile(profile)) return;
      let cancelled = false;
      void (async () => {
        try {
          const sub = await fetchActiveSubscriptionWithPlan(userId);
          if (!cancelled && sub?.expires_at) {
            const d = daysUntil(sub.expires_at);
            setDaysLeft(d > 0 && d <= WARN_DAYS ? d : null);
          } else if (!cancelled) {
            setDaysLeft(null);
          }
        } catch {
          if (!cancelled) setDaysLeft(null);
        }
      })();
      return () => { cancelled = true; };
    }, [userId, profile]),
  );

  if (daysLeft === null) return null;

  const label =
    daysLeft === 1
      ? 'Tu plan vence mañana'
      : `Tu plan vence en ${daysLeft} días`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Tocá para renovar.`}
      style={styles.wrap}
    >
      <View style={styles.row}>
        <Ionicons name="time-outline" size={16} color={colors.states.warning} />
        <AppText variant="body13Medium" color={colors.states.warning} style={styles.text}>
          {label}
        </AppText>
        <Ionicons name="chevron-forward" size={14} color={colors.states.warning} />
      </View>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: {
      marginBottom: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.states.warning,
      backgroundColor: (colors.states.warning) + '18',
      padding: spacing.md,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    text: { flex: 1 },
  });
