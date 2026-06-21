import { supabase } from '@/lib/supabase';

/** Convierte logo_url de trainer_branding en URL cargable. */
export function resolveBrandingLogoUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl?.trim()) return null;
  const value = logoUrl.trim();
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }
  const path = value.replace(/^avatars\//, '');
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
