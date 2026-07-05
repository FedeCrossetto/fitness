import React, { useCallback, useEffect } from 'react';
import { Pressable, StatusBar, StyleSheet, View } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '../../components/common';
import { authColors } from './authScreenTheme';
import { AuthButton } from './authUi';
import { useAuthStore } from '../../stores/authStore';
import { useBiometricStore } from '../../stores/biometricStore';
import { markSetupDecided } from '../../services/biometrics';
import { useUiStore } from '../../stores/uiStore';

// Cyan de acento solo para esta pantalla (resalta "Face ID"/"Touch ID" en el
// subtítulo) — mismo valor que el diseño de referencia (Stitch), no es un
// color de marca reutilizado en el resto de la app.
const CYAN = '#00E3FD';
const ICON_SIZE = 208;

interface Props {
  /** Se llama tanto si activa como si elige "Quizás más tarde" — en ambos
   * casos la decisión queda guardada y este paso no vuelve a aparecer. */
  onDecided: () => void;
}

function ScanLine(): React.JSX.Element {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value > 0.05 && progress.value < 0.95 ? 1 : 0,
    top: `${10 + progress.value * 80}%`,
  }));

  return <Animated.View pointerEvents="none" style={[styles.scanLine, style]} />;
}

/** Pantalla de configuración de acceso rápido (Face ID / Touch ID), post
 * deslinde + consentimiento de imagen. Es un paso más del flujo de activación
 * (ver activationGate.ts) — se muestra una sola vez por usuario. */
export function BiometricSetupScreen({ onDecided }: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.session?.user.id);
  const supported = useBiometricStore((s) => s.supported);

  // Defensivo: si por alguna carrera esta pantalla se monta sin soporte de
  // hardware (el gate ya debería haberlo filtrado), no mostramos un botón que
  // va a fallar — avanzamos directo.
  useEffect(() => {
    if (!supported && userId) {
      void markSetupDecided(userId).then(onDecided);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, userId]);

  const onActivar = useCallback(async () => {
    if (!userId) return;
    const ok = await useBiometricStore.getState().enableFromSetup(userId);
    if (!ok) {
      useUiStore.getState().showToast(
        'error',
        'No pudimos verificar tu identidad. Probá de nuevo o elegí "Quizás más tarde".',
      );
      return;
    }
    await markSetupDecided(userId);
    onDecided();
  }, [userId, onDecided]);

  const onMasTarde = useCallback(async () => {
    if (userId) await markSetupDecided(userId);
    onDecided();
  }, [userId, onDecided]);

  if (!supported) return <View style={styles.root} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={authColors.background} />

      {/* Halo decorativo de fondo */}
      <View pointerEvents="none" style={styles.bgGlowTop} />
      <View pointerEvents="none" style={styles.bgGlowBottom} />
      <View pointerEvents="none" style={styles.ringTopRight} />
      <View pointerEvents="none" style={styles.ringBottomLeft} />

      <View style={styles.content}>
        {/* Anclaje biométrico */}
        <View style={styles.iconOuterGlow}>
          <View style={styles.iconCircle}>
            <ScanLine />
            <MaterialIcons name="face" size={88} color={authColors.lima} />
            <View style={styles.fingerprintRow}>
              <Ionicons name="finger-print" size={22} color="rgba(255,255,255,0.4)" />
            </View>
          </View>
        </View>

        <View style={styles.textBlock}>
          <AppText variant="h1" color={authColors.textPrimary} style={styles.title}>
            {'ACCESO\nRÁPIDO'}
          </AppText>
          <AppText variant="body16" color={authColors.textSecondary} style={styles.subtitle}>
            Entrá a tu entrenamiento al instante configurando{' '}
            <AppText variant="body16SemiBold" color={CYAN}>Face ID</AppText>
            {' '}o{' '}
            <AppText variant="body16SemiBold" color={CYAN}>Touch ID</AppText>.
          </AppText>
        </View>
      </View>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <AuthButton
          label="ACTIVAR AHORA"
          onPress={() => void onActivar()}
          icon="chevron-forward"
          variant="brand"
          fullWidth
        />
        <Pressable onPress={() => void onMasTarde()} style={styles.laterBtn}>
          <AppText variant="caps11" color={authColors.textTertiary} style={styles.laterText}>
            Quizás más tarde
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: authColors.background },

  bgGlowTop: {
    position: 'absolute',
    top: '18%',
    left: '50%',
    marginLeft: -220,
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: 'rgba(193,237,0,0.05)',
  },
  bgGlowBottom: {
    position: 'absolute',
    bottom: -60,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(0,227,253,0.04)',
  },
  ringTopRight: {
    position: 'absolute',
    top: -48,
    right: -48,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(0,227,253,0.1)',
  },
  ringBottomLeft: {
    position: 'absolute',
    bottom: -90,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: 'rgba(193,237,0,0.08)',
  },

  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  iconOuterGlow: {
    marginBottom: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 44,
    backgroundColor: 'rgba(38,38,38,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
    shadowColor: authColors.lima,
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 0 },
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: authColors.lima,
    shadowColor: authColors.lima,
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  fingerprintRow: { opacity: 0.7 },

  textBlock: { alignItems: 'center', gap: 20 },
  title: {
    textAlign: 'center',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
    fontWeight: '300',
  },

  actions: { paddingHorizontal: 24, gap: 8 },
  laterBtn: { paddingVertical: 14, alignItems: 'center' },
  laterText: { letterSpacing: 2 },
});
