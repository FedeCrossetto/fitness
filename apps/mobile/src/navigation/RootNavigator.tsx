import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme, useThemeHydrated } from '../theme';
import { useAuthStore } from '../stores/authStore';
import { useBrandingStore } from '../stores/brandingStore';
import { useTrainingStore } from '../stores/trainingStore';
import { AuthLoadingOverlay } from '../components/common';
import type { MainTabsParamList } from '../types/navigation';
import { TabBar } from './TabBar';
import { AddMenuOverlay } from './AddMenuOverlay';
import { AuthStack, HomeStack, NutritionStack, ProgressStack, TrainingStack } from './stacks';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { UpdatePasswordScreen } from '../screens/auth/UpdatePasswordScreen';
import { LinkTrainerScreen } from '../screens/auth/LinkTrainerScreen';
import { SubscriptionPlansScreen } from '../screens/auth/SubscriptionPlansScreen';
import { ConsultationFormScreen } from '../screens/consultation/ConsultationFormScreen';
import { WaiverBlockingGate } from '../components/waiver/WaiverBlockingGate';
import { ImageConsentBlockingGate } from '../components/waiver/ImageConsentBlockingGate';
import { useInviteDeepLink } from '../hooks/useInviteDeepLink';
import { useAppActive } from '../hooks/useAppActive';
import { useMarketingSlider } from '../hooks/useMarketingSlider';
import { MarketingSliderScreen } from '../screens/auth/MarketingSliderScreen';
import { useStoredProfile } from '../hooks/useStoredProfile';
import { needsTrainerLink, isPendingActivation } from '../services/clientAccess';
import { clearSubscriptionAccessCache } from '../services/payments';
import { syncPushRegistration } from '../services/notifications';
import { supabase } from '../lib/supabase';
import { useInboxStore } from '../stores/inboxStore';

const anyClient = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

interface ImageConsentCfg {
  title: string;
  body: string;
}

type ImageConsentGateRpc = {
  required?: boolean;
  title?: string;
  body?: string;
};

interface WaiverCfg {
  title: string;
  body: string;
  require_before_start: boolean;
}

type WaiverGateRpc = {
  required?: boolean;
  title?: string;
  body?: string;
  require_before_start?: boolean;
};

const Tabs = createBottomTabNavigator<MainTabsParamList>();

function Placeholder(): null {
  return null;
}

function MainTabs(): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <>
      <Tabs.Navigator
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
        tabBar={(props) => <TabBar {...props} />}
      >
        <Tabs.Screen name="HomeTab" component={HomeStack} />
        <Tabs.Screen name="TrainingTab" component={TrainingStack} />
        <Tabs.Screen name="AddTab" component={Placeholder} />
        <Tabs.Screen name="NutritionTab" component={NutritionStack} />
        <Tabs.Screen name="ProgressTab" component={ProgressStack} />
      </Tabs.Navigator>
      <AddMenuOverlay />
    </>
  );
}

async function resolveWaiverGate(): Promise<{ required: boolean; config: WaiverCfg | null }> {
  const { data, error } = await supabase.rpc('get_client_waiver_gate');

  if (error) {
    if (__DEV__) console.warn('[waiver] get_client_waiver_gate failed:', error.message);
    // Fallback directo por si la migración 0049 aún no está aplicada
    return resolveWaiverGateLegacy();
  }

  const row = data as WaiverGateRpc | null;
  if (!row?.required || !row.body?.trim()) {
    return { required: false, config: null };
  }

  return {
    required: true,
    config: {
      title: row.title ?? 'Deslinde de Responsabilidad',
      body: row.body,
      require_before_start: row.require_before_start ?? true,
    },
  };
}

