import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/common';
import { authColors } from '../auth/authScreenTheme';
import { AuthButton } from '../auth/authUi';
import { useAppActive } from '../../hooks/useAppActive';
import { useAuthStore } from '../../stores/authStore';
import { useCheckoutStore } from '../../stores/checkoutStore';
import { clearSubscriptionAccessCache, resolveSubscriptionAccess, syncSubscription } from '../../services/payments';

// Backoff del polling: arranca rápido y se estira. ~68s en total antes de
// considerar el pago como "no confirmado" (pantalla de rechazo con reintento).
const POLL_INTERVALS = [1500, 2500, 4000, 5000, 7000, 9000, 11000, 13000, 15000];

const YELLOW = '#EFC63A';

/**
 * Pantalla de resultado del checkout de suscripción. La renderiza el
 * RootNavigator mientras `checkoutStore.phase !== 'idle'`, por encima del gate
 * normal. Consulta activamente a Mercado Pago (`mp-sync-subscription`) para
 * resolver aprobado/pending/rechazado — MP no redirige a páginas distintas en
 * suscripciones (Preapproval), así que el estado se resuelve del lado app.
 */
export function CheckoutResultScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const phase = useCheckoutStore((s) => s.phase);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const userId = useAuthStore((s) => s.session?.user.id);
  const pollingRef = useRef(false);

  const runPoll = useCallback(async () => {
    if (pollingRef.current) return;
    if (useCheckoutStore.getState().phase !== 'processing') return;
    pollingRef.current = true;

    const check = async (): Promise<boolean> => {
      const subId = useCheckoutStore.getState().subscriptionId ?? undefined;
      const r = await syncSubscription(subId);
      return r?.status === 'active' || r?.mp_status === 'authorized';
    };

    let ok = await check();
    for (const delay of POLL_INTERVALS) {
      if (ok) break;
      if (useCheckoutStore.getState().phase !== 'processing') { pollingRef.current = false; return; }
      await new Promise((r) => setTimeout(r, delay));
      ok = await check();
    }

    pollingRef.current = false;
    if (ok) {
      if (userId) {
        clearSubscriptionAccessCache();
        await resolveSubscriptionAccess(userId);
      }
      useCheckoutStore.getState().setPhase('approved');
    } else if (useCheckoutStore.getState().phase === 'processing') {
      // Timeout: MP no autorizó en la ventana → tratamos como no confirmado
      // (rechazo/abandono) y ofrecemos reintentar o seguir esperando.
      useCheckoutStore.getState().setPhase('rejected');
    }
  }, [userId]);

  // El disparador principal: al volver de Safari (background → active).
  useAppActive(() => { void runPoll(); });

  // Cubre el caso en que la pantalla (re)monta ya en foreground y en processing
  // (ej. "Seguir esperando", o un remonte tras volver). No pollea en el montaje
  // inicial que abre Safari porque ahí la app pasa a background.
  useEffect(() => {
    if (AppState.currentState === 'active' && useCheckoutStore.getState().phase === 'processing') {
      void runPoll();
    }
  }, [runPoll]);

  const [confirming, setConfirming] = useState(false);

  const onComencemos = useCallback(async () => {
    // OJO: reset() recién DESPUÉS de que refreshProfile() resuelva. Si se llama
    // antes, el RootNavigator re-renderiza con checkoutPhase='idle' pero el
    // profile todavía en 'pending' (referencia vieja) → cae un frame en
    // SubscriptionPlansScreen antes de que el profile actualizado lo saque de
    // ahí. Con este orden, CheckoutResultScreen (fase 'approved') se mantiene
    // montada durante el await — no hay pantalla intermedia que mostrar.
    setConfirming(true);
    clearSubscriptionAccessCache();
    await refreshProfile();
    useCheckoutStore.getState().reset();
  }, [refreshProfile]);

  const onRetry = useCallback(() => {
    const planId = useCheckoutStore.getState().planId;
    if (planId) void useCheckoutStore.getState().start(planId);
  }, []);

  const onKeepWaiting = useCallback(() => {
    useCheckoutStore.getState().setPhase('processing');
    void runPoll();
  }, [runPoll]);

  const onBackToPlans = useCallback(() => {
    useCheckoutStore.getState().reset();
  }, []);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={authColors.background} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        {phase === 'approved' ? (
          <ApprovedView onComencemos={onComencemos} confirming={confirming} />
        ) : phase === 'rejected' ? (
          <RejectedView onRetry={onRetry} onKeepWaiting={onKeepWaiting} onBackToPlans={onBackToPlans} />
        ) : (
          <ProcessingView />
        )}
      </ScrollView>
    </View>
  );
}

// ── Aprobado ─────────────────────────────────────────────────────────────────

