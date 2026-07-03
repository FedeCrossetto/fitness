import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MentoriaWaitStackParamList } from '../../types/navigation';
import { spacing } from '../../theme';
import { AppText, Avatar } from '../../components/common';
import { authColors } from '../auth/authScreenTheme';
import { useAuthStore } from '../../stores/authStore';
import { EvaluationProcessCard } from './EvaluationProcessCard';

type Props = NativeStackScreenProps<MentoriaWaitStackParamList, 'Waiting'>;

/**
 * Pantalla que reemplaza TODOS los tabs principales (Inicio, Entrenar,
 * Nutrición, Progreso) para un cliente nuevo que eligió Mentoría 1-1 y
 * todavía no fue activado por el entrenador — ver RootNavigator, que la
 * muestra en vez de MainTabs mientras `hasPendingMentoriaEvaluation` sea true.
 * El avatar (igual que en HomeScreen) es la única forma de navegar, hacia un
 * perfil mínimo (cambiar foto, cerrar sesión).
 */
export function MentoriaWaitingScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <Pressable
        onPress={() => navigation.navigate('Profile')}
        accessibilityLabel="Ir a mi perfil"
        style={styles.header}
      >
        <Avatar name={profile?.full_name} imageUrl={profile?.avatar_url} size={40} />
        <AppText variant="body14SemiBold" color={authColors.textPrimary}>
          {profile?.full_name ?? 'Mi perfil'}
        </AppText>
      </Pressable>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <EvaluationProcessCard
          title="¡SOLICITUD ENVIADA!"
          subtitle="Gracias por confiar en mí. 💚"
          intro="Recibí tu solicitud correctamente. Estoy muy contento de que hayas dado este paso."
        />
        <AppText variant="body13" color={authColors.textTertiary} align="center" style={styles.note}>
          Te vamos a avisar ni bien tu coach confirme la reunión — mientras tanto, la app queda en este estado.
        </AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: authColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  content: { paddingHorizontal: spacing.xl, alignItems: 'center' },
  note: { lineHeight: 18, paddingHorizontal: spacing.sm },
});
