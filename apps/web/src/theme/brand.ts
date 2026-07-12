/**
 * Branding de la webapp R3SET (panel del entrenador) — fuente única de verdad
 * de la identidad visual: paleta, tipografía, radios, sombras y espaciado.
 *
 * Espeja el sistema de `apps/mobile/src/theme/colors.ts` pero para la web.
 * Los mismos valores viven en `:root` (styles.css) como defaults (para evitar
 * flash al cargar) y se aplican en runtime vía `applyBrandTheme()` desde
 * main.tsx — así editar ESTE archivo cambia toda la app.
 *
 * Dirección de marca: azul profundo tipo Linear / Vercel / Stripe, con un
 * acento turquesa. Sin verde lima.
 */

export const brand = {
  color: {
    /* Marca — azul profundo (primary) + hover más oscuro. */
    primary: '#1D4ED8',
    primaryHover: '#1E40AF',
    primaryOn: '#FFFFFF', // texto/íconos sobre el azul
    primarySoft: 'rgba(29, 78, 216, 0.10)', // tinte para estados activos / selección
    ring: '#2563EB', // anillo de foco

    /* Acento secundario — turquesa (realces, detalles, "liked", highlights). */
    accent: '#14B8A6',
    accentHover: '#0D9488',
    accentSoft: 'rgba(20, 184, 166, 0.12)',

    /* Neutros. */
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceElevated: '#F1F5F9',
    surfaceHover: '#EEF2F7',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',

    /* Tinta para superficies oscuras (cards de acento / hero). */
    ink: '#0F172A',
    inkElevated: '#1E293B',
    onInk: '#FFFFFF',

    /* Semánticos (estado). */
    good: '#16A34A',
    bad: '#DC2626',
    warning: '#F59E0B',
  },

  font: {
    family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    /** Tamaños base (px). El body usa 14px. */
    size: { xs: 11, sm: 12.5, base: 14, md: 15, lg: 17, xl: 22, xxl: 30 },
  },

  radius: { lg: '18px', md: '14px', sm: '10px', pill: '999px' },

  shadow: {
    card: '0 1px 2px rgba(15, 23, 42, 0.04)',
    md: '0 1px 2px rgba(15, 23, 42, 0.05), 0 4px 14px rgba(15, 23, 42, 0.06)',
    lg: '0 2px 6px rgba(15, 23, 42, 0.07), 0 10px 28px rgba(15, 23, 42, 0.09)',
  },

  space: { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', xxl: '32px' },
} as const;

/** Mapa branding → CSS custom properties de `:root`. Mantener sincronizado
 * con el bloque `:root` de styles.css (mismos valores, sin flash). */
const cssVars: Record<string, string> = {
  '--bg': brand.color.bg,
  '--surface': brand.color.surface,
  '--surface-elevated': brand.color.surfaceElevated,
  '--surface-hover': brand.color.surfaceHover,
  '--border': brand.color.border,
  '--border-strong': brand.color.borderStrong,
  '--text-primary': brand.color.textPrimary,
  '--text-secondary': brand.color.textSecondary,
  '--text-tertiary': brand.color.textTertiary,

  '--ink': brand.color.ink,
  '--ink-elevated': brand.color.inkElevated,
  '--on-ink': brand.color.onInk,

  /* El "accent" histórico de la web = primary de marca (azul). */
  '--accent': brand.color.primary,
  '--accent-hover': brand.color.primaryHover,
  '--accent-contrast': brand.color.primaryOn,
  '--accent-text': brand.color.primary,
  '--accent-soft': brand.color.primarySoft,
  '--accent-ring': brand.color.ring,

  /* Acento secundario turquesa (reemplaza al viejo lima). */
  '--brand-accent': brand.color.accent,
  '--brand-accent-hover': brand.color.accentHover,
  '--brand-accent-soft': brand.color.accentSoft,
  '--brand-lime': brand.color.accent, // alias legacy → turquesa
  '--brand-lime-soft': brand.color.accentSoft,
  '--brand-lime-on': brand.color.primaryOn,

  '--good': brand.color.good,
  '--bad': brand.color.bad,
  '--warning': brand.color.warning,

  '--radius-lg': brand.radius.lg,
  '--radius': brand.radius.md,
  '--radius-sm': brand.radius.sm,
  '--radius-pill': brand.radius.pill,

  '--card-shadow': brand.shadow.card,
  '--shadow': brand.shadow.md,
  '--shadow-hover': brand.shadow.lg,
};

/** Aplica los tokens de marca a `:root`. Se llama una vez al arrancar la app.
 * Al editar `brand` acá, toda la webapp se actualiza. */
export function applyBrandTheme(root: HTMLElement = document.documentElement): void {
  for (const [key, value] of Object.entries(cssVars)) {
    root.style.setProperty(key, value);
  }
}

export type Brand = typeof brand;
