import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../../components/common';
import { authColors } from './authScreenTheme';

export const ORANGE = '#FF734A';

export const BASE_COMPLEMENTS = [
  'Consultas nutricionales con profesionales especializados',
  'Acompañamiento psicológico para fortalecer hábitos y emociones',
];

export const MENTORIA_FEATURES: { text: string; bold?: boolean }[] = [
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

/** Tarjeta completa de "Mentoría 1 a 1" — usada tanto en el gate de activación
 * (SubscriptionPlansScreen) como en la pantalla de upgrade post-login
 * (MentoriaUpgradeScreen), para no duplicar copy/estilo entre ambas. */
export function MentoriaView({
  onRequestEvaluation,
  alreadyApplied = false,
}: {
  onRequestEvaluation: () => void;
  alreadyApplied?: boolean;
}): React.JSX.Element {
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
          style={[styles.ctaBtn, { backgroundColor: ORANGE }, alreadyApplied && styles.ctaBtnDisabled]}
          activeOpacity={alreadyApplied ? 1 : 0.85}
          disabled={alreadyApplied}
          onPress={onRequestEvaluation}
        >
          <AppText variant="caps11" color={authColors.background} style={styles.ctaText}>
            {alreadyApplied ? 'YA APLICASTE · AGUARDÁ CONTACTO' : 'SOLICITAR EVALUACIÓN'}
          </AppText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const H_PAD = 20;

const styles = StyleSheet.create({
  tabContent: { paddingHorizontal: H_PAD, gap: 16 },

  planCategory: { letterSpacing: 2 },
  planTitle: { fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 34 },

  sectionLabel: { letterSpacing: 2, marginTop: 6 },

  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  featureText: { flex: 1, lineHeight: 20 },
  featureBold: { fontWeight: '700', color: '#FFFFFF' },

  complementsBlock: { gap: 10, paddingTop: 4 },

  ctaBtn: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  ctaText: { letterSpacing: 2.5, fontWeight: '800' },
  ctaBtnDisabled: { opacity: 0.5 },

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
});
