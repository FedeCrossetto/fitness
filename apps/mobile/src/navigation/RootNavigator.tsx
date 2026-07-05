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
import { AuthStack, HomeStack, MentoriaWaitStack, NutritionStack, ProgressStack, TrainingStack } from './stacks';
import { OnboardingScreen } from '../screens/auth/OnboardingScreen';
import { UpdatePasswordScreen } from '../screens/auth/UpdatePasswordScreen';
import { LinkTrainerScreen } from '../screens/auth/LinkTrainerScreen';
import { SubscriptionPlansScreen } from '../screens/auth/SubscriptionPlansScreen';
import { CheckoutResultScreen } from '../screens/subscription/CheckoutResultScreen';
import { useCheckoutStore } from '../stores/checkoutStore';
import { ConsultationFormScreen } from '../screens/consultation/ConsultationFormScreen';
import { WaiverBlockingGate } from '../components/waiver/WaiverBlockingGate';
import { ImageConsentBlockingGate } from '../components/waiver/ImageConsentBlockingGate';
import { BiometricSetupScreen } from '../screens/auth/BiometricSetupScreen';
import { useInviteDeepLink } from '../hooks/useInviteDeepLink';
import { useAppActive } from '../hooks/useAppActive';
import { useMarketingSlider } from '../hooks/useMarketingSlider';
import { MarketingSliderScreen } from '../screens/auth/MarketingSliderScreen';
import { useStoredProfile } from '../hooks/useStoredProfile';
import { needsTrainerLink, isPendingActivation } from '../services/clientAccess';
import { hasPendingMentoriaEvaluation } from '../services/evaluationGate';
import { clearSubscriptionAccessCache } from '../services/payments';
import {
  resolveActivationSteps,
  type ActivationStep,
  type WaiverCfg,
  type ImageConsentCfg,
} from '../services/activationGate';
import { syncPushRegistration } from '../services/notifications';
import { useInboxStore } from '../stores/inboxStore';

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

  const themeHydrated        = useThemeHydrated();
  const initializing         = useAuthStore((s) => s.initializing);
  const loading              = useAuthStore((s) => s.loading);
  const session              = useAuthStore((s) => s.session);
  const profile              = useAuthStore((s) => s.profile);
  const needsOnboarding      = useAuthStore((s) => s.needsOnboarding);
  const needsPasswordReset   = useAuthStore((s) => s.needsPasswordReset);
  const forcedSignOut        = useAuthStore((s) => s.forcedSignOut);
  const evaluationGateVersion = useAuthStore((s) => s.evaluationGateVersion);
  const restoreActiveSession = useTrainingStore((s) => s.restoreActiveSession);
  // Flujo de checkout activo (procesando/aprobado/rechazado): toma la pantalla
  // por encima del gate normal, así el resultado del pago se muestra completo
  // (incluida la pantalla "aprobado + Comencemos") sin que el gate lo saltee.
  const checkoutPhase = useCheckoutStore((s) => s.phase);

  // Mientras isPendingActivation(profile) sea true, decide si mostrar el
  // selector de planes (nunca aplicó a nada) o la pantalla de espera de
  // Mentoría 1-1 (ya aplicó, solo falta que el entrenador lo active).
  // null = todavía no se resolvió la consulta.
  const [mentoriaWaiting, setMentoriaWaiting] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isPendingActivation(profile) || !profile?.id) { setMentoriaWaiting(false); return; }
    // Vuelve a "cargando" en cada resolución (ej. re-login luego de un logout) —
    // sin esto, el valor anterior (ej. `false`, de antes de aplicar a mentoría)
    // queda mostrando la pantalla equivocada mientras la consulta está en curso.
    let active = true;
    setMentoriaWaiting(null);
    void hasPendingMentoriaEvaluation(profile.id).then((v) => { if (active) setMentoriaWaiting(v); });
    return () => { active = false; };
  }, [profile?.id, profile?.client_status, evaluationGateVersion]);

  // Deslinde + consentimiento de imagen + formulario de consulta, unificados en
  // UNA lista de pasos resuelta atómicamente (ver activationGate.ts). Antes cada
  // gate se resolvía con su propio efecto async independiente: entre que un
  // paso terminaba y el siguiente se resolvía, había una ventana de render sin
  // ningún gate activo → se veía un frame de MainTabs (menú, tabs, etc.) antes
  // de que apareciera el siguiente paso. Con el batch, avanzar de un paso al
  // siguiente es un simple incremento de índice en memoria — no dispara una
  // nueva consulta de red ni pasa por un estado intermedio "sin gate".
  const [activationSteps, setActivationSteps] = useState<ActivationStep[] | null>(null);
  const [activationIndex, setActivationIndex] = useState(0);
  const [activationConfigs, setActivationConfigs] = useState<{
    waiverConfig: WaiverCfg | null;
    imageConsentConfig: ImageConsentCfg | null;
    consultationFormCode: string | null;
  }>({ waiverConfig: null, imageConsentConfig: null, consultationFormCode: null });

  const { sliderDone, markSliderDone } = useMarketingSlider();
  const { profile: storedProfile } = useStoredProfile();
  const [sliderJustFinished, setSliderJustFinished] = useState(false);

  /** Evita pantalla negra al re-chequear gates (p. ej. refreshProfile al firmar deslinde). */
  const activationInitializedRef = useRef(false);
  const activationSessionIdRef = useRef<string | null>(null);

  // Nueva sesión (login) → los gates deben re-evaluarse desde cero, incluso si un
  // usuario anterior ya los había inicializado en este mismo montaje de RootNavigator.
  const currentSessionId = session?.user.id ?? null;
  if (activationSessionIdRef.current !== currentSessionId) {
    activationSessionIdRef.current = currentSessionId;
    activationInitializedRef.current = false;
  }

  // Igual que antes con needsOnboarding: si el batch ya se había resuelto y
  // needsOnboarding pasa a false, forzamos un recheck (durante el render, no en
  // un efecto, para que aplique en el mismo commit sin flash).
  const prevNeedsOnboardingRef = useRef(needsOnboarding);
  if (prevNeedsOnboardingRef.current !== needsOnboarding) {
    prevNeedsOnboardingRef.current = needsOnboarding;
    if (!needsOnboarding && activationInitializedRef.current) {
      activationInitializedRef.current = false;
      setActivationSteps(null);
    }
  }

  // Reset el flag cuando el usuario inicia sesión, así el próximo logout muestra EasyLogin
  useEffect(() => {
    if (session) setSliderJustFinished(false);
  }, [session]);

  const handleSliderDone = async () => {
    setSliderJustFinished(true);
    await markSliderDone();
  };

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

  const computeActivation = useCallback(async () => {
    if (!session || needsOnboarding || needsTrainerLink(profile)) {
      setActivationSteps([]);
      activationInitializedRef.current = true;
      return;
    }
    if (!profile?.id) {
      if (!activationInitializedRef.current) setActivationSteps(null);
      return;
    }
    if (profile.role === 'trainer' || profile.role === 'admin' || !profile.trainer_id) {
      setActivationSteps([]);
      activationInitializedRef.current = true;
      return;
    }

    try {
      const result = await resolveActivationSteps(profile);
      setActivationConfigs({
        waiverConfig: result.waiverConfig,
        imageConsentConfig: result.imageConsentConfig,
        consultationFormCode: result.consultationFormCode,
      });
      setActivationSteps(result.steps);
      setActivationIndex(0);
    } catch (err) {
      if (__DEV__) console.warn('[activation] compute failed:', err);
      setActivationSteps([]);
    } finally {
      activationInitializedRef.current = true;
    }
  }, [session, profile, needsOnboarding]);

  useEffect(() => {
    void computeActivation();
  }, [computeActivation]);

  useAppActive(() => {
    void computeActivation();
    clearSubscriptionAccessCache();
    void useAuthStore.getState().refreshProfile();
  });

  const advanceActivation = useCallback(() => {
    setActivationIndex((i) => i + 1);
  }, []);

  const currentActivationStep =
    activationSteps && activationIndex < activationSteps.length ? activationSteps[activationIndex] : null;

  // activationInitializedRef distingue el chequeo inicial (debe bloquear con el
  // loading overlay) de un recheck posterior — p. ej. al volver del background,
  // cuando computeActivation() se re-dispara mientras el usuario ya está viendo
  // la app. Sin este flag, cada recheck volvería a mostrar el overlay ("doble R")
  // sobre una app que ya había terminado de cargar.
  const gatesPending =
    !activationInitializedRef.current &&
    !!session &&
    !!profile?.id &&
    !needsOnboarding &&
    !needsTrainerLink(profile);

  // Only block rendering with the loading overlay during initialization or when a session
  // exists and gates are pending. While the user is unauthenticated, keep the AuthStack
  // mounted so in-progress navigation (e.g. LoginScreen) is not reset on auth operations.
  const showLoading = initializing || (!!session && (loading || gatesPending));

  if (!themeHydrated) return <AuthLoadingOverlay />;
  if (showLoading || sliderDone === null || storedProfile === undefined) return <AuthLoadingOverlay />;
  if (!session) {
    // El slider es para dispositivos que nunca iniciaron sesión acá — si ya
    // hay un perfil guardado (EasyLogin), un logout no debe volver a mostrarlo
    // aunque `sliderDone` todavía esté en false (ej. DEV_ALWAYS_SHOW).
    if (!sliderDone && !storedProfile) return <MarketingSliderScreen onDone={handleSliderDone} />;
    const showEasyLogin = !!storedProfile && !sliderJustFinished && !forcedSignOut;
    return <AuthStack key={showEasyLogin ? 'easy' : 'login'} hasStoredProfile={showEasyLogin} />;
  }
  if (needsPasswordReset) return <UpdatePasswordScreen />;
  if (needsTrainerLink(profile)) return <LinkTrainerScreen />;
  // Resultado del pago (aprobado/pending/rechazado) por encima de todos los
  // gates: incluso si el backend ya activó al cliente, retenemos hasta que
  // toque "Comencemos".
  if (checkoutPhase !== 'idle') return <CheckoutResultScreen />;
  if (isPendingActivation(profile)) {
    if (mentoriaWaiting === null) return <AuthLoadingOverlay />;
    return mentoriaWaiting ? <MentoriaWaitStack /> : <SubscriptionPlansScreen />;
  }
  if (needsOnboarding) return <OnboardingScreen />;

  // Deslinde + consentimiento de imagen + formulario, como un solo flujo de
  // pasos: avanzar de uno al siguiente es un simple incremento de índice, sin
  // volver a golpear la red ni pasar por MainTabs entre paso y paso.
  if (currentActivationStep === 'waiver' && activationConfigs.waiverConfig && profile?.trainer_id) {
    return (
      <WaiverBlockingGate
        config={activationConfigs.waiverConfig}
        trainerId={profile.trainer_id}
        onSigned={advanceActivation}
      />
    );
  }

  if (currentActivationStep === 'imageConsent' && activationConfigs.imageConsentConfig && profile?.trainer_id) {
    return (
      <ImageConsentBlockingGate
        config={activationConfigs.imageConsentConfig}
        trainerId={profile.trainer_id}
        onAccepted={advanceActivation}
        // ImageConsentScreen ya persistió el rechazo (status='declined') antes de
        // llamar a este callback, así que el gate no se va a volver a activar en
        // próximos logins.
        onSkip={advanceActivation}
      />
    );
  }

  if (currentActivationStep === 'biometric' && profile?.id) {
    return <BiometricSetupScreen onDecided={advanceActivation} />;
  }

  if (currentActivationStep === 'consultation' && activationConfigs.consultationFormCode && profile?.trainer_id) {
    return (
      <ConsultationFormScreen
        formCode={activationConfigs.consultationFormCode}
        trainerId={profile.trainer_id}
        onSubmitted={advanceActivation}
        onSkip={advanceActivation}
      />
    );
  }

  return <MainTabs />;
}
