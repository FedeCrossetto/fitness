import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export type HabitoClient = SupabaseClient<Database>;

export interface CreateClientOptions {
  url: string;
  anonKey: string;
  /**
   * Almacenamiento de sesión. En web se usa `window.localStorage` (default de
   * supabase-js); en mobile se inyecta AsyncStorage/SecureStore.
   */
  storage?: {
    getItem: (key: string) => Promise<string | null> | string | null;
    setItem: (key: string, value: string) => Promise<void> | void;
    removeItem: (key: string) => Promise<void> | void;
  };
  /** Web OAuth callback: parsea tokens de la URL al volver de Google. */
  detectSessionInUrl?: boolean;
  flowType?: 'implicit' | 'pkce';
}

/**
 * Fábrica de cliente Supabase tipada y compartida entre mobile y web.
 * Cada app provee su url/anonKey desde sus propias variables de entorno.
 */
export function createHabitoClient({ url, anonKey, storage, detectSessionInUrl, flowType }: CreateClientOptions): HabitoClient {
  return createClient<Database>(url, anonKey, {
    auth: {
      ...(storage ? { storage } : {}),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: detectSessionInUrl ?? false,
      flowType: flowType ?? 'pkce',
    },
  });
}
