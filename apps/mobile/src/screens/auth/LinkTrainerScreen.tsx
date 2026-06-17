import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radius, Colors, useThemedStyles, useTheme } from '../../theme';
import { AppText, Button, Input } from '../../components/common';
import { useAuthStore } from '../../stores/authStore';
import { readPendingInviteCode } from '../../services/invite';

export function LinkTrainerScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  const { linkTrainer, loading, error, clearError, signOut } = useAuthStore();
  const [code, setCode] = useState('');

  useEffect(() => {
    void (async () => {
      const pending = await readPendingInviteCode();
      if (pending) setCode(pending);
    })();
  }, []);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="people-outline" size={28} color={colors.primary.default} />
        </View>

        <AppText variant="h1" color={colors.text.primary} style={styles.title}>
          Vinculá tu entrenador
        </AppText>
        <AppText variant="body14" color={colors.text.secondary} style={styles.subtitle}>
          Habito es por invitación. Ingresá el código que te compartió tu entrenador por WhatsApp o email.
          Quedarás en su lista como alumno pendiente hasta que te active.
        </AppText>

        <Input
          label="Código de invitación"
          icon="key-outline"
          placeholder="Ej: RESETINV"
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={(v) => {
            setCode(v);
            if (error) clearError();
          }}
          containerStyle={styles.field}
        />

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={colors.states.error} />
            <AppText variant="body13" color={colors.states.error} style={styles.errorText}>
              {error}
            </AppText>
          </View>
        ) : null}

        <Button
          label="Vincular y continuar"
          onPress={() => void linkTrainer(code)}
          loading={loading}
          disabled={code.trim().length < 3}
          fullWidth
          style={styles.cta}
        />

        <Button
          label="Cerrar sesión"
          variant="secondary"
          onPress={() => void signOut()}
          fullWidth
          style={styles.secondary}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { marginBottom: spacing.sm },
  subtitle: { lineHeight: 21, marginBottom: spacing.xl },
  field: { marginBottom: spacing.md },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorText: { flexShrink: 1 },
  cta: { marginTop: spacing.xs },
  secondary: { marginTop: spacing.md },
});
