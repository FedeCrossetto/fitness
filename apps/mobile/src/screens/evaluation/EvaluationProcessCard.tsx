import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '../../theme';
import { AppText } from '../../components/common';
import { authColors } from '../auth/authScreenTheme';
import { LIMA } from '../auth/formFields';

interface ProcessStep {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}

const STEPS: ProcessStep[] = [
  {
    icon: 'chatbubble-outline',
    title: '1. Reviso tu solicitud',
    body: 'Analizo tu información para entender tu situación actual, objetivos y necesidades.',
  },
  {
    icon: 'chatbubbles-outline',
    title: '2. Charla personalizada',
    body: 'Hablamos sobre tu caso y te muestro el plan ideal para vos.',
  },
  {
    icon: 'rocket-outline',
    title: '3. Comenzamos',
    body: 'Te acompaño paso a paso para que logres resultados reales y sostenibles.',
  },
];

interface Props {
  title: string;
  subtitle: string;
  intro: string;
}

/** Icono + título + tarjeta "¿CÓMO ES EL PROCESO?" + cierre — contenido
 * compartido entre EvaluationThankYouScreen (justo después de enviar la
 * solicitud) y MentoriaWaitingScreen (mismo contenido, ya dentro de la app,
 * mientras el cliente espera la reunión con el coach). */
export function EvaluationProcessCard({ title, subtitle, intro }: Props): React.JSX.Element {
  return (
    <>
      <View style={styles.iconOuter}>
        <View style={styles.iconInner}>
          <Ionicons name="checkmark" size={36} color={LIMA} />
        </View>
      </View>

      <AppText variant="h1" color={authColors.textPrimary} align="center" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="body16SemiBold" color={LIMA} align="center" style={styles.thanks}>
        {subtitle}
      </AppText>
      <AppText variant="body14" color={authColors.textSecondary} align="center" style={styles.intro}>
        {intro}
      </AppText>

      <View style={styles.card}>
        <AppText variant="caps11" color={LIMA} style={styles.cardLabel}>
          ¿CÓMO ES EL PROCESO?
        </AppText>
        {STEPS.map((step) => (
          <View key={step.title} style={styles.stepRow}>
            <View style={styles.stepIcon}>
              <Ionicons name={step.icon} size={18} color={LIMA} />
            </View>
            <View style={styles.stepCopy}>
              <AppText variant="body14SemiBold" color={authColors.textPrimary}>
                {step.title}
              </AppText>
              <AppText variant="body13" color={authColors.textSecondary} style={styles.stepBody}>
                {step.body}
              </AppText>
            </View>
          </View>
        ))}
      </View>

      <Ionicons name="heart-outline" size={22} color={authColors.textTertiary} style={styles.heart} />
      <AppText variant="body14SemiBold" color={authColors.textPrimary} align="center" style={styles.closing}>
        Este es el comienzo de algo grande.{'\n'}¡Vamos por tu mejor versión! 💪
      </AppText>
    </>
  );
}

const styles = StyleSheet.create({
  iconOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(193,237,0,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  iconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(193,237,0,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: { letterSpacing: -0.5, marginBottom: spacing.sm },
  thanks: { marginBottom: spacing.sm },
  intro: { lineHeight: 20, marginBottom: spacing.xl, paddingHorizontal: spacing.sm },

  card: {
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: authColors.border,
    borderRadius: 16,
    padding: spacing.lg,
    backgroundColor: authColors.surface,
    marginBottom: spacing.xl,
  },
  cardLabel: { letterSpacing: 1, marginBottom: spacing.md },
  stepRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(193,237,0,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepCopy: { flex: 1 },
  stepBody: { marginTop: 2, lineHeight: 18 },

  heart: { marginBottom: spacing.sm },
  closing: { lineHeight: 20, marginBottom: spacing.xl },
});