async function resolveWaiverGateLegacy(): Promise<{ required: boolean; config: WaiverCfg | null }> {
  const { data: profile } = await supabase.from('profiles').select('id, trainer_id, role').maybeSingle();
  if (!profile?.trainer_id || profile.role === 'trainer' || profile.role === 'admin') {
    return { required: false, config: null };
  }

  const { data: cfg, error: cfgError } = await anyClient
    .from('waiver_configs')
    .select('title, body, require_before_start')
    .eq('trainer_id', profile.trainer_id)
    .maybeSingle();

  if (cfgError && __DEV__) console.warn('[waiver] waiver_configs query failed:', cfgError.message);

  const waiverCfg = cfg as WaiverCfg | null;
  if (!waiverCfg?.require_before_start || !waiverCfg.body?.trim()) {
    return { required: false, config: null };
  }

  const { data: sig, error: sigError } = await anyClient
    .from('waiver_signatures')
    .select('id')
    .eq('client_id', profile.id)
    .eq('trainer_id', profile.trainer_id)
    .maybeSingle();

  if (sigError && __DEV__) console.warn('[waiver] waiver_signatures query failed:', sigError.message);
  if (sig) return { required: false, config: null };

  return { required: true, config: waiverCfg };
}

async function resolveImageConsentGate(): Promise<{ required: boolean; config: ImageConsentCfg | null }> {
  const { data, error } = await supabase.rpc('get_client_image_consent_gate');

  if (error) {
    if (__DEV__) console.warn('[image_consent] get_client_image_consent_gate failed:', error.message);
    return resolveImageConsentGateLegacy();
  }

  const row = data as ImageConsentGateRpc | null;
  if (!row?.required || !row.body?.trim()) {
    return { required: false, config: null };
  }

  return {
    required: true,
    config: {
      title: row.title ?? 'Consentimiento de uso de imágenes',
      body: row.body,
    },
  };
}

async function resolveImageConsentGateLegacy(): Promise<{ required: boolean; config: ImageConsentCfg | null }> {
  const { data: profile } = await supabase.from('profiles').select('id, trainer_id, role').maybeSingle();
  if (!profile?.trainer_id || profile.role === 'trainer' || profile.role === 'admin') {
    return { required: false, config: null };
  }

  const { data: cfg, error: cfgError } = await anyClient
    .from('waiver_configs')
    .select('image_consent_enabled, image_consent_title, image_consent_body')
    .eq('trainer_id', profile.trainer_id)
    .maybeSingle();

  if (cfgError && __DEV__) console.warn('[image_consent] waiver_configs query failed:', cfgError.message);

  const consentCfg = cfg as {
    image_consent_enabled?: boolean;
    image_consent_title?: string;
    image_consent_body?: string;
  } | null;

  if (!consentCfg?.image_consent_enabled || !consentCfg.image_consent_body?.trim()) {
    return { required: false, config: null };
  }

  const { data: existing, error: accError } = await anyClient
    .from('image_consent_acceptances')
    .select('id')
    .eq('client_id', profile.id)
    .eq('trainer_id', profile.trainer_id)
    .maybeSingle();

  if (accError && __DEV__) console.warn('[image_consent] acceptances query failed:', accError.message);
  if (existing) return { required: false, config: null };

  return {
    required: true,
    config: {
      title: consentCfg.image_consent_title ?? 'Consentimiento de uso de imágenes',
      body: consentCfg.image_consent_body,
    },
  };
}

