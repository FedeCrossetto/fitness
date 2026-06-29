import { useEffect } from 'react';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'easy_login_profile';

export interface StoredProfile {
  fullName: string;
  email: string;
  avatarUrl: string | null;
}

// Fuente única del perfil de "easy login". Al estar en un store global, cuando
// se limpia (logout forzado por cuenta eliminada) TODOS los consumidores
// —RootNavigator y EasyLoginScreen— se re-renderizan de inmediato. Antes cada
// componente cacheaba el valor en su propio useState, por lo que limpiar
// AsyncStorage no actualizaba la UI y se seguía mostrando el easy login.
interface StoredProfileStore {
  profile: StoredProfile | null | undefined; // undefined = aún no cargado
  loaded: boolean;
  load: () => Promise<void>;
  save: (p: StoredProfile) => Promise<void>;
  clear: () => Promise<void>;
}

const useStore = create<StoredProfileStore>((set, get) => ({
  profile: undefined,
  loaded: false,
  load: async () => {
    if (get().loaded) return;
    try {
      const val = await AsyncStorage.getItem(KEY);
      set({ profile: val ? (JSON.parse(val) as StoredProfile) : null, loaded: true });
    } catch {
      set({ profile: null, loaded: true });
    }
  },
  save: async (p) => {
    await AsyncStorage.setItem(KEY, JSON.stringify(p));
    set({ profile: p, loaded: true });
  },
  clear: async () => {
    await AsyncStorage.removeItem(KEY);
    set({ profile: null, loaded: true });
  },
}));

/** Limpia el perfil guardado desde fuera de React (ej. authStore en logout forzado). */
export async function clearStoredProfile(): Promise<void> {
  await useStore.getState().clear();
}

/** Persiste el perfil guardado desde fuera de React (ej. authStore al loguear). */
export async function saveStoredProfile(p: StoredProfile): Promise<void> {
  await useStore.getState().save(p);
}

export function useStoredProfile(): {
  profile: StoredProfile | null | undefined;
  saveProfile: (p: StoredProfile) => Promise<void>;
  clearProfile: () => Promise<void>;
} {
  const profile = useStore((s) => s.profile);
  const load = useStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    profile,
    saveProfile: useStore.getState().save,
    clearProfile: useStore.getState().clear,
  };
}
