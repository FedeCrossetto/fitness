import { AppState } from 'react-native';
import { create } from 'zustand';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import { clearCache, invalidateCache } from '../lib/cache';
import { useBrandingStore } from './brandingStore';
import { useProgressStore } from './progressStore';
import { resetAllStores } from './resetAllStores';
import { clearStoredProfile, saveStoredProfile } from '../hooks/useStoredProfile';
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
import { mirrorOAuthAvatar } from '@reset-fitness/shared/auth/mirrorOAuthAvatar';
import { todayISO } from '../lib/dates';
import type { OnboardingFormData } from '../screens/auth/onboardingTypes';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'apple' | 'google';
export type AuthIntent = 'login' | 'signup';
/** Resultado de signUp: sesión inmediata, requiere verificar email, o error. */
export type SignUpOutcome = 'session' | 'verify' | 'error';

interface AuthState {
  session: Session | null;
  profile: ProfileRow | null;
  userProfile: UserProfileRow | null;
  initializing: boolean;
  loading: boolean;
  oauthProvider: OAuthProvider | null;
  error: string | null;
  needsOnboarding: boolean;
  needsPasswordReset: boolean;
  /** Se incrementa manualmente para forzarle a RootNavigator a re-evaluar el
   * gate de "esperando evaluación de mentoría" sin depender de un cambio de
   * `profile` (sigue en client_status='pending' hasta que el entrenador activa
   * la cuenta) — ver bumpEvaluationGate(). */
  evaluationGateVersion: number;

  checkSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, fullName: string, trainerCode?: string) => Promise<SignUpOutcome>;
  verifyEmailOtp: (email: string, token: string, password?: string) => Promise<boolean>;
  resendEmailOtp: (email: string) => Promise<boolean>;
  signInWithOAuth: (provider: OAuthProvider, trainerCode?: string, intent?: AuthIntent) => Promise<boolean>;
  linkTrainer: (code: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  updatePassword: (newPassword: string) => Promise<boolean>;
  completeOnboarding: (data: OnboardingFormData) => Promise<boolean>;
  refreshProfile: () => Promise<void>;
  signOut: (forced?: boolean) => Promise<void>;
  clearError: () => void;
  forcedSignOut: boolean;
  bumpEvaluationGate: () => void;
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
  if (raw.includes('Token has expired') || raw.includes('otp_expired') || raw.includes('expired or is invalid')) {
    return 'El código es incorrecto o expiró. Pedí uno nuevo.';
  }
  if (raw.includes('Invalid token') || raw.includes('otp_disabled') || raw.includes('Token not found')) {
    return 'El código ingresado no es válido. Revisalo e intentá de nuevo.';
  }
  if (raw.includes('For security purposes') || raw.includes('rate limit') || raw.includes('after')) {
    return 'Esperá unos segundos antes de pedir otro código.';
  }
  if (raw.toLowerCase().includes('network')) return 'Sin conexión. Revisá tu internet e intentá de nuevo.';
  if (raw.includes('row-level security') || raw.includes('permission denied')) {
    return 'No tenés permiso para guardar estos datos. Contactá a tu entrenador.';
  }
  if (__DEV__) return raw;
  return 'Algo salió mal. Intentá de nuevo.';
}

const anyClient = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

async function refreshProgressMeasurements(userId: string): Promise<void> {
  await invalidateCache(`progress:measurements:${userId}`);
  await useProgressStore.getState().loadMeasurements(userId);
}

function genderLabel(data: OnboardingFormData): string {
  if (data.gender === 'male') return 'Masculino';
  if (data.gender === 'female') return 'Femenino';
  if (data.gender === 'other') return data.genderOther.trim() ? `Otro: ${data.genderOther.trim()}` : 'Otro';
  return '';
}

