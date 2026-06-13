import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from '../../lib/speech';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { illustrations, layout, radius, shadows, spacing, Colors, useThemedStyles, useTheme } from '../../theme';
import { AppText, Button, ErrorState, IconButton, Input } from '../../components/common';
import { hapticSuccess } from '../../lib/haptics';
import { useAuthStore } from '../../stores/authStore';
import { useNutritionStore } from '../../stores/nutritionStore';
import { useUiStore } from '../../stores/uiStore';
import type { NutritionStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<NutritionStackParamList, 'VoiceLog'>;

type PermissionStatus = 'pending' | 'granted' | 'denied';

const KCAL_REGEX = /(\d+)\s*(kcal|calorías|calorias)/i;

function extractKcal(text: string): number {
  const match = KCAL_REGEX.exec(text);
  return match ? Number(match[1]) : 0;
}

export function VoiceLogScreen({ navigation, route }: Props): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const insets = useSafeAreaInsets();
  const { mealType } = route.params;

  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;
  const addMeal = useNutritionStore((s) => s.addMeal);

  const [permission, setPermission] = useState<PermissionStatus>('pending');
  const [supported] = useState(() => {
    try {
      return ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      return false;
    }
  });
  const [recording, setRecording] = useState(false);
  const [finished, setFinished] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pulse = useSharedValue(1);

  useEffect(() => {
    ExpoSpeechRecognitionModule.requestPermissionsAsync()
      .then((res) => setPermission(res.granted ? 'granted' : 'denied'))
      .catch(() => setPermission('denied'));
  }, []);

  useEffect(() => {
    if (recording) {
      pulse.value = withRepeat(
        withSequence(withTiming(1.15, { duration: 550 }), withTiming(1, { duration: 550 })),
        -1
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [recording, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    if (text) setTranscript(text);
  });

  useSpeechRecognitionEvent('end', () => {
    setRecording(false);
    setFinished(true);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setRecording(false);
    if (event.error === 'aborted') return;
    if (event.error === 'not-allowed') {
      setPermission('denied');
      return;
    }
    setError(
      event.error === 'no-speech' || event.error === 'speech-timeout'
        ? 'No escuchamos nada. Probá de nuevo más cerca del micrófono.'
        : 'No pudimos procesar el audio. Intentá de nuevo.'
    );
  });

  const startRecording = () => {
    setError(null);
    setFinished(false);
    setTranscript('');
    setRecording(true);
    ExpoSpeechRecognitionModule.start({ lang: 'es-AR', interimResults: true });
  };

  const stopRecording = () => {
    ExpoSpeechRecognitionModule.stop();
  };

  const detectedKcal = extractKcal(transcript);

  const handleSave = async (editAfter: boolean) => {
    if (!userId) return;
    const title = transcript.trim().slice(0, 80) || 'Comida por voz';
    setSaving(true);
    const ok = await addMeal(userId, {
      mealType,
      title,
      macroSource: 'voice',
      portionGrams: null,
      kcal: detectedKcal,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
    setSaving(false);
    if (!ok) {
      useUiStore.getState().showToast('error', 'No pudimos registrar la comida.');
      return;
    }
    hapticSuccess();
    if (editAfter) {
      const lastMeal = useNutritionStore.getState().meals.at(-1);
      if (lastMeal) {
        navigation.replace('FoodDetail', { mealType, mealLogId: lastMeal.id });
        return;
      }
    }
    useUiStore.getState().showToast('success', 'Comida registrada');
    navigation.goBack();
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
          paddingHorizontal: layout.screenPadding,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <AppText variant="h2" color={colors.text.primary}>
            Registro por voz
          </AppText>
          <IconButton icon="close" onPress={() => navigation.goBack()} accessibilityLabel="Cerrar" />
        </View>

        {permission === 'pending' ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary.default} />
            <AppText variant="body14" color={colors.text.secondary} style={styles.centerText}>
              Solicitando acceso al micrófono…
            </AppText>
          </View>
        ) : !supported ? (
          <ErrorState message="Tu dispositivo no soporta reconocimiento de voz. Cargá la comida de forma manual." />
        ) : permission === 'denied' ? (
          <ErrorState
            message="Necesitamos acceso al micrófono para registrar comidas por voz. Habilitalo y volvé a intentar."
            onRetry={() => {
              setPermission('pending');
              ExpoSpeechRecognitionModule.requestPermissionsAsync()
                .then((res) => setPermission(res.granted ? 'granted' : 'denied'))
                .catch(() => setPermission('denied'));
            }}
          />
        ) : (
          <>
            <Image source={illustrations.pillarHeader.nutrition} style={styles.mascot} contentFit="contain" />
            <AppText variant="body14" color={colors.text.secondary} align="center" style={styles.instruction}>
              {recording
                ? 'Escuchando… contanos qué comiste'
                : finished
                  ? 'Revisá el texto y confirmá el registro'
                  : 'Tocá el micrófono y dictá tu comida, por ejemplo: "milanesa con puré, 600 calorías"'}
            </AppText>

            <View style={styles.micArea}>
              <Animated.View style={[styles.micPulse, recording && styles.micPulseActive, pulseStyle]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={recording ? 'Detener grabación' : 'Empezar a grabar'}
                  onPress={recording ? stopRecording : startRecording}
                  style={({ pressed }) => [styles.micButton, recording && styles.micButtonActive, pressed && styles.pressed]}
                >
                  <Ionicons
                    name={recording ? 'stop' : 'mic-outline'}
                    size={36}
                    color={recording ? colors.primary.onText : colors.primary.default}
                  />
                </Pressable>
              </Animated.View>
            </View>

            {error ? (
              <AppText variant="body13" color={colors.states.error} align="center" style={styles.errorText}>
                {error}
              </AppText>
            ) : null}

            {recording && transcript ? (
              <AppText variant="body16Medium" color={colors.text.primary} align="center" style={styles.liveTranscript}>
                “{transcript}”
              </AppText>
            ) : null}

            {finished ? (
              <>
                <Input
                  label="Lo que dictaste"
                  value={transcript}
                  onChangeText={setTranscript}
                  multiline
                  placeholder="Ej: milanesa con puré, 600 calorías"
                  containerStyle={styles.transcriptInput}
                />
                <AppText variant="body12" color={colors.text.tertiary} style={styles.kcalHint}>
                  {detectedKcal > 0
                    ? `Detectamos ${detectedKcal} kcal en tu dictado.`
                    : 'No detectamos calorías; se registrará con 0 kcal (podés editarlo después).'}
                </AppText>
                <Button
                  label="Continuar"
                  onPress={() => void handleSave(false)}
                  loading={saving}
                  fullWidth
                  style={styles.cta}
                />
                <Button
                  label="Editar detalles"
                  variant="secondary"
                  onPress={() => void handleSave(true)}
                  disabled={saving}
                  fullWidth
                  style={styles.secondaryCta}
                />
                <Button
                  label="Volver a grabar"
                  variant="ghost"
                  size="md"
                  onPress={startRecording}
                  disabled={saving}
                  fullWidth
                  style={styles.secondaryCta}
                />
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  center: { alignItems: 'center', paddingVertical: spacing.xxxl },
  centerText: { marginTop: spacing.md },
  mascot: { width: 96, height: 116, alignSelf: 'center' },
  instruction: { marginTop: spacing.md, maxWidth: 300, alignSelf: 'center' },
  micArea: { alignItems: 'center', marginTop: spacing.xxl },
  micPulse: { borderRadius: radius.pill },
  micPulseActive: { ...shadows.glow },
  micButton: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.surface.elevated,
    borderWidth: 1,
    borderColor: colors.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonActive: {
    backgroundColor: colors.primary.default,
    borderColor: colors.primary.default,
  },
  pressed: { opacity: 0.85 },
  errorText: { marginTop: spacing.lg },
  liveTranscript: { marginTop: spacing.xl },
  transcriptInput: { marginTop: spacing.xl },
  kcalHint: { marginTop: spacing.xs },
  cta: { marginTop: spacing.xl },
  secondaryCta: { marginTop: spacing.sm },
});
