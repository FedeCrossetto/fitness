import { Audio, type AVPlaybackSource } from 'expo-av';

const WATER_SOUND = require('../../assets/sounds/water.wav') as AVPlaybackSource;

let audioReady = false;

async function ensureAudio(): Promise<void> {
  if (audioReady) return;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
  }).catch(() => undefined);
  audioReady = true;
}

async function createAndPlay(opts: {
  rate: number;
  volume: number;
  shouldCorrectPitch?: boolean;
}): Promise<void> {
  const { sound } = await Audio.Sound.createAsync(WATER_SOUND, {
    volume: opts.volume,
    rate: opts.rate,
    shouldCorrectPitch: opts.shouldCorrectPitch ?? false,
  });
  await sound.playAsync();
  // Liberar cuando termina
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      void sound.unloadAsync();
    }
  });
}

/**
 * Sonido al registrar agua.
 *
 * - `add`: gota corta tipo "plop" en vaso.
 * - `remove`: la misma muestra más grave y suave.
 */
export async function playWaterSound(variant: 'add' | 'remove' = 'add'): Promise<void> {
  try {
    await ensureAudio();

    if (variant === 'remove') {
      await createAndPlay({ rate: 0.72, volume: 0.4, shouldCorrectPitch: false });
      return;
    }

    await createAndPlay({ rate: 1, volume: 0.65, shouldCorrectPitch: false });
  } catch {
    // Sin audio en simulador o permisos denegados — no bloquear la acción.
  }
}
