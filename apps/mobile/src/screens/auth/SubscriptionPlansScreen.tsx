import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { clearSubscriptionAccessCache, fetchPlans } from '../../services/payments';
import { useCheckout } from '../../hooks/useCheckout';
import { useAppActive } from '../../hooks/useAppActive';
import { authColors } from './authScreenTheme';
import type { PlanRow } from '../../types/database';
import { EvaluationFormScreen } from '../evaluation/EvaluationFormScreen';
import { EvaluationScheduleScreen } from '../evaluation/EvaluationScheduleScreen';
import { EvaluationThankYouScreen } from '../evaluation/EvaluationThankYouScreen';
import { MentoriaView, ORANGE, BASE_COMPLEMENTS } from './MentoriaView';

const H_PAD = 20;

function monthsOf(plan: PlanRow): number {
  return Math.max(1, Math.round(plan.duration_days / 30));
}

const BASE_FEATURES = [
  'Rutina personalizada (gimnasio - hogar)',
  'App exclusiva Android e iPhone',
  'Videos explicativos de cada ejercicio',
  'Seguimiento semanal',
  'Soporte en plataforma',
  'Comunidad privada de alumnos',
  'Sin permanencia — cancelá cuando quieras',
];

// ── Plan Base View ─────────────────────────────────────────────────────────────

