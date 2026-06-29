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

const LIMA = '#C1ED00';
const ORANGE = '#FF734A';
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

const BASE_COMPLEMENTS = [
  'Consultas nutricionales con profesionales especializados',
  'Acompañamiento psicológico para fortalecer hábitos y emociones',
];

const MENTORIA_FEATURES: { text: string; bold?: boolean }[] = [
  { text: 'Comunicación directa conmigo', bold: true },
  { text: 'Entrenamiento personalizado 100% (gimnasio - hogar)' },
  { text: 'Estrategia alimentaria adaptada' },
  { text: 'Seguimiento y análisis de todas tus comidas', bold: true },
  { text: 'Ajustes permanentes' },
  { text: 'Aplicación exclusiva para Android e iPhone' },
  { text: 'Sesiones 1-1 conmigo', bold: true },
  { text: 'Comunidad privada de alumnos' },
  { text: 'Prioridad absoluta en la respuesta' },
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
        <AppText variant="caps11" color={LIMA} style={styles.planCategory}>
          ACCESO INMEDIATO
        </AppText>
        <AppText variant="h1" color={authColors.textPrimary} style={styles.planTitle}>
          PLAN BASE
        </AppText>

        {/* Price */}
        <View style={styles.priceRow}>
          <AppText variant="body13" color={authColors.textSecondary}>Desde ARS </AppText>
          {loadingPlans ? (
            <ActivityIndicator color={LIMA} size="small" />
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
              const label = m === 1 ? '1 Mes' : m <= 3 ? '3 Meses' : '6 Meses';
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
        <AppText variant="caps11" color={LIMA} style={styles.sectionLabel}>
          EL PLAN BASE INCLUYE:
        </AppText>
        {BASE_FEATURES.map((f) => (
          <View key={f} style={styles.featureRow}>
            <Ionicons name="checkmark" size={16} color={LIMA} />
            <AppText variant="body13" color={authColors.textSecondary} style={styles.featureText}>
              {f}
            </AppText>
          </View>
        ))}

        {/* Complements */}
        <View style={styles.complementsBlock}>
          <AppText variant="caps11" color={LIMA} style={styles.sectionLabel}>
            COMPLEMENTÁ TU PROCESO CON:
          </AppText>
          {BASE_COMPLEMENTS.map((c) => (
            <View key={c} style={styles.featureRow}>
              <Ionicons name="checkmark" size={14} color={LIMA} />
              <AppText variant="body12" color={authColors.textTertiary} style={styles.featureText}>
                {c}
              </AppText>
            </View>
          ))}
        </View>

        {/* Banner */}
        <View style={styles.motiveBanner}>
          <AppText variant="caps11" color={LIMA} style={styles.motiveBannerText}>
            EL PRIMER PASO ES EL MÁS IMPORTANTE.
          </AppText>
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: LIMA }]}
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

// ── Mentoría View ─────────────────────────────────────────────────────────────