function buildOnboardingResponses(data: OnboardingFormData): { label: string; type: string; answer: string | string[] }[] {
  const fullPhone = `${data.phoneCode} ${data.phone}`.trim();
  const fullAddress = [
    [data.street.trim(), data.streetNumber.trim()].filter(Boolean).join(' '),
    data.apartment.trim(),
  ].filter(Boolean).join(', ');
  const sharedBody = !data.shareBodyLater;
  const entries: { label: string; type: string; answer: string | string[] }[] = [
    { label: 'País', type: 'textbox', answer: data.country.trim() },
    { label: 'Ciudad', type: 'textbox', answer: data.city.trim() },
    { label: 'Código postal', type: 'textbox', answer: data.postalCode.trim() },
    { label: 'Dirección', type: 'textbox', answer: fullAddress },
    { label: 'Fecha de nacimiento', type: 'textbox', answer: data.birthDate.trim() },
    { label: 'Teléfono', type: 'textbox', answer: fullPhone },
    { label: 'Sexo', type: 'dropdown', answer: genderLabel(data) },
    { label: 'Peso actual (kg)', type: 'textbox', answer: sharedBody ? data.weightKg : 'A definir con el coach' },
    { label: 'Altura (cm)', type: 'textbox', answer: sharedBody ? data.heightCm : 'A definir con el coach' },
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
  const result = await loadProfiles(session.user.id);

  const mirroredUrl = await mirrorOAuthAvatar(supabase, session.user.id, {
    stored: result.profile?.avatar_url,
    userMetadata: session.user.user_metadata as Record<string, unknown> | undefined,
  });
  if (mirroredUrl && mirroredUrl !== result.profile?.avatar_url && result.profile) {
    result.profile = { ...result.profile, avatar_url: mirroredUrl };
  }

  return result;
}

const ONBOARDING_DONE_PREFIX = 'onboarding_completed_';

/**
 * Flag explícito "completó la encuesta de onboarding" (por usuario).
 * El flag es la única fuente de verdad: si está en falso, se re-pide la encuesta
 * desde el primer paso (aunque la cuenta tenga datos de una encuesta anterior).
 */
async function readOnboardingDone(userId: string, _profile: ProfileRow | null): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(ONBOARDING_DONE_PREFIX + userId);
    return stored === 'true';
  } catch {
    return false;
  }
}

async function markOnboardingDone(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_DONE_PREFIX + userId, 'true');
  } catch {
    // ignore
  }
}

// Fuente única de verdad para el perfil de EasyLogin. Se llama en cada punto donde
// `profile` puede quedar con datos definitivos (login, signup, onboarding, refresh),
// porque `finishAuthSession` puede devolver full_name vacío/null en el primer signup
// (el trigger que crea la fila en `profiles` puede no haber terminado todavía) y ese
// hueco nunca se cerraba: al cerrar sesión después, `storedProfile` seguía null y no
// se mostraba EasyLogin.
function syncStoredProfile(session: Session, profile: ProfileRow | null): void {
  if (!profile?.full_name) return;
  void saveStoredProfile({
    fullName: profile.full_name,
    email: session.user.email ?? '',
    avatarUrl: profile.avatar_url ?? null,
  });
}

async function commitSession(
  session: Session,
  profile: ProfileRow | null,
  userProfile: UserProfileRow | null,
  needsOnboarding?: boolean,
): Promise<void> {
  const resolvedNeedsOnboarding = needsOnboarding ?? !(await readOnboardingDone(session.user.id, profile));
  setAuthState(session, profile, userProfile, resolvedNeedsOnboarding);
  void AsyncStorage.setItem('onboarding_marketing_shown', 'true');
  syncStoredProfile(session, profile);
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
    forcedSignOut: false,
  });
  // Persist profile for easy login — covers all auth paths (login, session restore, OAuth).
  // Pasa por el store reactivo (no AsyncStorage directo) para que RootNavigator/EasyLogin
  // se enteren del cambio sin depender de un reload manual del hook useStoredProfile.
  void saveStoredProfile({
    fullName: profile?.full_name ?? session.user.email?.split('@')[0] ?? '',
    email:    session.user.email ?? '',
    avatarUrl: profile?.avatar_url ?? null,
  });
  // If provider is OAuth (Google, Apple, etc.), update easy_login_credentials so EasyLogin
  // knows to re-authenticate via OAuth instead of email/password.
  const provider = session.user.app_metadata?.provider ?? 'email';
  if (provider !== 'email') {
    void SecureStore.setItemAsync('easy_login_credentials', JSON.stringify({ method: provider }));
  }
}

