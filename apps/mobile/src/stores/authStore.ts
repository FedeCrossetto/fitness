import { create } from 'zustand';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { clearCache, invalidateCache } from '../lib/cache';
import { useBrandingStore } from './brandingStore';
import { useProgressStore } from './progressStore';
import { resetAllStores } from './resetAllStores';
import {
  applyPendingInviteLink,
  clearPendingInviteCode,
  linkClientByInviteCode,
  readPendingInviteCode,
  savePendingInviteCode,
} from '../services/invite';
import {
  clearSubscriptionAccessCache,
  resolveSubscriptionAccess,
  syncClientActivationIfPaid,
} from '../services/payments';
import { INVITE_REQUIRED_MESSAGE } from '../services/clientAccess';
import { completeOAuthFromUrl, getOAuthRedirectUri, getOAuthReturnUri } from '../lib/oauthRedirect';
import type { ProfileRow, UserProfileRow } from '../types/database';
import { todayISO } from '../lib/dates';
import type { OnboardingFormData } from '../screens/auth/onboardingTypes';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'apple' | 'google';
export type AuthIntent = 'login' | 'signup';

interface AuthState {
  session: Session | null;
  profile: ProfileRow | null;
  userProfile: UserProfileRow | null;
  initializing: boolean;
  loading: boolean;
  oauthProvider: OAuthProvider | null;
  error: string | null;
  needsOnboarding: boolean;

  checkSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, fullName: string, trainerCode?: string) => Promise<boolean>;
  signInWithOAuth: (provider: OAuthProvider, trainerCode?: string, intent?: AuthIntent) => Promise<boolean>;
  linkTrainer: (code: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  completeOnboarding: (data: OnboardingFormData) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

function messageFor(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes('código') || raw.includes('invitación') || raw.includes('entrenador')) return raw;
  if (raw.includes('Invalid login credentials')) {
    return 'Email o contraseña incorrectos. Si te registraste con Google o Apple, usá esos botones.';
  }
  if (raw.includes('provider is not enabled') || raw.includes('Provider not enabled')) {
    return 'Inicio con Apple todavía no está activado. Usá Google o email.';
  }
  if (raw.includes('Email not confirmed')) {
    return 'Confirmá tu email desde el link que te enviamos antes de iniciar sesión.';
  }
  if (raw.includes('already registered')) return 'Ese email ya está registrado.';
  if (raw.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (raw.toLowerCase().includes('network')) return 'Sin conexión. Revisá tu internet e intentá de nuevo.';
  if (raw.includes('row-level security') || raw.includes('permission denied')) {
    return 'No tenés permiso para guardar estos datos. Contactá a tu entrenador.';
  }
  if (__DEV__) return raw;
  return 'Algo salió mal. Intentá de nuevo.';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyClient = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

async function refreshProgressMeasurements(userId: string): Promise<void> {
  await invalidateCache(`progress:measurements:${userId}`);
  await useProgressStore.getState().loadMeasurements(userId);
}

function buildOnboardingResponses(data: OnboardingFormData): Array<{ label: string; type: string; answer: string | string[] }> {
  const entries: Array<{ label: string; type: string; answer: string | string[] }> = [
    { label: 'Teléfono', type: 'textbox', answer: data.phone },
    { label: 'Sexo', type: 'dropdown', answer: data.gender === 'male' ? 'Masculino' : data.gender === 'female' ? 'Femenino' : '' },
    { label: 'Peso actual (kg)', type: 'textbox', answer: data.weightKg },
    { label: 'Altura (cm)', type: 'textbox', answer: data.heightCm },
    { label: 'Objetivos', type: 'listbox', answer: data.goals },
    { label: 'Nivel de experiencia', type: 'dropdown', answer: data.level ?? '' },
    { label: '¿Hacés ejercicio regularmente?', type: 'dropdown', answer: data.exerciseHabit ?? '' },
    { label: 'Frecuencia semanal', type: 'dropdown', answer: data.weeklyFrequency ?? '' },
    { label: 'Días disponibles para entrenar', type: 'listbox', answer: data.availableDays },
    { label: 'Equipamiento disponible', type: 'listbox', answer: data.equipment },
  ];
  if (data.injuries.trim()) {
    entries.push({ label: 'Lesiones o condiciones', type: 'textarea', answer: data.injuries.trim() });
  }
  if (data.comments.trim()) {
    entries.push({ label: 'Comentarios adicionales', type: 'textarea', answer: data.comments.trim() });
  }
  return entries;
}

async function loadProfiles(userId: string): Promise<{ profile: ProfileRow | null; userProfile: UserProfileRow | null }> {
  const [profileRes, userProfileRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle(),
  ]);
  let profile = profileRes.data ?? null;
  if (profile) {
    profile = await syncClientActivationIfPaid(userId, profile);
    await resolveSubscriptionAccess(userId);
  }
  return {
    profile,
    userProfile: userProfileRes.data ?? null,
  };
}

async function finishAuthSession(session: Session): Promise<{ profile: ProfileRow | null; userProfile: UserProfileRow | null }> {
  await applyPendingInviteLink();
  return loadProfiles(session.user.id);
}

async function commitSession(
  session: Session,
  profile: ProfileRow | null,
  userProfile: UserProfileRow | null,
  needsOnboarding?: boolean,
): Promise<void> {
  setAuthState(session, profile, userProfile, needsOnboarding ?? !profile?.goal);
  await useBrandingStore.getState().load();
}

function setAuthState(
  session: Session,
  profile: ProfileRow | null,
  userProfile: UserProfileRow | null,
  needsOnboarding: boolean,
): void {
  useAuthStore.setState({
    session,
    profile,
    userProfile,
    needsOnboarding,
    loading: false,
    oauthProvider: null,
    initializing: false,
  });
}

let authListenerRegistered = false;

function ensureAuthListener(): void {
  if (authListenerRegistered) return;
  authListenerRegistered = true;

  supabase.auth.onAuthStateChange((event, session) => {
    if (!session) {
      useAuthStore.setState({
        session: null,
        profile: null,
        userProfile: null,
        needsOnboarding: false,
        loading: false,
      });
      useBrandingStore.getState().clear();
      return;
    }

    // Token renovado silenciosamente por Supabase — solo actualizamos la sesión.
    if (event === 'TOKEN_REFRESHED') {
      useAuthStore.setState({ session });
      return;
    }

    const { loading, session: current } = useAuthStore.getState();
    if (loading) return;

    if (current?.user.id === session.user.id) {
      useAuthStore.setState({ session });
      return;
    }

    useAuthStore.setState({ session, profile: null, userProfile: null, loading: true });
    void (async () => {
      try {
        const { profile, userProfile } = await finishAuthSession(session);
        useAuthStore.setState({
          profile,
          userProfile,
          needsOnboarding: !profile?.goal,
          loading: false,
        });
        await useBrandingStore.getState().load();
      } catch {
        useAuthStore.setState({ loading: false });
      }
    })();
  });
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  userProfile: null,
  initializing: true,
  loading: false,
  oauthProvider: null,
  error: null,
  needsOnboarding: false,

  checkSession: async () => {
    ensureAuthListener();
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (session) {
        const { profile, userProfile } = await finishAuthSession(session);
        set({
          session,
          profile,
          userProfile,
          needsOnboarding: !profile?.goal,
          initializing: false,
        });
        await useBrandingStore.getState().load();
      } else {
        set({ session: null, profile: null, userProfile: null, initializing: false });
      }
    } catch {
      set({ initializing: false });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      const { profile, userProfile } = await finishAuthSession(data.session!);
      await commitSession(data.session!, profile, userProfile);
      return true;
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return false;
    }
  },

  signUp: async (email, password, fullName, trainerCode) => {
    set({ loading: true, error: null });
    try {
      const code = trainerCode?.trim();
      if (!code) {
        set({ loading: false, error: INVITE_REQUIRED_MESSAGE });
        return false;
      }
      await savePendingInviteCode(code);
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim(), trainer_code: code },
        },
      });
      if (error) throw error;
      if (!data.session) {
        set({ loading: false, error: 'Revisá tu email para confirmar la cuenta y luego iniciá sesión.' });
        return false;
      }
      const { profile, userProfile } = await finishAuthSession(data.session);
      await commitSession(data.session, profile, userProfile, true);
      return true;
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return false;
    }
  },

  signInWithOAuth: async (provider, trainerCode, intent = 'login') => {
    set({ loading: true, oauthProvider: provider, error: null });
    try {
      const pending = trainerCode?.trim() || (await readPendingInviteCode());
      if (intent === 'signup' && !pending) {
        set({ loading: false, oauthProvider: null, error: INVITE_REQUIRED_MESSAGE });
        return false;
      }
      if (pending) await savePendingInviteCode(pending);

      const redirectTo = getOAuthRedirectUri();
      const returnUri = getOAuthReturnUri();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
        },
      });
      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(data.url, returnUri);
      if (result.type !== 'success') {
        set({ loading: false, oauthProvider: null });
        return false;
      }

      await completeOAuthFromUrl(result.url, provider);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No se pudo iniciar sesión.');

      const { profile, userProfile } = await finishAuthSession(session);
      const isNewSignup = intent === 'signup' || !profile?.goal;
      await commitSession(session, profile, userProfile, isNewSignup);
      return true;
    } catch (error) {
      set({ loading: false, oauthProvider: null, error: messageFor(error) });
      return false;
    }
  },

  linkTrainer: async (code) => {
    set({ loading: true, error: null });
    try {
      const { session } = get();
      if (!session) throw new Error('Sesión expirada. Volvé a iniciar sesión.');

      const clean = code.trim();
      if (clean.length < 3) {
        set({ loading: false, error: INVITE_REQUIRED_MESSAGE });
        return false;
      }

      await savePendingInviteCode(clean);
      const link = await linkClientByInviteCode(clean);
      if (!link.ok) {
        set({ loading: false, error: link.message });
        return false;
      }

      await clearPendingInviteCode();
      const { profile, userProfile } = await loadProfiles(session.user.id);
      set({ profile, userProfile, loading: false, error: null });
      await useBrandingStore.getState().load();
      return true;
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return false;
    }
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      const redirectTo = getOAuthRedirectUri();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      set({ loading: false });
      return true;
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return false;
    }
  },

  completeOnboarding: async (data) => {
    const { session, profile } = get();
    if (!session) return false;
    set({ loading: true, error: null });
    try {
      const userId = session.user.id;
      const goal = data.goals.join(', ');
      const level = data.level ?? 'Principiante';
      const weight = Number.parseFloat(data.weightKg.replace(',', '.'));
      const responses = buildOnboardingResponses(data);

      const { error: rpcError } = await supabase.rpc('save_client_onboarding_intake', {
        p_phone: data.phone.trim(),
        p_goal: goal,
        p_level: level,
        p_gender: data.gender,
        p_weight_kg: Number.isFinite(weight) && weight > 0 ? weight : null,
        p_responses: responses,
      });

      if (rpcError) {
        const missingRpc =
          rpcError.code === 'PGRST202'
          || rpcError.message.includes('Could not find the function')
          || rpcError.message.includes('save_client_onboarding_intake');

        if (!missingRpc) throw rpcError;

        if (__DEV__) console.warn('[onboarding] RPC unavailable, using direct writes:', rpcError.message);

        const [profileRes, userProfileRes] = await Promise.all([
          supabase
            .from('profiles')
            .update({ goal, phone: data.phone.trim() || null })
            .eq('id', userId)
            .select()
            .single(),
          supabase.from('user_profiles').update({ level }).eq('user_id', userId).select().single(),
        ]);
        if (profileRes.error) throw profileRes.error;
        if (userProfileRes.error) throw userProfileRes.error;

        if (data.gender && Number.isFinite(weight) && weight > 0) {
          const { error: measureError } = await supabase.from('body_measurements').upsert(
            {
              user_id: userId,
              date: todayISO(),
              gender: data.gender,
              weight_kg: weight,
            },
            { onConflict: 'user_id,date' },
          );
          if (measureError) throw measureError;
        }

        const trainerId = profileRes.data.trainer_id ?? profile?.trainer_id;
        if (trainerId) {
          const { error: intakeError } = await anyClient.from('consultation_responses').upsert(
            {
              client_id: userId,
              trainer_id: trainerId,
              responses,
              submitted_at: new Date().toISOString(),
            },
            { onConflict: 'client_id,trainer_id' },
          );
          if (intakeError) throw intakeError;
        }

        set({
          profile: profileRes.data,
          userProfile: userProfileRes.data,
          needsOnboarding: false,
          loading: false,
        });
        await refreshProgressMeasurements(userId);
        return true;
      }

      const { profile: nextProfile, userProfile: nextUserProfile } = await loadProfiles(userId);
      set({
        profile: nextProfile,
        userProfile: nextUserProfile,
        needsOnboarding: false,
        loading: false,
      });
      await refreshProgressMeasurements(userId);
      return true;
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return false;
    }
  },

  refreshProfile: async () => {
    const { session } = get();
    if (!session) return;
    try {
      const { profile, userProfile } = await loadProfiles(session.user.id);
      set({ profile, userProfile });
      await useBrandingStore.getState().load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Si el JWT expiró, intentamos refrescarlo en lugar de quedar en loop.
      if (msg.includes('JWT') || msg.includes('token')) {
        const { data } = await supabase.auth.refreshSession();
        if (data.session) {
          const { profile, userProfile } = await loadProfiles(data.session.user.id);
          set({ session: data.session, profile, userProfile });
        }
      }
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      resetAllStores();
      await supabase.auth.signOut();
      await clearCache();
      await clearPendingInviteCode();
      clearSubscriptionAccessCache();
      useBrandingStore.getState().clear();
    } finally {
      set({
        session: null,
        profile: null,
        userProfile: null,
        needsOnboarding: false,
        loading: false,
        error: null,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
