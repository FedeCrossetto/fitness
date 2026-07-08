import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { HomeStackParamList } from '../../types/navigation';
import { layout, spacing } from '../../theme';
import { AppText, IconButton } from '../../components/common';
import { authColors } from '../auth/authScreenTheme';
import { MentoriaView } from '../auth/MentoriaView';
import { EvaluationFormScreen } from '../evaluation/EvaluationFormScreen';
import { EvaluationScheduleScreen } from '../evaluation/EvaluationScheduleScreen';
import { EvaluationThankYouScreen } from '../evaluation/EvaluationThankYouScreen';
import { useTabBarScrollPadding } from '../../hooks/useTabBarScrollPadding';
import { useAuthStore } from '../../stores/authStore';
import { hasPendingMentoriaEvaluation } from '../../services/evaluationGate';

type Props = NativeStackScreenProps<HomeStackParamList, 'MentoriaUpgrade'>;

/** Solicitar evaluación (Mentoría 1 a 1): formulario → agendar por Calendly → gracias.
 * Mismo patrón de gate local que SubscriptionPlansScreen (sin stack navigator para
 * estos tres pasos), reusado acá para el upgrade post-login. */
type EvalFlowStep = 'form' | 'schedule' | 'thanks' | null;

export function MentoriaUpgradeScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const scrollBottom = useTabBarScrollPadding();
  const [evalFlowStep, setEvalFlowStep] = useState<EvalFlowStep>(null);
  const profile = useAuthStore((s) => s.profile);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) return;
      let active = true;
      void hasPendingMentoriaEvaluation(profile.id).then((v) => { if (active) setAlreadyApplied(v); });
      return () => { active = false; };
    }, [profile?.id])
  );

  if (evalFlowStep === 'form') {
    return (
      <EvaluationFormScreen
        onBack={() => setEvalFlowStep(null)}
        onSubmitted={() => { setAlreadyApplied(true); setEvalFlowStep('schedule'); }}
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
        primaryAction={{ label: 'Volver a mi perfil', onPress: () => navigation.goBack() }}
      />
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: authColors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <IconButton
          icon="chevron-back"
          onPress={() => navigation.goBack()}
          accessibilityLabel="Volver"
          color={authColors.textPrimary}
          backgroundColor={authColors.surface}
        />
        <AppText variant="h3" color={authColors.textPrimary} style={styles.headerTitle}>
          Mentoría 1 a 1
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: scrollBottom }}
      >
        <MentoriaView
          onRequestEvaluation={() => setEvalFlowStep('form')}
          alreadyApplied={alreadyApplied}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: layout.minHitTarget },
});
