import React from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { spacing } from '../../theme';
import { AppText, IconButton } from '../../components/common';
import type { AuthStackParamList } from '../../types/navigation';
import { authColors } from './authScreenTheme';
import { AuthButton } from './authUi';

type Props = NativeStackScreenProps<AuthStackParamList, 'PasswordResetSent'>;

export function PasswordResetSentScreen({ navigation }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.container, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg }]}>

        {/* Header row: back + title (igual a ForgotPassword) */}
        <View style={styles.headerRow}>
          <IconButton
            icon="chevron-back"
            onPress={() => navigation.navigate('Login')}
            accessibilityLabel="Volver al login"
            color={authColors.textPrimary}
            backgroundColor={authColors.surface}
            style={styles.backBtn}
          />
          <AppText variant="h2" style={styles.titleLine} numberOfLines={1} adjustsFontSizeToFit>
            <AppText variant="h2" color={authColors.textPrimary}>CORREO </AppText>
            <AppText variant="h2" color="#C1ED00">ENVIADO</AppText>
          </AppText>
        </View>

        {/* Main content */}
        <View style={styles.body}>
          {/* Icon */}
          <View style={styles.iconWrapper}>
            <View style={styles.iconBg}>
              <Ionicons name="checkmark" size={44} color={authColors.background} />
            </View>
          </View>

          <AppText variant="caps11" color={authColors.textTertiary} style={styles.subtitle}>
            REVISÁ TU BANDEJA DE ENTRADA. TE ENVIAMOS LAS INSTRUCCIONES PARA RESTABLECER TU CONTRASEÑA.
          </AppText>

          {/* Info box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#00E3FC" />
            <AppText variant="caps11" color={authColors.textSecondary} style={styles.infoText}>
              REVISÁ BIEN TU CARPETA DE SPAM. SI NO RECIBÍS EL CORREO EN LOS PRÓXIMOS 5 MINUTOS, CONTACTÁ AL SOPORTE.
            </AppText>
          </View>
        </View>

        {/* Bottom actions */}
        <View style={styles.bottom}>
          <AuthButton
            label="ENTENDIDO"
            onPress={() => navigation.navigate('Login')}
            fullWidth
          />

          <Pressable
            onPress={() => void Linking.openURL('mailto:soporte@metodor3set.com')}
            style={styles.supportRow}
            accessibilityRole="button"
          >
            <AppText variant="caps11" color={authColors.textTertiary}>
              ¿NO RECIBISTE EL CORREO?{'  '}
              <AppText variant="caps11" color="#C1ED00">
                CONTACTÁ A SOPORTE
              </AppText>
            </AppText>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: authColors.background },
  container: { flex: 1, paddingHorizontal: spacing.xl },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  backBtn:  { borderColor: authColors.border, flexShrink: 0 },
  titleLine: { flex: 1, letterSpacing: -0.5 },

  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },

  iconWrapper: {
    shadowColor: '#C1ED00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  iconBg: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: '#C1ED00',
    alignItems: 'center',
    justifyContent: 'center',
  },

  subtitle: {
    textAlign: 'center',
    lineHeight: 18,
    letterSpacing: 0.8,
    paddingHorizontal: spacing.sm,
  },

  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: authColors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: authColors.border,
    padding: spacing.md,
    alignSelf: 'stretch',
  },
  infoText: { flex: 1, lineHeight: 18, letterSpacing: 0.6 },

  bottom: {
    gap: spacing.md,
  },
  supportRow: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
});