function PlanBaseView({
  plans,
  loadingPlans,
  checkingOut,
  onSelectPlan,
  onSwitchToMentoria,
}: {
  plans: PlanRow[];
  loadingPlans: boolean;
  checkingOut: boolean;
  onSelectPlan: (id: string) => void;
  onSwitchToMentoria: () => void;
}): React.JSX.Element {
  const sorted = [...plans].sort((a, b) => monthsOf(a) - monthsOf(b));
  const [selectedIdx, setSelectedIdx] = useState(0);

  const selected = sorted[selectedIdx] ?? null;
  const selectedMonths = selected ? monthsOf(selected) : 1;
  const pricePerMonth = selected
    ? Math.round(selected.price_ars / selectedMonths)
    : null;

  return (
    <View style={styles.tabContent}>
      {/* Plan card */}
      <View style={styles.planCard}>
        <AppText variant="caps11" color={authColors.lima} style={styles.planCategory}>
          ACCESO INMEDIATO
        </AppText>
        <AppText variant="h1" color={authColors.textPrimary} style={styles.planTitle}>
          PLAN BASE
        </AppText>

        {/* Price */}
        <View style={styles.priceRow}>
          <AppText variant="body13" color={authColors.textSecondary}>Desde ARS </AppText>
          {loadingPlans ? (
            <ActivityIndicator color={authColors.lima} size="small" />
          ) : (
            <AppText variant="metricMedium" color={authColors.textPrimary} style={styles.priceNum}>
              ${(pricePerMonth ?? 0).toLocaleString('es-AR')}
            </AppText>
          )}
          <AppText variant="body13" color={authColors.textSecondary}>/mes</AppText>
        </View>

        {/* Duration selector */}
        {!loadingPlans && sorted.length > 0 && (
          <View style={styles.durationRow}>
            {sorted.map((plan, idx) => {
              const m = monthsOf(plan);
              const label = `${m} ${m === 1 ? 'Mes' : 'Meses'}`;
              const active = idx === selectedIdx;
              return (
                <TouchableOpacity
                  key={plan.id}
                  style={[styles.durationBtn, active && styles.durationBtnActive]}
                  onPress={() => setSelectedIdx(idx)}
                  activeOpacity={0.7}
                >
                  <AppText
                    variant="caps11"
                    color={active ? authColors.textPrimary : authColors.textTertiary}
                    style={styles.durationLabel}
                  >
                    {label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <AppText variant="body13" color={authColors.textSecondary} style={styles.planDescription}>
          {selectedMonths > 1
            ? `Ahorrás pagando ${selectedMonths} meses. La forma más simple de empezar tu transformación.`
            : 'Ahorrá en los planes de 3 y 6 meses. La forma más simple de empezar tu transformación.'}
        </AppText>

        {/* Features */}
        <AppText variant="caps11" color={authColors.lima} style={styles.sectionLabel}>
          EL PLAN BASE INCLUYE:
        </AppText>
        {BASE_FEATURES.map((f) => (
          <View key={f} style={styles.featureRow}>
            <Ionicons name="checkmark" size={16} color={authColors.lima} />
            <AppText variant="body13" color={authColors.textSecondary} style={styles.featureText}>
              {f}
            </AppText>
          </View>
        ))}

        {/* Complements */}
        <View style={styles.complementsBlock}>
          <AppText variant="caps11" color={authColors.lima} style={styles.sectionLabel}>
            COMPLEMENTÁ TU PROCESO CON:
          </AppText>
          {BASE_COMPLEMENTS.map((c) => (
            <View key={c} style={styles.featureRow}>
              <Ionicons name="checkmark" size={14} color={authColors.lima} />
              <AppText variant="body12" color={authColors.textTertiary} style={styles.featureText}>
                {c}
              </AppText>
            </View>
          ))}
        </View>

        {/* Banner */}
        <View style={styles.motiveBanner}>
          <AppText variant="caps11" color={authColors.lima} style={styles.motiveBannerText}>
            EL PRIMER PASO ES EL MÁS IMPORTANTE.
          </AppText>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: authColors.lima }]}
          onPress={() => selected && onSelectPlan(selected.id)}
          disabled={checkingOut || !selected}
          activeOpacity={0.85}
        >
          {checkingOut ? (
            <ActivityIndicator color={authColors.background} />
          ) : (
            <AppText variant="caps11" color={authColors.background} style={styles.ctaText}>
              EMPEZAR HOY
            </AppText>
          )}
        </TouchableOpacity>
      </View>

      {/* Upsell mentoria */}
      <TouchableOpacity
        style={styles.upsellCard}
        onPress={onSwitchToMentoria}
        activeOpacity={0.85}
      >
        <View style={styles.upsellHeader}>
          <Ionicons name="ribbon" size={18} color={ORANGE} />
          <AppText variant="caps11" color={ORANGE} style={styles.upsellCategory}>
            OPCIÓN PREMIUM
          </AppText>
        </View>
        <AppText variant="body16SemiBold" color={authColors.textPrimary} style={styles.upsellTitle}>
          ¿Buscás resultados 100% personalizados?
        </AppText>
        <AppText variant="body13" color={authColors.textSecondary} style={styles.upsellSubtitle}>
          Si necesitás un acompañamiento diario y una estrategia diseñada exclusivamente para vos, la Mentoría 1 a 1 es tu mejor opción.
        </AppText>
        <View style={[styles.upsellBtn]}>
          <AppText variant="caps11" color={ORANGE} style={styles.upsellBtnText}>
            VER MENTORÍA 1 A 1
          </AppText>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

type Tab = 'base' | 'mentoria';
/** Solicitar evaluación (Mentoría 1 a 1): formulario → agendar por Calendly → gracias.
 * Se maneja como estado local (no hay stack navigator acá, RootNavigator renderiza
 * esta pantalla directamente) — mismo patrón que los demás gates de la app. */
type EvalFlowStep = 'form' | 'schedule' | 'thanks' | null;

export function SubscriptionPlansScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [, setCheckoutId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('base');
  const [evalFlowStep, setEvalFlowStep] = useState<EvalFlowStep>(null);

  const { checkingOut, startCheckout } = useCheckout(userId, () => {
    void refreshProfile();
  });

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      try {
        const list = await fetchPlans(userId);
        setPlans(list);
      } catch (err) {
        // No bloqueamos la pantalla (el usuario puede seguir con Mentoría),
        // pero antes esto quedaba en silencio y el Plan Base se veía roto
        // ($0/mes, sin selector de duración) sin ninguna pista de qué pasó.
        if (__DEV__) console.warn('[plans] fetchPlans failed:', err);
        useUiStore.getState().showToast('error', 'No pudimos cargar los planes. Probá de nuevo más tarde.');
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, [userId]);

  useAppActive(() => {
    clearSubscriptionAccessCache();
    void refreshProfile();
  });

  const onSelectPlan = useCallback((id: string) => {
    setCheckoutId(id);
    void startCheckout(id);
  }, [startCheckout]);

  if (evalFlowStep === 'form') {
    return (
      <EvaluationFormScreen
        onBack={() => setEvalFlowStep(null)}
        onSubmitted={() => setEvalFlowStep('schedule')}
      />
    );
  }
  if (evalFlowStep === 'schedule') {
    return (
      <EvaluationScheduleScreen
        onBack={() => setEvalFlowStep('form')}
        onDone={() => setEvalFlowStep('thanks')}
      />
    );
  }
  if (evalFlowStep === 'thanks') {
    return (
      <EvaluationThankYouScreen
        primaryAction={{
          label: 'Continuar a la app',
          onPress: () => useAuthStore.getState().bumpEvaluationGate(),
        }}
      />
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={authColors.background} />

      {/* Header */}
      <View style={styles.header}>
        <AppText variant="h2" style={styles.titleLine} numberOfLines={1} adjustsFontSizeToFit>
          <AppText variant="h2" color={authColors.textPrimary}>ELEGÍ TU </AppText>
          <AppText variant="h2" color={authColors.lima}>PLAN</AppText>
        </AppText>
        <AppText variant="body16SemiBold" color={authColors.lima} style={styles.brandLabel}>
          R3SET
        </AppText>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <AppText variant="caps11" color={authColors.lima} style={styles.heroLabel}>
            MÉTODO R3SET
          </AppText>
          <AppText variant="h1" color={authColors.textPrimary} style={styles.heroTitle}>
            {'TRANSFORMACIÓN\nSIN LÍMITES'}
          </AppText>
          <View style={styles.heroLine} />
        </View>

        {/* Tab Toggle */}
        <View style={styles.toggleContainer}>
          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, activeTab === 'base' && styles.toggleBtnActiveBase]}
              onPress={() => setActiveTab('base')}
              activeOpacity={0.85}
            >
              <AppText
                variant="caps11"
                color={activeTab === 'base' ? authColors.background : authColors.textTertiary}
                style={styles.toggleBtnText}
              >
                PLAN BASE
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, activeTab === 'mentoria' && styles.toggleBtnActiveMentoria]}
              onPress={() => setActiveTab('mentoria')}
              activeOpacity={0.85}
            >
              <AppText
                variant="caps11"
                color={activeTab === 'mentoria' ? authColors.background : authColors.textTertiary}
                style={styles.toggleBtnText}
              >
                MENTORÍA 1 A 1
              </AppText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab content */}
        {activeTab === 'base' ? (
          <PlanBaseView
            plans={plans}
            loadingPlans={loadingPlans}
            checkingOut={checkingOut}
            onSelectPlan={onSelectPlan}
            onSwitchToMentoria={() => setActiveTab('mentoria')}
          />
        ) : (
          <MentoriaView onRequestEvaluation={() => setEvalFlowStep('form')} />
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <AppText variant="body12" color={authColors.textTertiary} style={styles.terms}>
            Al seleccionar un plan aceptás nuestros términos de servicio y políticas de privacidad. Todos los planes incluyen actualizaciones constantes del Método R3SET.
          </AppText>
          <Pressable onPress={() => void signOut()} style={styles.signOutBtn}>
            <AppText variant="body12" color={authColors.textTertiary}>
              Cerrar sesión
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: authColors.background },
  scroll: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: authColors.border,
  },
  titleLine: { letterSpacing: -0.5 },
  brandLabel: { marginLeft: 'auto', letterSpacing: -0.5 },

  hero: { paddingHorizontal: H_PAD, paddingTop: 28, paddingBottom: 24 },
  heroLabel: { letterSpacing: 2, marginBottom: 10 },
  heroTitle: {
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 40,
    letterSpacing: -1.5,
    marginBottom: 14,
  },
  heroLine: { width: 52, height: 3, backgroundColor: authColors.lima },

  toggleContainer: { paddingHorizontal: H_PAD, marginBottom: 24 },
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 100,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleBtnActiveBase: { backgroundColor: authColors.lima },
  toggleBtnActiveMentoria: { backgroundColor: ORANGE },
  toggleBtnText: { letterSpacing: 1, fontWeight: '700' },

  tabContent: { paddingHorizontal: H_PAD, gap: 16 },

  // Plan Base
  planCard: {
    borderWidth: 1,
    borderColor: 'rgba(193,237,0,0.3)',
    borderRadius: 12,
    padding: 24,
    backgroundColor: '#0e0e0e',
    gap: 14,
  },
  planCategory: { letterSpacing: 2 },
  planTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },

  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' },
  priceNum: { fontSize: 38, fontWeight: '800', lineHeight: 42 },

  durationRow: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  durationBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  durationBtnActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  durationLabel: { letterSpacing: 0.5 },

  planDescription: { lineHeight: 19, marginTop: -4 },

  sectionLabel: { letterSpacing: 2, marginTop: 6 },

  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  featureText: { flex: 1, lineHeight: 20 },
  featureBold: { fontWeight: '700', color: '#FFFFFF' },

  complementsBlock: { gap: 10, paddingTop: 4 },

  motiveBanner: {
    backgroundColor: 'rgba(193,237,0,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(193,237,0,0.2)',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  motiveBannerText: { letterSpacing: 1.5 },

  ctaBtn: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  ctaText: { letterSpacing: 2.5, fontWeight: '800' },

  // Upsell card
  upsellCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,115,74,0.3)',
    borderRadius: 12,
    padding: 20,
    backgroundColor: 'rgba(255,115,74,0.05)',
    gap: 10,
    marginBottom: 4,
  },
  upsellHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  upsellCategory: { letterSpacing: 1.5 },
  upsellTitle: {},
  upsellSubtitle: { lineHeight: 19 },
  upsellBtn: {
    borderWidth: 1,
    borderColor: ORANGE,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  upsellBtnText: { letterSpacing: 2, color: ORANGE, fontWeight: '700' },

  // Footer
  footer: {
    paddingHorizontal: H_PAD,
    paddingTop: 24,
    gap: 10,
    alignItems: 'center',
  },
  terms: { textAlign: 'center', lineHeight: 16, maxWidth: 300 },
  signOutBtn: { paddingVertical: 4 },
});
