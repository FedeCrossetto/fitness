import { Pedometer } from 'expo-sensors';

/** Lee los pasos del día desde el podómetro del dispositivo. Devuelve null si no está disponible. */
export async function getTodaySteps(): Promise<number | null> {
  try {
    const available = await Pedometer.isAvailableAsync();
    if (!available) return null;

    const { status } = await Pedometer.requestPermissionsAsync();
    if (status !== 'granted') return null;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const result = await Pedometer.getStepCountAsync(start, new Date());
    return result.steps;
  } catch {
    return null;
  }
}
