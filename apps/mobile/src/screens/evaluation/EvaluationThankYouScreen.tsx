import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '../../theme';
import { AppText } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { authColors } from '../auth/authScreenTheme';
import { AuthButton } from '../auth/authUi';
import { EvaluationProcessCard } from './EvaluationProcessCard';

interface Props {
  /** Botón principal — varía según de dónde se llegó: "Continuar a la app"
   * desde el alta de un cliente nuevo, "Volver a mi perfil" desde el upgrade
   * de un cliente que ya paga Plan Base. */
  primaryAction: { label: string; onPress: () => void };
}

/** Confirmación final, mismo contenido que alegerezcoach.com/es/evaluacion/gracias. */
export function EvaluationThankYouScreen({ primaryAction }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const signOut = useAuthStore((s) => s.signOut);

  const onSignOut = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que querés cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <EvaluationProcessCard
          title="¡SOLICITUD ENVIADA!"
          subtitle="Gracias por confiar en mí. 💚"
          intro="Recibí tu solicitud correctamente. Estoy muy contento de que hayas dado este paso."
        />

        <AuthButton label={primaryAction.label} onPress={primaryAction.onPress} fullWidth style={styles.cta} />
        <Pressable onPress={onSignOut} style={styles.signOutBtn}>
          <AppText variant="body12" color={authColors.textTertiary}>
            Cerrar sesión
          </AppText>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.background },
  content: { paddingHorizontal: spacing.xl, alignItems: 'center' },
  cta: { alignSelf: 'stretch' },
  signOutBtn: { paddingVertical: spacing.md },
});
