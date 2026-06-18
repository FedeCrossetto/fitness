import { createResetFitnessClient } from '@reset-fitness/shared/supabase/client';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env.local.');
}

export const supabase = createResetFitnessClient({
  url,
  anonKey,
  // AuthCallback maneja el intercambio PKCE manualmente (evita doble exchange → falso error).
  detectSessionInUrl: false,
  flowType: 'pkce',
});
