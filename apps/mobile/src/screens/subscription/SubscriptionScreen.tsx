import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../types/navigation';
import { layout, radius, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { formatLongDate } from '../../lib/dates';
import { createCheckout, fetchActiveSubscription, fetchPlans, hasActiveAccess } from '../../services/payments';
import {
  AppText,
  Button,
  Card,
  CardSkeleton,
  Chip,
  ErrorState,
  IconButton,
} from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import type { PlanRow, SubscriptionRow } from '../../types/database';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';

type Props = NativeStackScreenProps<HomeStackParamList, 'Subscription'>;

function monthsOf(plan: PlanRow): number {
  return Math.max(1, Math.round(plan.duration_days / 30));
}

export function SubscriptionScreen({ navigation }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [refreshingSub, setRefreshingSub] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [planList, sub] = await Promise.all([fetchPlans(userId), fetchActiveSubscription(userId)]);
      setPlans(planList);
      setSubscription(sub);
      setSelectedId((prev) => prev ?? planList.find((p) => p.id === 'quarterly')?.id ?? planList[0]?.id ?? null);
      setError(null);
    } catch {
      setError('No pudimos cargar los planes.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setLoading(true);
      void load();
    }, [userId, load]),
  );

  const refreshSubscription = useCallback(async () => {
    if (!userId) return;
    setRefreshingSub(true);
    try {
      setSubscription(await fetchActiveSubscription(userId));
    } catch {
      useUiStore.getState().showToast('error', 'No pudimos actualizar el estado del pago.');
    } finally {
      setRefreshingSub(false);
    }
  }, [userId]);

  const onSubscribe = useCallback(async () => {
    if (!selectedId || !userId || checkingOut) return;
    setCheckingOut(true);
    try {
      const { checkoutUrl } = await createCheckout(selectedId);
      await WebBrowser.openBrowserAsync(checkoutUrl);
      // Al volver del checkout, re-chequeamos el estado de la suscripción
      setSubscription(await fetchActiveSubscription(userId));
    } catch (err) {
      useUiStore
        .getState()
        .showToast('error', err instanceof Error ? err.message : 'No pudimos iniciar el pago. Intentá de nuevo.');
    } finally {
      setCheckingOut(false);
    }
  }, [selectedId, userId, checkingOut]);

  const active = hasActiveAccess(subscription);
  const pending = subscription?.status === 'pending';

  let content: React.JSX.Element;
  if (loading) {
    content = (
      <View>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </View>
    );
  } else if (error) {
    content = (
      <ErrorState
        message={error}
        onRetry={() => {
          setLoading(true);
          setError(null);
          void load();
        }}
      />
    );
  } else {
    content = (
      <View>
        {active && subscription ? (
          <Card elevated style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.statusInfo}>
                <AppText variant="body16SemiBold" color={colors.text.primary}>
                  {plans.find((p) => p.id === subscription.plan_id)?.name ?? 'Tu plan'}
                </AppText>
                <AppText variant="body13" color={colors.text.secondary} style={styles.statusSub}>
                  {subscription.expires_at
                    ? `Vence el ${formatLongDate(subscription.expires_at.slice(0, 10))}`
                    : 'Sin fecha de vencimiento'}
                </AppText>
              </View>
              <Chip label="Activa" active />
            </View>
          </Card>
        ) : null}

        {pending ? (
          <Card style={styles.pendingCard}>
            <View style={styles.pendingRow}>
              <Ionicons name="time-outline" size={20} color={colors.states.warning} />
              <AppText variant="body14Medium" color={colors.text.primary} style={styles.pendingText}>
                Estamos confirmando tu pago…
              </AppText>
            </View>
            <AppText variant="body13" color={colors.text.secondary} style={styles.pendingSub}>
              Puede demorar unos minutos. Cuando se acredite vas a ver tu plan activo acá.
            </AppText>
            <Button
              label="Refrescar"
              variant="secondary"
              size="md"
              loading={refreshingSub}
              onPress={() => void refreshSubscription()}
              style={styles.pendingButton}
            />
          </Card>
        ) : null}

        <AppText variant="caps13" color={colors.text.tertiary} style={styles.plansTitle}>
          Planes disponibles
        </AppText>

        {plans.map((plan) => {
          const months = monthsOf(plan);
          const selected = selectedId === plan.id;
          return (
            <Pressable
              key={plan.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={plan.name}
              onPress={() => setSelectedId(plan.id)}
              style={({ pressed }) => [styles.planCard, selected && styles.planSelected, pressed && styles.planPressed]}
            >
              {plan.id === 'quarterly' ? (
                <View style={styles.badge}>
                  <AppText variant="caps11" color={colors.primary.onText}>
                    Más elegido
                  </AppText>
                </View>
              ) : null}
              <View style={styles.planRow}>
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
                  {plan.description ? (
                    <AppText variant="body13" color={colors.text.secondary} style={styles.planDescription}>
                      {plan.description}
                    </AppText>
                  ) : null}
                </View>
                <View style={[styles.radio, selected && styles.radioSelected]}>
                  {selected ? <Ionicons name="checkmark" size={14} color={colors.text.inverse} /> : null}
                </View>
              </View>
            </Pressable>
          );
        })}

        <Button
          label="Suscribirme"
          onPress={() => void onSubscribe()}
          loading={checkingOut}
          disabled={!selectedId}
          fullWidth
          style={styles.cta}
        />

        <AppText variant="body12" color={colors.text.disabled} align="center" style={styles.legal}>
          Pagos procesados por Mercado Pago. Podés cancelar cuando quieras.
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Volver" />
        <AppText variant="h3" color={colors.text.primary} style={styles.headerTitle}>
          Mi plan
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: scrollBottom }]}>
        {content}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: layout.minHitTarget },
  content: {
    paddingHorizontal: layout.screenPadding,
  },
  statusCard: { marginBottom: spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statusInfo: { flex: 1 },
  statusSub: { marginTop: spacing.xxs },
  pendingCard: { marginBottom: spacing.md, borderColor: colors.border.default },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pendingText: { flex: 1 },
  pendingSub: { marginTop: spacing.xs },
  pendingButton: { marginTop: spacing.md, alignSelf: 'flex-start' },
  plansTitle: { marginBottom: spacing.sm },
  planCard: {
    backgroundColor: colors.surface.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  planSelected: {
    borderColor: colors.primary.default,
    backgroundColor: colors.surface.elevated,
  },
  planPressed: { opacity: 0.85 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary.default,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    marginBottom: spacing.xs,
  },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  planInfo: { flex: 1 },
  planPrice: { marginTop: spacing.xxs },
  planDescription: { marginTop: spacing.xs },
  radio: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    backgroundColor: colors.primary.default,
    borderColor: colors.primary.default,
  },
  cta: { marginTop: spacing.md },
  legal: { marginTop: spacing.md },
});