function ApprovedView({
  onComencemos,
  confirming,
}: {
  onComencemos: () => void;
  confirming: boolean;
}): React.JSX.Element {
  return (
    <View style={styles.block}>
      <View style={[styles.iconCircle, { backgroundColor: 'rgba(193,237,0,0.12)' }]}>
        <Ionicons name="checkmark-circle" size={64} color={authColors.lima} />
      </View>
      <AppText variant="caps11" color={authColors.lima} style={styles.label}>
        ¡PAGO EXITOSO!
      </AppText>
      <AppText variant="h1" color={authColors.textPrimary} style={styles.title}>
        <AppText variant="h1" color={authColors.textPrimary}>¡BIENVENIDO A R</AppText>
        <AppText variant="h1" color={authColors.lima}>3</AppText>
        <AppText variant="h1" color={authColors.textPrimary}>SET!</AppText>
      </AppText>
      <AppText variant="body14" color={authColors.textSecondary} style={styles.subtitle}>
        Tu suscripción fue confirmada correctamente. Vamos a cargar tus datos para armar tu plan.
      </AppText>

      <View style={styles.stepsCard}>
        <AppText variant="caps11" color={authColors.lima} style={styles.stepsTitle}>
          ¿QUÉ SIGUE?
        </AppText>
        {['Completás tus datos', 'Tu coach arma tu plan', 'Empezás tu transformación'].map((s, i) => (
          <View key={s} style={styles.stepRow}>
            <View style={styles.stepNum}>
              <AppText variant="body12SemiBold" color={authColors.background}>{i + 1}</AppText>
            </View>
            <AppText variant="body13" color={authColors.textSecondary} style={styles.stepText}>{s}</AppText>
          </View>
        ))}
      </View>

      <AuthButton
        label="Comencemos"
        onPress={onComencemos}
        loading={confirming}
        disabled={confirming}
        variant="brand"
        fullWidth
        style={styles.cta}
      />
    </View>
  );
}

// ── Pending / procesando ──────────────────────────────────────────────────────

function ProcessingView(): React.JSX.Element {
  return (
    <View style={[styles.block, styles.processingBlock]}>
      <View style={[styles.iconCircle, { backgroundColor: 'rgba(239,198,58,0.12)' }]}>
        <ActivityIndicator size="large" color={YELLOW} />
      </View>
      <AppText variant="caps11" color={YELLOW} style={styles.label}>
        ⏳ PAGO EN PROCESO
      </AppText>
      <AppText variant="h1" color={authColors.textPrimary} style={styles.title}>
        ESTAMOS PROCESANDO TU PAGO
      </AppText>
      <AppText variant="body14" color={authColors.textSecondary} style={styles.subtitle}>
        Esto puede tardar unos segundos. No cierres la app — te llevamos a la
        siguiente pantalla apenas se confirme.
      </AppText>
    </View>
  );
}

// ── Rechazado / no confirmado ─────────────────────────────────────────────────

function RejectedView({
  onRetry,
  onKeepWaiting,
  onBackToPlans,
}: {
  onRetry: () => void;
  onKeepWaiting: () => void;
  onBackToPlans: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.block}>
      <View style={[styles.iconCircle, { backgroundColor: authColors.errorBg }]}>
        <Ionicons name="close-circle" size={64} color={authColors.errorText} />
      </View>
      <AppText variant="caps11" color={authColors.errorText} style={styles.label}>
        CASI LO LOGRAMOS
      </AppText>
      <AppText variant="h1" color={authColors.textPrimary} style={styles.title}>
        NO PUDIMOS CONFIRMAR TU PAGO
      </AppText>
      <AppText variant="body14" color={authColors.textSecondary} style={styles.subtitle}>
        No te preocupes: si no se realizó ningún cobro, podés intentarlo de nuevo.
        Si ya pagaste, puede estar demorando — seguí esperando unos segundos.
      </AppText>

      <AuthButton label="Reintentar pago" onPress={onRetry} variant="brand" fullWidth style={styles.cta} />
      <Pressable onPress={onKeepWaiting} style={styles.secondaryBtn}>
        <AppText variant="body14SemiBold" color={authColors.textPrimary}>Seguir esperando</AppText>
      </Pressable>
      <Pressable onPress={onBackToPlans} style={styles.tertiaryBtn}>
        <AppText variant="body13" color={authColors.textTertiary}>Volver a los planes</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: authColors.background },
  content: { flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center' },
  block: { alignItems: 'center', gap: 12 },
  processingBlock: { paddingVertical: 40 },
  iconCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  label: { letterSpacing: 2 },
  title: { textAlign: 'center', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, lineHeight: 32 },
  subtitle: { textAlign: 'center', lineHeight: 20, maxWidth: 320, marginTop: 2 },

  stepsCard: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: 'rgba(193,237,0,0.25)',
    borderRadius: 12,
    padding: 18,
    backgroundColor: '#0e0e0e',
    gap: 12,
    marginTop: 12,
  },
  stepsTitle: { letterSpacing: 2 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: authColors.lima,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1 },

  cta: { alignSelf: 'stretch', marginTop: 20 },
  secondaryBtn: { paddingVertical: 14, alignItems: 'center', alignSelf: 'stretch' },
  tertiaryBtn: { paddingVertical: 8, alignItems: 'center' },
});