function MentoriaView(): React.JSX.Element {
  return (
    <View style={styles.tabContent}>
      {/* Banner transformacion */}
      <View style={styles.mentoriaBanner}>
        <AppText variant="body13" color={authColors.textPrimary} style={styles.mentoriaBannerText}>
          <AppText variant="body13" color={ORANGE} style={styles.mentoriaBannerBold}>
            Transformación Radical:{' '}
          </AppText>
          Este no es solo un plan, es un compromiso mutuo para alcanzar tu mejor versión con mi supervisión directa.
        </AppText>
      </View>

      {/* Main card */}
      <View style={styles.mentoriaCard}>
        {/* CUPOS LIMITADOS badge */}
        <View style={styles.cuposBadge}>
          <AppText variant="caps11" color={authColors.background} style={styles.cuposText}>
            CUPOS LIMITADOS
          </AppText>
        </View>

        <AppText variant="caps11" color={ORANGE} style={[styles.planCategory, { marginTop: 8 }]}>
          ACOMPAÑAMIENTO PERSONALIZADO
        </AppText>
        <AppText variant="h1" color={authColors.textPrimary} style={styles.planTitle}>
          MENTORÍA 1 A 1
        </AppText>

        {/* 100% personalizado */}
        <View style={styles.mentoriaPctRow}>
          <AppText variant="metricMedium" color={authColors.textPrimary} style={styles.mentoriaPct}>
            100%
          </AppText>
          <AppText variant="body16SemiBold" color={authColors.textSecondary}>
            {' '}personalizado
          </AppText>
        </View>
        <AppText variant="caps11" color={authColors.textTertiary} style={styles.mentoriaDesigned}>
          DISEÑADO EXCLUSIVAMENTE PARA VOS.
        </AppText>
        <AppText variant="body14" color={authColors.textPrimary} style={styles.mentoriaSubtitle}>
          Mi nivel más alto de acompañamiento.
        </AppText>

        {/* Features */}
        <AppText variant="caps11" color={ORANGE} style={styles.sectionLabel}>
          INCLUYE LO DEL PLAN BASE Y ADEMÁS:
        </AppText>
        {MENTORIA_FEATURES.map(({ text, bold }) => (
          <View key={text} style={styles.featureRow}>
            <Ionicons name="checkmark" size={16} color={ORANGE} />
            <AppText
              variant="body13"
              color={bold ? authColors.textPrimary : authColors.textSecondary}
              style={[styles.featureText, bold && styles.featureBold]}
            >
              {text}
            </AppText>
          </View>
        ))}

        {/* Complements */}
        <View style={styles.complementsBlock}>
          <AppText variant="caps11" color={ORANGE} style={styles.sectionLabel}>
            COMPLEMENTÁ TU PROCESO CON:
          </AppText>
          {BASE_COMPLEMENTS.map((c) => (
            <View key={c} style={styles.featureRow}>
              <Ionicons name="checkmark" size={14} color={ORANGE} />
              <AppText variant="body12" color={authColors.textTertiary} style={styles.featureText}>
                {c}
              </AppText>
            </View>
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: ORANGE }]}
          activeOpacity={0.85}
          onPress={() => {/* contact trainer */}}
        >
          <AppText variant="caps11" color={authColors.background} style={styles.ctaText}>
            SOLICITAR EVALUACIÓN
          </AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────────────────────

type Tab = 'base' | 'mentoria';

export function SubscriptionPlansScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const signOut = useAuthStore((s) => s.signOut);
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [, setCheckoutId] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('base');

  const { checkingOut, startCheckout } = useCheckout(userId, () => {
    void refreshProfile();
  });

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      try {
        const list = await fetchPlans(userId);
        setPlans(list);
      } catch {
        // mostrar igual con mentoría
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

  const onSelectPlan = useCallback((id: string) => {
    setCheckoutId(id);
    void startCheckout(id);
  }, [startCheckout]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={authColors.background} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => void signOut()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={authColors.textPrimary} />
        </TouchableOpacity>
        <AppText variant="body16SemiBold" color={authColors.textPrimary}>
          Elegí tu Plan
        </AppText>
        <AppText variant="body16SemiBold" color={LIMA} style={styles.brandLabel}>
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
          <AppText variant="caps11" color={LIMA} style={styles.heroLabel}>
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
          <MentoriaView />
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.yaPageBtn}
            onPress={() => void onCheck()}
            disabled={checking}
          >
            {checking ? (
              <ActivityIndicator color={authColors.textTertiary} size="small" />
            ) : (
              <AppText variant="body13" color={authColors.textTertiary}>
                Ya pagué, actualizar estado
              </AppText>
            )}
          </TouchableOpacity>
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
  backBtn: { marginRight: 12 },
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
  heroLine: { width: 52, height: 3, backgroundColor: LIMA },

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
  toggleBtnActiveBase: { backgroundColor: LIMA },
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

  // Mentoría
  mentoriaBanner: {
    borderLeftWidth: 2,
    borderLeftColor: ORANGE,
    backgroundColor: 'rgba(255,115,74,0.08)',
    borderRadius: 8,
    padding: 14,
    marginBottom: 4,
  },
  mentoriaBannerText: { lineHeight: 19 },
  mentoriaBannerBold: { fontWeight: '700' },

  mentoriaCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,115,74,0.3)',
    borderRadius: 12,
    padding: 24,
    backgroundColor: '#0e0e0e',
    gap: 14,
    marginBottom: 4,
  },
  cuposBadge: {
    alignSelf: 'center',
    backgroundColor: ORANGE,
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 4,
  },
  cuposText: { letterSpacing: 1.5 },

  mentoriaPctRow: { flexDirection: 'row', alignItems: 'baseline' },
  mentoriaPct: { fontSize: 36, fontWeight: '800', lineHeight: 40 },
  mentoriaDesigned: { letterSpacing: 2, marginTop: -6 },
  mentoriaSubtitle: { fontWeight: '700' },

  // Footer
  footer: {
    paddingHorizontal: H_PAD,
    paddingTop: 24,
    gap: 10,
    alignItems: 'center',
  },
  yaPageBtn: { paddingVertical: 8 },
  terms: { textAlign: 'center', lineHeight: 16, maxWidth: 300 },
  signOutBtn: { paddingVertical: 4 },
});
