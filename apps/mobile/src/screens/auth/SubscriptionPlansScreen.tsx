import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useUiStore } from '../../stores/uiStore';
import { clearSubscriptionAccessCache, fetchPlans, syncSubscription } from '../../services/payments';
import { useCheckoutStore } from '../../stores/checkoutStore';
import { useAppActive } from '../../hooks/useAppActive';
import { authColors } from './authScreenTheme';
import type { PlanRow } from '../../types/database';
import { EvaluationFormScreen } from '../evaluation/EvaluationFormScreen';
import { EvaluationScheduleScreen } from '../evaluation/EvaluationScheduleScreen';
import { EvaluationThankYouScreen } from '../evaluation/EvaluationThankYouScreen';
import { MentoriaView, ORANGE, BASE_COMPLEMENTS } from './MentoriaView';
import { openTermsAndConditions } from '../../lib/legalLinks';

const H_PAD = 20;
const CARD_WIDTH = 108;
const CARD_GAP = 10;

function monthsOf(plan: PlanRow): number {
  return Math.max(1, Math.round(plan.duration_days / 30));
}

function monthLabel(m: number): string {
  return `${m} ${m === 1 ? 'Mes' : 'Meses'}`;
}

// ── Selector de frecuencia de facturación ────────────────────────────────────
// Tarjetas horizontales swipeables en vez de sheet/modal: se despliega inline
// debajo del link "Ahorrá más en los planes", así el usuario compara
// deslizando sin perder de vista el resto de la pantalla.

