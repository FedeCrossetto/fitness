import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import type { Database } from '../types/database';

const isWeb = Platform.OS === 'web';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Reset Fit] Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Configurá tu archivo .env.'
  );
}

/** Adapter de SecureStore para persistir la sesión de Supabase de forma segura (iOS/Android). */
const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key);
  },
};

/**
 * En web no existe SecureStore (Keychain/Keystore son nativos): usamos localStorage.
 * Es solo para desarrollo en navegador; en el dispositivo se mantiene SecureStore.
 */
const webStorageAdapter = {
  getItem: (key: string) =>
    Promise.resolve(typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null),
  setItem: (key: string, value: string) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    return Promise.resolve();
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isWeb ? webStorageAdapter : secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
    flowType: 'pkce',
  },
});

// Refrescar token solo con la app activa (recomendación oficial de Supabase para RN)
if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}

/**
 * Acceso sin tipar a tablas que todavía no están en el `Database` generado
 * (ej. waiver_signatures, image_consent_acceptances, evaluation_requests).
 * Única fuente de este cast — antes se repetía idéntico en cada archivo que
 * lo necesitaba.
 */
export const anyClient = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };
