import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, illustrations, spacing } from '../../theme';
import { clientConfig } from '../../config/clientConfig';
import { AppText, Button, Chip } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { hapticSuccess } from '../../lib/haptics';

const GOALS = [
  'Bajar de peso',
  'Ganar masa muscular',
  'Mejorar resistencia',
  'Tonificar',
  'Salud general',
];

const LEVELS = ['Principiante', 'Intermedio', 'Pro'];

/** Onboarding breve post-registro: objetivo + nivel, con la mascota hero como protagonista. */
export function OnboardingScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { profile, completeOnboarding, loading, error } = useAuthStore();
  const [goal, setGoal] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);

  const firstName = profile?.full_name?.split(' ')[0] ?? '';

  const handleFinish = async () => {
    if (!goal || !level) return;
    const ok = await completeOnboarding({ goal, level });
    if (ok) hapticSuccess();
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroWrap}>
          <Image source={illustrations.hero} style={styles.mascot} contentFit="contain" priority="high" />
          <LinearGradient
            colors={[...colors.gradients.darkFade]}
            style={styles.heroFade}
            pointerEvents="none"
          />
        </View>

        <AppText variant="h1" color={colors.text.primary}>
          {firstName ? `¡Hola, ${firstName}!` : '¡Hola!'}
        </AppText>
        <AppText variant="body16" color={colors.text.secondary} style={styles.subtitle}>
          Contanos tu objetivo y armamos todo a tu medida.
        </AppText>

        <AppText variant="caps13" color={colors.text.tertiary} style={styles.sectionLabel}>
          Tu objetivo
        </AppText>
        <View style={styles.chips}>
          {GOALS.map((g) => (
            <Chip key={g} label={g} active={goal === g} onPress={() => setGoal(g)} />
          ))}
        </View>

        <AppText variant="caps13" color={colors.text.tertiary} style={styles.sectionLabel}>
          Tu nivel
        </AppText>
        <View style={styles.chips}>
          {LEVELS.map((l) => (
            <Chip key={l} label={l} active={level === l} onPress={() => setLevel(l)} />
          ))}
        </View>

        {error ? (
          <AppText variant="body13" color={colors.states.error} style={styles.error}>
            {error}
          </AppText>
        ) : null}

        <Button
          label={clientConfig.copy.onboardingCta}
          onPress={() => void handleFinish()}
          loading={loading}
          disabled={!goal || !level}
          fullWidth
          style={styles.cta}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl },
  heroWrap: { alignItems: 'center', marginBottom: spacing.md },
  mascot: { width: 190, height: 250 },
  heroFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },
  subtitle: { marginTop: spacing.xs },
  sectionLabel: { marginTop: spacing.xl, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  error: { marginTop: spacing.md },
  cta: { marginTop: spacing.xxl },
});
