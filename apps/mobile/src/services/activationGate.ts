import { anyClient, supabase } from '../lib/supabase';
import { resolveClientPlanType } from './payments';
import { hasDecidedSetup, isHardwareSupported } from './biometrics';
import type { ProfileRow } from '../types/database';

/**
 * Resuelve los gates de activación (deslinde, consentimiento de imagen,
 * configuración de acceso rápido, formulario de consulta) EN UN SOLO batch
 * atómico, en vez de efectos independientes que se disparan y resuelven por
 * separado. Antes, entre que un gate terminaba (ej. formulario enviado) y el
 * siguiente (deslinde) se resolvía de forma asíncrona, había una ventana de
 * render donde ningún gate estaba activo → se veía un frame de MainTabs
 * (pantalla principal) antes de que el siguiente gate apareciera. Con el
 * batch, el `RootNavigator` conoce TODOS los pasos pendientes desde el inicio
 * y solo avanza el índice localmente (sin volver a golpear la red) — no hay
 * ventana en la que "no hay gate activo" mientras todavía queda un paso.
 */

export interface WaiverCfg {
  title: string;
  body: string;
  require_before_start: boolean;
}

export interface ImageConsentCfg {
  title: string;
  body: string;
}

export type ActivationStep = 'waiver' | 'imageConsent' | 'biometric' | 'consultation';

export interface ActivationSteps {
  steps: ActivationStep[];
  waiverConfig: WaiverCfg | null;
  imageConsentConfig: ImageConsentCfg | null;
  consultationFormCode: string | null;
}

type WaiverGateRpc = {
  required?: boolean;
  title?: string;
  body?: string;
  require_before_start?: boolean;
};

type ImageConsentGateRpc = {
  required?: boolean;
  title?: string;
  body?: string;
};

async function resolveWaiverGate(): Promise<{ required: boolean; config: WaiverCfg | null }> {
  const { data, error } = await supabase.rpc('get_client_waiver_gate');

  if (error) {
    if (__DEV__) console.warn('[activation] get_client_waiver_gate failed:', error.message);
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

  if (cfgError && __DEV__) console.warn('[activation] waiver_configs query failed:', cfgError.message);

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

  if (sigError && __DEV__) console.warn('[activation] waiver_signatures query failed:', sigError.message);
  if (sig) return { required: false, config: null };

  return { required: true, config: waiverCfg };
}

async function resolveImageConsentGate(): Promise<{ required: boolean; config: ImageConsentCfg | null }> {
  const { data, error } = await supabase.rpc('get_client_image_consent_gate');

  if (error) {
    if (__DEV__) console.warn('[activation] get_client_image_consent_gate failed:', error.message);
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

  if (cfgError && __DEV__) console.warn('[activation] waiver_configs query failed:', cfgError.message);

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

  if (accError && __DEV__) console.warn('[activation] acceptances query failed:', accError.message);
  if (existing) return { required: false, config: null };

  return {
    required: true,
    config: {
      title: consentCfg.image_consent_title ?? 'Consentimiento de uso de imágenes',
      body: consentCfg.image_consent_body,
    },
  };
}

async function resolveConsultationFormCode(profile: ProfileRow): Promise<string | null> {
  const trainerId = profile.trainer_id;
  if (!trainerId) return null;
  try {
    const planType = await resolveClientPlanType(profile.id);
    const { data: cfg } = (await anyClient
      .from('consultation_form_configs')
      .select('form_code')
      .eq('trainer_id', trainerId)
      .eq('plan_type', planType)
      .maybeSingle()) as { data: { form_code: string } | null };

    if (!cfg?.form_code?.trim()) return null;

    const { data: existing } = await anyClient
      .from('consultation_responses')
      .select('id')
      .eq('client_id', profile.id)
      .eq('trainer_id', trainerId)
      .maybeSingle();

    return existing ? null : cfg.form_code;
  } catch (err) {
    if (__DEV__) console.warn('[activation] resolveConsultationFormCode failed:', err);
    return null;
  }
}

/** Configuración de acceso rápido (Face ID / Touch ID): se ofrece una sola vez
 * por usuario, justo después de firmar deslinde + consentimiento de imagen, y
 * solo si el dispositivo soporta biometría (si no, no tiene sentido mostrarla). */
async function resolveBiometricStep(userId: string): Promise<boolean> {
  const decided = await hasDecidedSetup(userId);
  if (decided) return false;
  return isHardwareSupported();
}

/** Resuelve los gates en paralelo y arma el orden de pasos pendientes. */
export async function resolveActivationSteps(profile: ProfileRow): Promise<ActivationSteps> {
  const [waiverResult, consentResult, biometricRequired, consultationFormCode] = await Promise.all([
    resolveWaiverGate(),
    resolveImageConsentGate(),
    resolveBiometricStep(profile.id),
    resolveConsultationFormCode(profile),
  ]);

  const steps: ActivationStep[] = [];
  if (waiverResult.required) steps.push('waiver');
  if (consentResult.required) steps.push('imageConsent');
  if (biometricRequired) steps.push('biometric');
  if (consultationFormCode) steps.push('consultation');

  return {
    steps,
    waiverConfig: waiverResult.config,
    imageConsentConfig: consentResult.config,
    consultationFormCode,
  };
}
