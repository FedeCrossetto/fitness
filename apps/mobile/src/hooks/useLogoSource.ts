import { useEffect, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBrandingStore } from '../stores/brandingStore';
import { brandAssets } from '../theme/brand';

const LOGO_CACHE_KEY = 'branding_logo_url';

/**
 * Devuelve el logo del entrenador:
 * 1. logo_url del store (sesión activa)
 * 2. logo_url cacheado en AsyncStorage (pre-login / después de logout)
 * 3. asset local como fallback final
 */
export function useLogoSource(): ImageSourcePropType | { uri: string } {
  const storeLogoUrl = useBrandingStore((s) => s.branding?.logo_url);
  const [cachedUrl, setCachedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (storeLogoUrl) return; // el store ya tiene el dato, no necesitamos caché
    AsyncStorage.getItem(LOGO_CACHE_KEY)
      .then((val) => setCachedUrl(val))
      .catch(() => setCachedUrl(null));
  }, [storeLogoUrl]);

  const logoUrl = storeLogoUrl ?? cachedUrl;
  if (logoUrl) return { uri: logoUrl };
  return brandAssets.logo;
}
