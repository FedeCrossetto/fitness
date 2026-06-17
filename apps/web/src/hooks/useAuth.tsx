import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { ProfileRow } from '@habito/shared/types/database';
import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  profile: ProfileRow | null;
  loading: boolean;
  /** Rol del perfil activo ('client' | 'trainer' | 'admin' | null). */
  role: ProfileRow['role'] | null;
  /** true si el usuario puede usar el panel de gestión (trainer o admin). */
  canManage: boolean;
  /** true solo para role === 'admin'. */
  isAdmin: boolean;
  /** true para role === 'trainer' o role === 'admin'. */
  isTrainer: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadProfile = async (uid: string) => {
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (active) setProfile((data as ProfileRow | null) ?? null);
    };

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) void loadProfile(next.user.id);
      else setProfile(null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const role = profile?.role ?? null;
  const isAdmin = role === 'admin';
  const isTrainer = role === 'trainer' || role === 'admin';
  const canManage = isTrainer;

  return (
    <AuthContext.Provider value={{ session, profile, loading, role, canManage, isAdmin, isTrainer, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
