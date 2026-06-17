import { createHabitoClient } from '@habito/shared/supabase/client';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copiá .env.example a .env.local.');
}

export const supabase = createHabitoClient({
  url,
  anonKey,
  detectSessionInUrl: true,
  flowType: 'pkce',
});
