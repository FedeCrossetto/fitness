import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { spacing, radius, Colors, useThemedStyles, useTheme } from '../../theme';
import { AppText } from '../common';
import { useAuthStore } from '../../stores/authStore';
import { getCachedSubscriptionAccess, resolveSubscriptionAccess } from '../../services/payments';
import { isStaffProfile } from '../../services/clientAccess';

/**
 * Banner en Home que invita a suscribirse cuando el cliente NO tiene un plan
 * activo (cortesía sin pago, o suscripción vencida). Si tiene acceso activo, o
 * es staff, no renderiza nada.
 */
export function SubscriptionBanner({ onPress }: { onPress: () => void }): React.JSX.Element | null {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const userId = session?.user.id;

  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId || isStaffProfile(profile)) {
        setHasAccess(true);
        return;
      }
      const cached = getCachedSubscriptionAccess(userId);
      if (cached !== null) {
        setHasAccess(cached);
        return;
      }
      let cancelled = false;
      void (async () => {
        try {
          const { hasAccess: access } = await resolveSubscriptionAccess(userId);
          if (!cancelled) setHasAccess(access);
        } catch {
          if (!cancelled) setHasAccess(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [userId, profile]),
  );

  if (hasAccess !== false) return null;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.wrap}>
      <LinearGradient
        colors={[colors.primary.default, colors.primary.dark ?? colors.primary.default]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" size={20} color={colors.primary.onText} />
        </View>
        <View style={styles.copy}>
          <AppText variant="body16SemiBold" color={colors.primary.onText}>
            Activá tu plan
          </AppText>
          <AppText variant="body13" color={colors.primary.onText} style={styles.sub}>
            Suscribite para acceder a todo tu entrenamiento y nutrición.
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.primary.onText} />
      </LinearGradient>
    </Pressable>
  );
}

const createStyles = (_colors: Colors) => StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 2 },
  sub: { opacity: 0.9, lineHeight: 18 },
});
