/**
 * Shim de expo-speech-recognition.
 *
 * El paquete hace `requireNativeModule(...)` al importarse, por lo que un import
 * estático explota en Expo Go (no existe el módulo nativo). Acá lo cargamos con
 * require dinámico dentro de try/catch y, si no está disponible, exponemos
 * fallbacks no-op. Así VoiceLogScreen renderiza su estado "no soportado" en vez
 * de tirar abajo toda la app. En una build nativa carga el módulo real.
 */

type SpeechModule = typeof import('expo-speech-recognition');
type SpeechRecognitionModule = SpeechModule['ExpoSpeechRecognitionModule'];
type UseSpeechRecognitionEvent = SpeechModule['useSpeechRecognitionEvent'];

let mod: SpeechModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  mod = require('expo-speech-recognition') as SpeechModule;
} catch {
  mod = null;
}

export const speechRecognitionAvailable = mod !== null;

const fallbackModule = {
  isRecognitionAvailable: () => false,
  requestPermissionsAsync: async () => ({ granted: false }),
  start: () => undefined,
  stop: () => undefined,
} as unknown as SpeechRecognitionModule;

const fallbackUseEvent = (() => undefined) as unknown as UseSpeechRecognitionEvent;

export const ExpoSpeechRecognitionModule: SpeechRecognitionModule =
  mod?.ExpoSpeechRecognitionModule ?? fallbackModule;

export const useSpeechRecognitionEvent: UseSpeechRecognitionEvent =
  mod?.useSpeechRecognitionEvent ?? fallbackUseEvent;
