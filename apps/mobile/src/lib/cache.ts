import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Caché local stale-while-revalidate para datos del día.
 * `readCache` devuelve el valor cacheado al instante (stale) mientras el caller revalida contra Supabase.
 */

interface CacheEnvelope<T> {
  value: T;
  cachedAt: number;
}

const PREFIX = 'reset-fitness:cache:';

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    return envelope.value;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    const envelope: CacheEnvelope<T> = { value, cachedAt: Date.now() };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // El caché es best-effort: si falla, la app sigue funcionando online.
  }
}

export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX)));
  } catch {
    // best-effort
  }
}

/**
 * Patrón SWR: devuelve primero el caché (si existe) vía onData, luego el dato fresco.
 * Si la red falla y hay caché, no propaga el error.
 */
export async function staleWhileRevalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  onData: (data: T, fromCache: boolean) => void
): Promise<void> {
  const cached = await readCache<T>(key);
  if (cached !== null) onData(cached, true);
  try {
    const fresh = await fetcher();
    onData(fresh, false);
    await writeCache(key, fresh);
  } catch (error) {
    if (cached === null) throw error;
  }
}
