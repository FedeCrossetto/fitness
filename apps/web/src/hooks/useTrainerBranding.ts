import { useEffect, useState } from 'react';
import { DEFAULT_APP_NAME } from '@reset-fitness/shared';
import { supabase } from '@/lib/supabase';
import { resolveBrandingLogoUrl } from '@/lib/brandingUrl';
import { PLATFORM_FAVICON, PLATFORM_PAGE_TITLE } from '@/lib/platformBrand';
import { useAuth } from '@/hooks/useAuth';

export interface TrainerBranding {
  appName: string;
  logoUrl: string | null;
  loading: boolean;
}

export function useTrainerBranding(): TrainerBranding {
  const { session } = useAuth();
  const trainerId = session?.user.id;
  const [appName, setAppName] = useState(DEFAULT_APP_NAME);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!trainerId);

  useEffect(() => {
    if (!trainerId) {
      setAppName(DEFAULT_APP_NAME);
      setLogoUrl(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void (async () => {
      const { data } = await supabase
        .from('trainer_branding')
        .select('app_name, logo_url')
        .eq('trainer_id', trainerId)
        .maybeSingle();
      if (!active) return;
      setAppName(data?.app_name?.trim() || DEFAULT_APP_NAME);
      setLogoUrl(resolveBrandingLogoUrl(data?.logo_url));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [trainerId]);

  return { appName, logoUrl, loading };
}

/** Actualiza título y favicon con la marca del entrenador logueado. */
export function useBrandingHead(appName: string, logoUrl: string | null, active = true): void {
  useEffect(() => {
    if (!active) return;

    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const prevTitle = document.title;
    const prevHref = link?.getAttribute('href') ?? null;
    const prevType = link?.getAttribute('type') ?? null;

    document.title = `${appName} · Panel del entrenador`;
    if (link && logoUrl) {
      link.href = logoUrl;
      link.type = logoUrl.includes('.png') ? 'image/png' : 'image/x-icon';
    }

    return () => {
      document.title = prevTitle || PLATFORM_PAGE_TITLE;
      if (link) {
        link.href = prevHref ?? PLATFORM_FAVICON;
        if (prevType) link.type = prevType;
        else link.removeAttribute('type');
      }
    };
  }, [appName, logoUrl, active]);
}
