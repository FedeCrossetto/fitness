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
 * - `add`: 3 gotas en cascada (volúmenes y rates ligeramente distintos) → simula
 *   agua cayendo y resonando en el vaso mientras sube el nivel.
 * - `remove`: 1 gota más grave y suave → "glu" descendente.
 *
 * Para el timbre más realista posible, reemplazá `assets/sounds/water.wav`
 * por una muestra de "water drop single" (freesound.org). El WAV actual ya
 * se aprovecha mejor con las 3 capas que con una sola reproducción.
 */
export async function playWaterSound(variant: 'add' | 'remove' = 'add'): Promise<void> {
  try {
    await ensureAudio();

    if (variant === 'remove') {
      await createAndPlay({ rate: 0.8, volume: 0.45, shouldCorrectPitch: false });
      return;
    }

    // Tres gotas en cascada: la primera más aguda (vaso vacío), las siguientes
    // más graves y fuertes (el vaso se va llenando, la resonancia baja).
    await createAndPlay({ rate: 1.15, volume: 0.6 });
    await new Promise<void>((r) => setTimeout(r, 110));
    await createAndPlay({ rate: 0.95, volume: 0.75 });
    await new Promise<void>((r) => setTimeout(r, 130));
    await createAndPlay({ rate: 0.8, volume: 0.9 });
  } catch {
    // Sin audio en simulador o permisos denegados — no bloquear la acción.
  }
}
