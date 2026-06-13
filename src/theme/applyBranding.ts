import type { Colors } from './colors';
import type { TrainerBrandingRow } from '../types/database';

/** #RRGGBB → rgba(r,g,b,alpha). Devuelve el hex tal cual si no parsea. */
function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Deep-merge superficial sobre objetos de tokens (no arrays). */
function deepMerge<T>(base: T, override: unknown): T {
  if (override === null || typeof override !== 'object' || Array.isArray(override)) {
    return (override as T) ?? base;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    const cur = out[k];
    out[k] = cur && typeof cur === 'object' && !Array.isArray(cur) ? deepMerge(cur, v) : v;
  }
  return out as T;
}

/**
 * Aplica la marca del entrenador sobre la paleta base del core.
 * El color primario domina la señal visual; el acento alimenta los degradados.
 * `branding.theme` (jsonb) permite overrides finos de cualquier token al final.
 */
export function applyBranding(base: Colors, branding: TrainerBrandingRow | null): Colors {
  if (!branding) return base;

  const primary = branding.color_primary;
  const accent = branding.color_accent ?? primary ?? undefined;
  let next: Colors = base;

  if (primary) {
    next = {
      ...next,
      background: branding.color_background ?? next.background,
      primary: {
        ...next.primary,
        default: primary,
        light: accent ?? next.primary.light,
        dark: primary,
        muted: hexToRgba(primary, 0.15),
      },
      states: { ...next.states, success: primary },
      pillars: {
        training: primary,
        nutrition: accent ?? primary,
        progress: primary,
      },
      gradients: {
        ...next.gradients,
        kinetic: [accent ?? primary, primary] as readonly [string, string],
        deep: [primary, next.gradients.deep[1]] as readonly [string, string],
      },
    };
  } else if (branding.color_background) {
    next = { ...next, background: branding.color_background };
  }

  return branding.theme ? deepMerge(next, branding.theme) : next;
}