async function clearEasyLoginData(): Promise<void> {
  await Promise.all([
    clearStoredProfile(), // limpia AsyncStorage + actualiza el store global reactivamente
    SecureStore.deleteItemAsync('easy_login_credentials').catch(() => {}),
  ]);
}

let authListenerRegistered = false;
let profileChannel: ReturnType<typeof supabase.channel> | null = null;
let voluntarySignOut = false; // true cuando el usuario cierra sesión a propósito

function subscribeProfileDeletion(userId: string): void {
  profileChannel?.unsubscribe();
  profileChannel = supabase
    .channel(`profile-del:${userId}`)
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
      () => { void useAuthStore.getState().signOut(true); },
    )
    .subscribe();
}

function unsubscribeProfileDeletion(): void {
  profileChannel?.unsubscribe();
  profileChannel = null;
}

function ensureAuthListener(): void {
  if (authListenerRegistered) return;
  authListenerRegistered = true;

  AppState.addEventListener('change', (nextState) => {
    if (nextState !== 'active') return;
    const { session } = useAuthStore.getState();
    if (session) void useAuthStore.getState().refreshProfile();
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (!session) {
      // voluntarySignOut=true → el usuario cerró sesión a propósito (perfil guardado para EasyLogin).
      // voluntarySignOut=false + wasSignedIn → logout externo (token inválido, cuenta eliminada).
      const wasSignedIn = useAuthStore.getState().session !== null;
      const isForced = wasSignedIn && !voluntarySignOut;
      voluntarySignOut = false; // reset para el próximo ciclo
      unsubscribeProfileDeletion();
      useAuthStore.setState({
        session: null,
        profile: null,
        userProfile: null,
        needsOnboarding: false,
        loading: false,
        forcedSignOut: isForced,
      });
      if (isForced) void clearEasyLoginData();
      useBrandingStore.getState().clear();
      return;
    }
    subscribeProfileDeletion(session.user.id);

    // Token renovado silenciosamente por Supabase — solo actualizamos la sesión.
    if (event === 'TOKEN_REFRESHED') {
      useAuthStore.setState({ session });
      return;
    }

    // El usuario abrió el link de recuperación de contraseña.
    if (event === 'PASSWORD_RECOVERY') {
      useAuthStore.setState({ session, needsPasswordReset: true });
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
        const onboardingDone = await readOnboardingDone(session.user.id, profile);
        setAuthState(session, profile, userProfile, !onboardingDone);
        syncStoredProfile(session, profile);
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
  needsPasswordReset: false,
  forcedSignOut: false,
  evaluationGateVersion: 0,

  bumpEvaluationGate: () => set((s) => ({ evaluationGateVersion: s.evaluationGateVersion + 1 })),

  checkSession: async () => {
    ensureAuthListener();
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (session) {
        const { profile, userProfile } = await finishAuthSession(session);
        if (!profile) {
          await clearEasyLoginData();
          await supabase.auth.signOut();
          set({ session: null, profile: null, userProfile: null, needsOnboarding: false, initializing: false, forcedSignOut: true });
          return;
        }
        const onboardingDone = await readOnboardingDone(session.user.id, profile);
        set({
          session,
          profile,
          userProfile,
          needsOnboarding: !onboardingDone,
          initializing: false,
        });
        syncStoredProfile(session, profile);
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
      void SecureStore.setItemAsync('easy_login_credentials', JSON.stringify({ email: email.trim(), password }));
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
        return 'error';
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
      // Sin sesión = Supabase requiere confirmar el email con un código (OTP).
      if (!data.session) {
        set({ loading: false });
        return 'verify';
      }
      const { profile, userProfile } = await finishAuthSession(data.session);
      await commitSession(data.session, profile, userProfile, true);
      return 'session';
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return 'error';
    }
  },

  verifyEmailOtp: async (email, token, password) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: token.trim(),
        type: 'signup',
      });
      if (error) throw error;
      if (!data.session) throw new Error('No se pudo confirmar la cuenta.');
      const { profile, userProfile } = await finishAuthSession(data.session);
      await commitSession(data.session, profile, userProfile, true);
      if (password) {
        void SecureStore.setItemAsync('easy_login_credentials', JSON.stringify({ email: email.trim(), password }));
      }
      return true;
    } catch (error) {
      set({ loading: false, error: messageFor(error) });
      return false;
    }
  },

  resendEmailOtp: async (email) => {
    set({ error: null });
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
      if (error) throw error;
      return true;
    } catch (error) {
      set({ error: messageFor(error) });
      return false;
    }
  },

  signInWithOAuth: async (provider, trainerCode, intent = 'login') => {
    set({ loading: true, oauthProvider: provider, error: null });
    try {
      const pending = trainerCode?.trim() || (await readPendingInviteCode()) || 'RESETINV';
      await savePendingInviteCode(pending);

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

  updatePassword: async (newPassword) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      set({ needsPasswordReset: false });
      return true;
    } catch (err) {
      if (__DEV__) console.warn('[updatePassword]', err);
      return false;
    }
  },

  resetPassword: async (email) => {
    try {
      const redirectTo = getOAuthRedirectUri();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (error) throw error;
      return true;
    } catch {
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
      const fullPhone = `${data.phoneCode} ${data.phone}`.trim();
      const weight = data.shareBodyLater ? NaN : Number.parseFloat(data.weightKg.replace(',', '.'));
      // Columnas de sexo biológico solo aceptan male/female; "other" se guarda en responses.
      const dbGender = data.gender === 'male' || data.gender === 'female' ? data.gender : null;
      const responses = buildOnboardingResponses(data);

      const { error: rpcError } = await supabase.rpc('save_client_onboarding_intake', {
        p_phone: fullPhone,
        p_goal: goal,
        p_level: level,
        p_gender: dbGender,
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
            .update({ goal, phone: fullPhone || null })
            .eq('id', userId)
            .select()
            .single(),
          supabase.from('user_profiles').update({ level }).eq('user_id', userId).select().single(),
        ]);
        if (profileRes.error) throw profileRes.error;
        if (userProfileRes.error) throw userProfileRes.error;

        if (dbGender && Number.isFinite(weight) && weight > 0) {
          const { error: measureError } = await supabase.from('body_measurements').upsert(
            {
              user_id: userId,
              date: todayISO(),
              gender: dbGender,
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

        await markOnboardingDone(userId);
        set({
          profile: profileRes.data,
          userProfile: userProfileRes.data,
          needsOnboarding: false,
          loading: false,
        });
        syncStoredProfile(session, profileRes.data);
        await refreshProgressMeasurements(userId);
        return true;
      }

      await markOnboardingDone(userId);
      const { profile: nextProfile, userProfile: nextUserProfile } = await loadProfiles(userId);
      set({
        profile: nextProfile,
        userProfile: nextUserProfile,
        needsOnboarding: false,
        loading: false,
      });
      syncStoredProfile(session, nextProfile);
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
      if (!profile) {
        // Cuenta eliminada mientras la app estaba activa. Easy login primero,
        // luego signOut para que el navigator no lea el perfil viejo.
        await clearEasyLoginData();
        await supabase.auth.signOut();
        return; // onAuthStateChange limpia el estado
      }
      set({ profile, userProfile });
      syncStoredProfile(session, profile);
      await useBrandingStore.getState().load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Si el JWT expiró, intentamos refrescarlo en lugar de quedar en loop.
      if (msg.includes('JWT') || msg.includes('token')) {
        const { data } = await supabase.auth.refreshSession();
        if (data.session) {
          const { profile, userProfile } = await loadProfiles(data.session.user.id);
          set({ session: data.session, profile, userProfile });
          syncStoredProfile(data.session, profile);
        }
      }
    }
  },

  signOut: async (forced = false) => {
    set({ loading: true });
    try {
      if (forced) await clearEasyLoginData();
      unsubscribeProfileDeletion();
      resetAllStores();
      if (forced) {
        useAuthStore.setState({ forcedSignOut: true });
      } else {
        voluntarySignOut = true; // indica a onAuthStateChange que no borre el perfil guardado
      }
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