function FrequencyCarousel({
  plans,
  selectedId,
  onSelect,
}: {
  plans: PlanRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  // snapToInterval por sí solo no alcanza: como el contenido arranca con un
  // padding inicial (para que la primera tarjeta no quede pegada al borde),
  // los múltiplos de (CARD_WIDTH+GAP) no coinciden con el borde real de cada
  // tarjeta y el snap terminaba cortando una a la mitad. snapToOffsets con
  // el offset exacto de cada tarjeta soluciona eso.
  const snapOffsets = plans.map((_, i) => i * (CARD_WIDTH + CARD_GAP));
  const scrollRef = useRef<ScrollView>(null);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToOffsets={snapOffsets}
      decelerationRate="fast"
      contentContainerStyle={styles.carouselContent}
      style={styles.carousel}
    >
      {plans.map((plan, index) => {
        const m = monthsOf(plan);
        const perMonth = Math.round(plan.price_ars / m);
        const active = plan.id === selectedId;
        return (
          <TouchableOpacity
            key={plan.id}
            style={[styles.freqCard, active && styles.freqCardActive]}
            onPress={() => {
              onSelect(plan.id);
              // Al tocar una tarjeta que quedó parcialmente fuera de vista
              // (ej. la última al final del scroll), la traemos entera a
              // pantalla en vez de dejar que el usuario tenga que arrastrarla.
              scrollRef.current?.scrollTo({ x: snapOffsets[index], animated: true });
            }}
            activeOpacity={0.8}
          >
            <AppText
              variant="body14SemiBold"
              color={active ? authColors.lima : authColors.textPrimary}
            >
              {monthLabel(m)}
            </AppText>
            <AppText variant="body12" color={authColors.textTertiary} style={styles.freqCardPerMonth}>
              ${perMonth.toLocaleString('es-AR')}/mes
            </AppText>
            <AppText variant="body12" color={authColors.textTertiary}>
              Total ${Math.round(plan.price_ars).toLocaleString('es-AR')}
            </AppText>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
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
  const [pickerOpen, setPickerOpen] = useState(true);

  const selected = sorted[selectedIdx] ?? null;
  const selectedMonths = selected ? monthsOf(selected) : 1;
  const totalPrice = selected ? Math.round(selected.price_ars) : null;
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

        {!loadingPlans && selected ? (
          <>
            <View style={styles.totalRow}>
              <AppText variant="body13Medium" color={authColors.textSecondary}>
                Cobro mensual automático
              </AppText>
            </View>
            {selectedMonths > 1 && totalPrice ? (
              <AppText variant="body12" color={authColors.textTertiary} style={styles.totalCaption}>
                Equivale a ${totalPrice.toLocaleString('es-AR')} en total durante {selectedMonths} meses.
              </AppText>
            ) : null}
          </>
        ) : null}

        <AppText variant="body13" color={authColors.textSecondary} style={styles.planDescription}>
          La forma más simple de empezar tu transformación.
        </AppText>

        {/* Abierto por default: el objetivo no es esconder las otras
         * frecuencias, sino no competir visualmente con "EMPEZAR HOY" en 1
         * mes — por eso el título es de bajo contraste, no un botón grande. */}
        {!loadingPlans && sorted.length > 1 && (
          <TouchableOpacity
            style={styles.freqLink}
            onPress={() => setPickerOpen((v) => !v)}
            activeOpacity={0.6}
          >
            <AppText variant="body12" color={authColors.textTertiary}>
              Ahorrá más en los planes:
            </AppText>
            <Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-forward'} size={13} color={authColors.textTertiary} />
          </TouchableOpacity>
        )}

        {pickerOpen ? (
          <FrequencyCarousel
            plans={sorted}
            selectedId={selected?.id ?? null}
            onSelect={(id) => {
              const idx = sorted.findIndex((p) => p.id === id);
              if (idx >= 0) setSelectedIdx(idx);
            }}
          />
        ) : null}

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
  const [starting, setStarting] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('base');
  const [evalFlowStep, setEvalFlowStep] = useState<EvalFlowStep>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Cambiar de tab (Base ↔ Mentoría) — desde el toggle o desde el upsell al
  // fondo de Plan Base — siempre vuelve al inicio de la pantalla. Si no, al
  // venir del botón "VER MENTORÍA 1 A 1" (al pie del scroll) el usuario
  // quedaba viendo el fondo del contenido de Mentoría en vez de su inicio.
  const switchTab = useCallback((tab: Tab) => {
    setActiveTab(tab);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, []);

  const loadPlans = useCallback(async () => {
    if (!userId) return;
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
  }, [userId]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  // Realtime: si el entrenador cambia precio/visibilidad o da de alta/baja una
  // frecuencia mientras el alumno está parado en esta pantalla, se refleja al
  // instante sin necesidad de backgroundear la app. La visibilidad de un plan
  // built-in vive en trainer_plan_prices.active y la de un custom en
  // plans.active, por eso escuchamos las dos tablas.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`plans-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans' }, () => { void loadPlans(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trainer_plan_prices' }, () => { void loadPlans(); })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, loadPlans]);

  // Recuperación de suscripciones que quedaron `pending` pero ya se pagaron
  // (webhook perdido / usuario que cerró el navegador de MP y volvió más tarde).
  // Consultamos activamente a MP; si autorizó, la fila se activa y el gate avanza.
  const recoverPendingSubscription = useCallback(async () => {
    if (!userId) return;
    const result = await syncSubscription();
    if (result?.status === 'active') {
      clearSubscriptionAccessCache();
      await refreshProfile();
    }
  }, [userId, refreshProfile]);

  useEffect(() => {
    void recoverPendingSubscription();
  }, [recoverPendingSubscription]);

  useAppActive(() => {
    clearSubscriptionAccessCache();
    void recoverPendingSubscription();
    void refreshProfile();
    // El entrenador puede haber cambiado precio/visibilidad de una frecuencia
    // mientras el alumno tenía la app en background parado en esta pantalla —
    // sin esto, volvía a foreground viendo la lista vieja hasta remontar.
    void loadPlans();
  });

  const onSelectPlan = useCallback(async (id: string) => {
    // `start` pasa el checkout a 'processing' de forma síncrona → el RootNavigator
    // swapea a CheckoutResultScreen al instante. `starting` cubre el frame previo.
    setStarting(true);
    await useCheckoutStore.getState().start(id);
    // Si falló (volvió a 'idle') destrabamos el botón; si abrió MP ('processing')
    // esta pantalla ya se está desmontando, no tocamos el estado.
    if (useCheckoutStore.getState().phase === 'idle') setStarting(false);
  }, []);

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
        ref={scrollRef}
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
              onPress={() => switchTab('base')}
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
              onPress={() => switchTab('mentoria')}
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
            checkingOut={starting}
            onSelectPlan={onSelectPlan}
            onSwitchToMentoria={() => switchTab('mentoria')}
          />
        ) : (
          <MentoriaView onRequestEvaluation={() => setEvalFlowStep('form')} />
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <AppText variant="body12" color={authColors.textTertiary} style={styles.terms}>
            Al seleccionar un plan aceptás nuestros{' '}
            <AppText
              variant="body12"
              color={authColors.textTertiary}
              style={styles.termsLink}
              onPress={openTermsAndConditions}
              suppressHighlighting
            >
              términos y condiciones
            </AppText>
            {' '}y políticas de privacidad. Todos los planes incluyen actualizaciones constantes del Método R3SET.
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

  totalRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -8 },
  totalCaption: { marginTop: -4 },

  freqLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },

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
  termsLink: { textDecorationLine: 'underline' },
  signOutBtn: { paddingVertical: 4 },

  // Frequency carousel (tarjetas horizontales swipeables)
  // Sin bleed hacia los bordes de la tarjeta: si el offset no coincide
  // exacto con el padding real de planCard (24) las tarjetas quedan cortadas
  // contra el borde redondeado. Vive dentro del padding normal del card.
  carousel: {},
  carouselContent: { gap: CARD_GAP },
  freqCard: {
    width: CARD_WIDTH,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#161616',
    gap: 2,
  },
  freqCardActive: {
    borderColor: authColors.lima,
    backgroundColor: 'rgba(193,237,0,0.08)',
  },
  freqCardPerMonth: { marginTop: 2 },
});