/** Decide entre Auth, Onboarding, WaiverGate y App según la sesión de Supabase. */
export function RootNavigator(): React.JSX.Element {
  useInviteDeepLink();

  const themeHydrated        = useThemeHydrated();
  const initializing         = useAuthStore((s) => s.initializing);
  const loading              = useAuthStore((s) => s.loading);
  const session              = useAuthStore((s) => s.session);
  const profile              = useAuthStore((s) => s.profile);
  const needsOnboarding      = useAuthStore((s) => s.needsOnboarding);
  const needsPasswordReset   = useAuthStore((s) => s.needsPasswordReset);
  const forcedSignOut        = useAuthStore((s) => s.forcedSignOut);
  const restoreActiveSession = useTrainingStore((s) => s.restoreActiveSession);

  const [waiverChecked, setWaiverChecked] = useState(false);
  const [waiverRequired, setWaiverRequired] = useState(false);
  const [waiverConfig, setWaiverConfig] = useState<WaiverCfg | null>(null);

  const [imageConsentRequired, setImageConsentRequired] = useState(false);
  const [imageConsentConfig, setImageConsentConfig] = useState<ImageConsentCfg | null>(null);

  const [consultationRequired, setConsultationRequired] = useState(false);
  const [consultationFormCode, setConsultationFormCode] = useState<string | null>(null);

  const { sliderDone, markSliderDone } = useMarketingSlider();
  const { profile: storedProfile } = useStoredProfile();
  const [sliderJustFinished, setSliderJustFinished] = useState(false);

  // Reset el flag cuando el usuario inicia sesión, así el próximo logout muestra EasyLogin
  useEffect(() => {
    if (session) setSliderJustFinished(false);
  }, [session]);

  const handleSliderDone = async () => {
    setSliderJustFinished(true);
    await markSliderDone();
  };

  /** Evita pantalla negra al re-chequear gates (p. ej. refreshProfile al firmar deslinde). */
  const gatesInitializedRef = useRef(false);

  useEffect(() => {
    void restoreActiveSession();
  }, [restoreActiveSession]);

  useEffect(() => {
    if (!session) return;
    void useBrandingStore.getState().load();
  }, [session, profile?.trainer_id, profile?.role]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !profile?.id) return;
    if (needsOnboarding || needsTrainerLink(profile) || isPendingActivation(profile)) return;
    void syncPushRegistration(userId);
  }, [session?.user.id, profile?.id, profile?.trainer_id, profile?.client_status, needsOnboarding]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !profile?.id) return;
    if (needsOnboarding || needsTrainerLink(profile) || isPendingActivation(profile)) return;
    if (profile.role === 'trainer' || profile.role === 'admin') return;

    void useInboxStore.getState().loadInbox(userId, profile.trainer_id);
    const unsubscribe = useInboxStore.getState().subscribeInbox(userId, profile.trainer_id);
    return unsubscribe;
  }, [session?.user.id, profile?.id, profile?.trainer_id, profile?.role, profile?.client_status, needsOnboarding]);

  const applyImageConsentGate = useCallback(async () => {
    try {
      const result = await resolveImageConsentGate();
      setImageConsentConfig(result.config);
      setImageConsentRequired(result.required);
    } catch (err) {
      if (__DEV__) console.warn('[image_consent] gate check failed:', err);
      setImageConsentRequired(false);
      setImageConsentConfig(null);
    }
  }, []);

  const checkWaiver = useCallback(async () => {
    if (!session || needsOnboarding || needsTrainerLink(profile)) {
      setWaiverChecked(true);
      setWaiverRequired(false);
      setWaiverConfig(null);
      setImageConsentRequired(false);
      setImageConsentConfig(null);
      gatesInitializedRef.current = true;
      return;
    }
    if (!profile?.id) {
      if (!gatesInitializedRef.current) setWaiverChecked(false);
      return;
    }
    if (profile.role === 'trainer' || profile.role === 'admin') {
      setWaiverChecked(true);
      setWaiverRequired(false);
      setWaiverConfig(null);
      setImageConsentRequired(false);
      setImageConsentConfig(null);
      gatesInitializedRef.current = true;
      return;
    }
    if (!profile.trainer_id) {
      setWaiverChecked(true);
      setWaiverRequired(false);
      setWaiverConfig(null);
      setImageConsentRequired(false);
      setImageConsentConfig(null);
      gatesInitializedRef.current = true;
      return;
    }

    const isRecheck = gatesInitializedRef.current;
    if (!isRecheck) setWaiverChecked(false);

    try {
      const result = await resolveWaiverGate();
      setWaiverConfig(result.config);
      setWaiverRequired(result.required);

      if (!result.required) {
        await applyImageConsentGate();
      } else if (!isRecheck) {
        setImageConsentRequired(false);
        setImageConsentConfig(null);
      }
    } catch (err) {
      if (__DEV__) console.warn('[waiver] check failed:', err);
      setWaiverRequired(false);
      setWaiverConfig(null);
      setImageConsentRequired(false);
      setImageConsentConfig(null);
    } finally {
      setWaiverChecked(true);
      gatesInitializedRef.current = true;
    }
  }, [session, profile, needsOnboarding, applyImageConsentGate]);

  useEffect(() => {
    void checkWaiver();
  }, [checkWaiver]);

  useAppActive(() => {
    void checkWaiver();
    clearSubscriptionAccessCache();
    void useAuthStore.getState().refreshProfile();
  });

  useEffect(() => {
    if (!waiverChecked || waiverRequired || imageConsentRequired) return;
    if (!session || !profile?.id || needsOnboarding || needsTrainerLink(profile)) {
      setConsultationRequired(false);
      return;
    }
    const trainerId = profile.trainer_id;
    if (!trainerId) {
      setConsultationRequired(false);
      return;
    }

    let active = true;

    void (async () => {
      try {
        const { data: cfg } = await anyClient
          .from('consultation_form_configs')
          .select('form_code')
          .eq('trainer_id', trainerId)
          .maybeSingle() as { data: { form_code: string } | null };

        if (!cfg?.form_code?.trim()) {
          if (active) setConsultationRequired(false);
          return;
        }

        const { data: existing } = await anyClient
          .from('consultation_responses')
          .select('id')
          .eq('client_id', profile.id)
          .eq('trainer_id', trainerId)
          .maybeSingle();

        if (!active) return;

        if (existing) {
          setConsultationRequired(false);
        } else {
          setConsultationFormCode(cfg.form_code);
          setConsultationRequired(true);
        }
      } catch {
        if (active) setConsultationRequired(false);
      }
    })();

    return () => { active = false; };
  }, [waiverChecked, waiverRequired, imageConsentRequired, session, profile, needsOnboarding]);

  const gatesPending =
    !!session &&
    !!profile?.id &&
    !needsOnboarding &&
    !needsTrainerLink(profile) &&
    !waiverChecked;

  // Only block rendering with the loading overlay during initialization or when a session
  // exists and gates are pending. While the user is unauthenticated, keep the AuthStack
  // mounted so in-progress navigation (e.g. LoginScreen) is not reset on auth operations.
  const showLoading = initializing || (!!session && (loading || gatesPending));

  if (!themeHydrated) return <AuthLoadingOverlay />;
  if (showLoading || sliderDone === null || storedProfile === undefined) return <AuthLoadingOverlay />;
  if (!session) {
    if (!sliderDone) return <MarketingSliderScreen onDone={handleSliderDone} />;
    const showEasyLogin = !!storedProfile && !sliderJustFinished && !forcedSignOut;
    return <AuthStack key={showEasyLogin ? 'easy' : 'login'} hasStoredProfile={showEasyLogin} />;
  }
  if (needsPasswordReset) return <UpdatePasswordScreen />;
  if (needsTrainerLink(profile)) return <LinkTrainerScreen />;
  if (isPendingActivation(profile)) return <SubscriptionPlansScreen />;
  if (needsOnboarding) return <OnboardingScreen />;

  // Deslinde antes que consulta o pantalla principal
  if (waiverRequired && waiverConfig && profile?.trainer_id) {
    return (
      <WaiverBlockingGate
        config={waiverConfig}
        trainerId={profile.trainer_id}
        onSigned={() => {
          setWaiverRequired(false);
          setWaiverConfig(null);
          void applyImageConsentGate();
        }}
      />
    );
  }

  if (imageConsentRequired && imageConsentConfig && profile?.trainer_id) {
    return (
      <ImageConsentBlockingGate
        config={imageConsentConfig}
        trainerId={profile.trainer_id}
        onAccepted={() => {
          setImageConsentRequired(false);
          setImageConsentConfig(null);
        }}
        onSkip={() => {
          // Consentimiento opcional: se omite por esta sesión.
          setImageConsentRequired(false);
          setImageConsentConfig(null);
        }}
      />
    );
  }

  if (consultationRequired && consultationFormCode && profile?.trainer_id) {
    return (
      <ConsultationFormScreen
        formCode={consultationFormCode}
        trainerId={profile.trainer_id}
        onSubmitted={() => setConsultationRequired(false)}
        onSkip={() => setConsultationRequired(false)}
      />
    );
  }

  return <MainTabs />;
}
