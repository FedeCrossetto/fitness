/**
 * Ciudades por país vía CountriesNow (API pública gratuita, sin key).
 * Se trae la lista completa del país UNA vez y se cachea en memoria — el
 * autocomplete filtra localmente mientras el usuario escribe, sin pegarle
 * a la red por cada letra.
 */

const CITIES_ENDPOINT = 'https://countriesnow.space/api/v0.1/countries/cities';
const FETCH_TIMEOUT_MS = 6000;

const cache = new Map<string, string[]>();

interface CitiesResponse {
  error: boolean;
  data?: string[];
}

/** Devuelve las ciudades del país (nombre en inglés, ej. "Argentina") o `null` si la API falla. */
export async function fetchCitiesForCountry(countryNameEn: string): Promise<string[] | null> {
  const key = countryNameEn.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(CITIES_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ country: countryNameEn }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as CitiesResponse;
    if (json.error || !Array.isArray(json.data)) return null;
    const cities = [...json.data].sort((a, b) => a.localeCompare(b, 'es'));
    cache.set(key, cities);
    return cities;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
