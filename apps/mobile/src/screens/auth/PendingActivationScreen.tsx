import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radius, Colors, useThemedStyles, useTheme } from '../../theme';
import { AppText, Button, CardSkeleton, FlowBackdrop, FlowHeroIcon, flowShadowStyle } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { clearSubscriptionAccessCache, fetchPlans } from '../../services/payments';
import { useCheckout } from '../../hooks/useCheckout';
import { useAppActive } from '../../hooks/useAppActive';
import type { PlanRow } from '../../types/database';

function monthsOf(plan: PlanRow): number {
  return Math.max(1, Math.round(plan.duration_days / 30));
}

/**
 * Bloqueo cuando el alumno está vinculado pero todavía no está activo
 * (client_status = 'pending'). Para desbloquearse puede:
 *   • Pagar online acá mismo (MercadoPago) → el webhook lo activa solo.
 *   • Pagar en efectivo a su entrenador → el entrenador lo registra en la web.
 */
export function PendingActivationScreen(): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Al activarse el pago, refrescamos el perfil → si quedó 'active', la app
  // cambia sola de pantalla (RootNavigator deja de mostrar este bloqueo).
  const { checkingOut, startCheckout } = useCheckout(userId, () => {
    void refreshProfile();
  });

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      try {
        const list = await fetchPlans(userId);
        setPlans(list);
        setSelectedId(list.find((p) => p.id === 'quarterly')?.id ?? list[0]?.id ?? null);
      } catch {
        // Sin planes mostramos solo el camino de efectivo / esperar.
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, [userId]);

  useAppActive(() => {
    clearSubscriptionAccessCache();
    void refreshProfile();
  });

  const onCheck = useCallback(async () => {
    setChecking(true);
    clearSubscriptionAccessCache();
    await refreshProfile();
    setChecking(false);
    if (useAuthStore.getState().profile?.client_status === 'pending') {
      useUiStore.getState().showToast('info', 'Todavía no figura tu pago. Si pagaste en efectivo, avisale a tu entrenador.');
    }
  }, [refreshProfile]);

  const onPayOnline = useCallback(() => {
    if (!selectedId) return;
    void startCheckout(selectedId);
  }, [selectedId, startCheckout]);

  const firstName = profile?.full_name?.split(' ')[0];

  return (
    <FlowBackdrop style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <FlowHeroIcon icon={<Ionicons name="sparkles" size={28} color={colors.primary.onText} />} />

        <AppText variant="h1" color={colors.text.primary} style={styles.title}>
          {firstName ? `Activá tu cuenta, ${firstName}` : 'Activá tu cuenta'}
        </AppText>
        <AppText variant="body14" color={colors.text.secondary} style={styles.subtitle}>
          Elegí un plan y suscribite para empezar a entrenar. Si arreglaste pagar en
          efectivo, tu entrenador te activa al registrar el pago.
        </AppText>

        {loadingPlans ? (
          <View style={styles.plansBlock}>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : plans.length > 0 ? (
          <View style={styles.plansBlock}>
            {plans.map((plan) => {
              const months = monthsOf(plan);
              const selected = selectedId === plan.id;
              return (
                <Pressable
                  key={plan.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedId(plan.id)}
                  style={[
                    styles.planCard,
                    flowShadowStyle(isDark),
                    selected && styles.planSelected,
                  ]}
                >
                <View style={styles.planInfo}>
                  <AppText variant="body16SemiBold" color={colors.text.primary}>
                    {plan.name}
                  </AppText>
                  <AppText variant="metricMedium" color={colors.text.primary} style={styles.planPrice}>
                    $ {plan.price_ars.toLocaleString('es-AR')}
                  </AppText>
                  {months > 1 ? (
                    <AppText variant="body13Medium" color={colors.primary.default}>
                      $ {Math.round(plan.price_ars / months).toLocaleString('es-AR')} / mes
                    </AppText>
                  ) : null}
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <Ionicons name="checkmark" size={14} color={colors.text.inverse} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.footer}>
        {plans.length > 0 ? (
          <Button
            label="Pagar online"
            onPress={onPayOnline}
            loading={checkingOut}
            disabled={!selectedId}
            fullWidth
          />
        ) : null}

        <View style={styles.cashRow}>
          <Ionicons name="cash-outline" size={16} color={colors.text.tertiary} />
          <AppText variant="body13" color={colors.text.tertiary} style={styles.cashText}>
            ¿Pagás en efectivo? Avisale a tu entrenador. Cuando registre tu pago,
            tocá "Ya pagué" para actualizar.
          </AppText>
        </View>

        <Button
          label="Ya pagué, actualizar"
          variant="secondary"
          onPress={() => void onCheck()}
          loading={checking}
          fullWidth
          style={styles.secondary}
        />
        <Pressable onPress={() => void signOut()} style={styles.signOut}>
          <AppText variant="body13" color={colors.text.tertiary}>
            Cerrar sesión
          </AppText>
        </Pressable>
      </View>
    </ScrollView>
    </FlowBackdrop>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.xl, flexGrow: 1 },
  title: { marginBottom: spacing.sm },
  subtitle: { lineHeight: 21, marginBottom: spacing.xl },
  plansBlock: { gap: spacing.sm, marginBottom: spacing.lg },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    padding: spacing.lg,
  },
  planSelected: { borderColor: colors.primary.default, backgroundColor: colors.primary.muted },
  planInfo: { gap: 2 },
  planPrice: { marginTop: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { backgroundColor: colors.primary.default, borderColor: colors.primary.default },
  footer: { paddingTop: spacing.md, marginTop: 'auto' },
  cashRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.surface.elevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cashText: { flexShrink: 1, lineHeight: 19 },
  secondary: { marginTop: spacing.md },
  signOut: { alignSelf: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
});
