import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radius, Colors, useThemedStyles, useTheme } from '../../theme';
import { AppText, Button } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';

/**
 * Bloqueo cuando el alumno está vinculado pero el entrenador todavía no lo activó
 * (client_status = 'pending'). Mientras tanto no puede usar la app.
 */
export function PendingActivationScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const profile = useAuthStore((s) => s.profile);
  const [checking, setChecking] = useState(false);

  const onCheck = async () => {
    setChecking(true);
    await refreshProfile();
    setChecking(false);
    // Si sigue pendiente, avisamos; si ya lo activaron, la app cambia sola de pantalla.
    if (useAuthStore.getState().profile?.client_status === 'pending') {
      useUiStore.getState().showToast('info', 'Tu entrenador todavía no te activó. Probá más tarde.');
    }
  };

  const firstName = profile?.full_name?.split(' ')[0];

  return (
    <View style={[styles.flex, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="hourglass-outline" size={30} color={colors.primary.default} />
        </View>

        <AppText variant="h1" color={colors.text.primary} style={styles.title}>
          {firstName ? `Casi listo, ${firstName}` : 'Casi listo'}
        </AppText>
        <AppText variant="body14" color={colors.text.secondary} style={styles.subtitle}>
          Tu cuenta está vinculada a tu entrenador y quedó pendiente de activación.
          En cuanto te active vas a poder usar todas las funciones de la app.
        </AppText>

        <View style={styles.hintRow}>
          <Ionicons name="information-circle-outline" size={16} color={colors.text.tertiary} />
          <AppText variant="body13" color={colors.text.tertiary} style={styles.hintText}>
            Avisale a tu entrenador que ya te registraste para que te active.
          </AppText>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label="Ya me activaron, actualizar"
          onPress={() => void onCheck()}
          loading={checking}
          fullWidth
        />
        <Button
          label="Cerrar sesión"
          variant="secondary"
          onPress={() => void signOut()}
          fullWidth
          style={styles.secondary}
        />
      </View>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl, justifyContent: 'space-between' },
  content: { flex: 1, justifyContent: 'center' },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { marginBottom: spacing.sm },
  subtitle: { lineHeight: 21, marginBottom: spacing.lg },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  hintText: { flexShrink: 1, lineHeight: 19 },
  footer: { paddingTop: spacing.md },
  secondary: { marginTop: spacing.sm },
});
