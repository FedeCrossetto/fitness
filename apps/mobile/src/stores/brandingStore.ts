import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { TrainerBrandingRow } from '../types/database';

interface BrandingState {
  branding: TrainerBrandingRow | null;
  loaded: boolean;
  /** Carga la marca del entrenador del usuario actual. RLS filtra: el cliente
   * solo puede leer la fila de SU entrenador; el entrenador lee la propia. */
  load: () => Promise<void>;
  clear: () => void;
}

export const useBrandingStore = create<BrandingState>((set) => ({
  branding: null,
  loaded: false,
  load: async () => {
    const { data } = await supabase.from('trainer_branding').select('*').maybeSingle();
    set({ branding: (data as TrainerBrandingRow | null) ?? null, loaded: true });
  },
  clear: () => set({ branding: null, loaded: false }),
}));
