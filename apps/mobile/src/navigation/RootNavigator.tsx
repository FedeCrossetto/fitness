import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../theme';
import { useAuthStore } from '../stores/authStore';
import { useBrandingStore } from '../stores/brandingStore';
import { useTrainingStore } from '../stores/trainingStore';
import { AuthLoadingOverlay } from '../components/common';
import type { MainTabsParamList } from '../types/navigation';
import { TabBar } from './TabBar';
import { AddMenuOverlay } from './AddMenuOverlay';
import { AuthStack, HomeStack, NutritionStack, ProgressStack, TrainingStack } from './stacks';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { LinkTrainerScreen } from '../screens/auth/LinkTrainerScreen';
import { PendingActivationScreen } from '../screens/auth/PendingActivationScreen';
import { WaiverScreen } from '../screens/waiver/WaiverScreen';
import { ConsultationFormScreen } from '../screens/consultation/ConsultationFormScreen';
import { useInviteDeepLink } from '../hooks/useInviteDeepLink';
import { needsTrainerLink, isPendingActivation } from '../services/clientAccess';
import { syncPushRegistration } from '../services/notifications';
import { supabase } from '../lib/supabase';

const anyClient = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

interface WaiverCfg { title: string; body: string; require_before_start: boolean }

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

/** Decide entre Auth, Onboarding, WaiverGate y App según la sesión de Supabase. */
export function RootNavigator(): React.JSX.Element {
  useInviteDeepLink();

  const initializing         = useAuthStore((s) => s.initializing);
  const loading              = useAuthStore((s) => s.loading);
  const session              = useAuthStore((s) => s.session);
  const profile              = useAuthStore((s) => s.profile);
  const needsOnboarding      = useAuthStore((s) => s.needsOnboarding);
  const restoreActiveSession = useTrainingStore((s) => s.restoreActiveSession);

  // Waiver gate state
  const [waiverChecked, setWaiverChecked] = useState(false);
  const [waiverRequired, setWaiverRequired] = useState(false);
  const [waiverConfig, setWaiverConfig] = useState<WaiverCfg | null>(null);

  // Consultation form gate state
  const [consultationChecked, setConsultationChecked] = useState(false);
  const [consultationRequired, setConsultationRequired] = useState(false);
  const [consultationFormCode, setConsultationFormCode] = useState<string | null>(null);

  useEffect(() => {
    void restoreActiveSession();
  }, [restoreActiveSession]);

  // Recargar colores cuando cambia el entrenador vinculado
  useEffect(() => {
    if (!session) return;
    void useBrandingStore.getState().load();
  }, [session, profile?.trainer_id, profile?.role]);

  // Registrar push token al tener sesión activa (no solo al abrir Home).
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !profile?.id) return;
    if (needsOnboarding || needsTrainerLink(profile) || isPendingActivation(profile)) return;
    void syncPushRegistration(userId);
  }, [session?.user.id, profile?.id, profile?.trainer_id, profile?.client_status, needsOnboarding]);

  // After session + profile loaded, check if waiver signature is needed
  useEffect(() => {
    if (!session || !profile?.id || needsOnboarding) {
      setWaiverChecked(true);
      setWaiverRequired(false);
      return;
    }
    const trainerId = profile.trainer_id;
    if (!trainerId) {
      setWaiverChecked(true);
      setWaiverRequired(false);
      return;
    }

    let active = true;
    setWaiverChecked(false);

    void (async () => {
      try {
        // Check waiver config exists and is required
        const { data: cfg } = await anyClient
          .from('waiver_configs')
          .select('title, body, require_before_start')
          .eq('trainer_id', trainerId)
          .maybeSingle();

        if (!cfg || !(cfg as WaiverCfg).require_before_start) {
          if (active) setWaiverChecked(true);
          return;
        }

        // Check if client already signed
        const { data: sig } = await anyClient
          .from('waiver_signatures')
          .select('id')
          .eq('client_id', profile.id)
          .eq('trainer_id', trainerId)
          .maybeSingle();

        if (!active) return;

        if (sig) {
          setWaiverChecked(true);
        } else {
          setWaiverConfig(cfg as WaiverCfg);
          setWaiverRequired(true);
          setWaiverChecked(true);
        }
      } catch {
        if (active) setWaiverChecked(true);
      }
    })();

    return () => { active = false; };
  }, [session, profile?.id, profile?.trainer_id, needsOnboarding]);

  // Consultation form gate: runs after waiver is resolved
  useEffect(() => {
    if (!waiverChecked || waiverRequired) return;
    if (!session || !profile?.id || needsOnboarding) {
      setConsultationChecked(true);
      setConsultationRequired(false);
      return;
    }
    const trainerId = profile.trainer_id;
    if (!trainerId) {
      setConsultationChecked(true);
      setConsultationRequired(false);
      return;
    }

    let active = true;
    setConsultationChecked(false);

    void (async () => {
      try {
        const { data: cfg } = await anyClient
          .from('consultation_form_configs')
          .select('form_code')
          .eq('trainer_id', trainerId)
          .maybeSingle() as { data: { form_code: string } | null };

        if (!cfg?.form_code?.trim()) {
          if (active) setConsultationChecked(true);
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
          setConsultationChecked(true);
        } else {
          setConsultationFormCode(cfg.form_code);
          setConsultationRequired(true);
          setConsultationChecked(true);
        }
      } catch {
        if (active) setConsultationChecked(true);
      }
    })();

    return () => { active = false; };
  }, [waiverChecked, waiverRequired, session, profile?.id, profile?.trainer_id, needsOnboarding]);

  const gatesPending =
    !!session &&
    !!profile?.id &&
    !needsOnboarding &&
    (!waiverChecked || (!waiverRequired && !consultationChecked));

  const showLoading = initializing || loading || gatesPending;

  if (showLoading) return <AuthLoadingOverlay />;
  if (!session) return <AuthStack />;
  if (needsTrainerLink(profile)) return <LinkTrainerScreen />;
  if (needsOnboarding) return <OnboardingScreen />;
  if (waiverRequired && waiverConfig && profile?.trainer_id) {
    return (
      <WaiverScreen
        config={waiverConfig}
        trainerId={profile.trainer_id}
        onSigned={() => setWaiverRequired(false)}
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
  // Vinculado pero el entrenador todavía no lo activó → app bloqueada.
  if (isPendingActivation(profile)) return <PendingActivationScreen />;
  return <MainTabs />;
}
