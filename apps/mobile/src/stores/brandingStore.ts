import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { ProfileRow, TrainerBrandingRow } from '../types/database';

interface BrandingState {
  branding: TrainerBrandingRow | null;
  loaded: boolean;
  /** Carga la marca del entrenador vinculado al usuario actual. */
  load: () => Promise<void>;
  clear: () => void;
}

async function resolveBrandingTrainerId(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('trainer_id, role')
    .eq('id', session.user.id)
    .maybeSingle();

  const row = profile as Pick<ProfileRow, 'trainer_id' | 'role'> | null;
  if (!row) return null;

  if (row.role === 'trainer' || row.role === 'admin') return session.user.id;
  return row.trainer_id;
}

export const useBrandingStore = create<BrandingState>((set) => ({
  branding: null,
  loaded: false,
  load: async () => {
    const trainerId = await resolveBrandingTrainerId();
    if (!trainerId) {
      set({ branding: null, loaded: true });
      return;
    }

    const { data } = await supabase
      .from('trainer_branding')
      .select('*')
      .eq('trainer_id', trainerId)
      .maybeSingle();

    set({ branding: (data as TrainerBrandingRow | null) ?? null, loaded: true });
  },
  clear: () => set({ branding: null, loaded: false }),
}));
