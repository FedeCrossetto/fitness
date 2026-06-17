export { es } from './es';
export { en } from './en';
export type { Translations } from './es';

/**
 * Replaces `{{key}}` placeholders in a translation string.
 *
 * @example
 * i(t.greeting.streak, { n: 5, unit: t.greeting.streak_days }) // "Racha de 5 días"
 * i(t.ui.ago_hours, { n: 3 })                                  // "Hace 3h"
 */
export function i(
  str: string,
  params: Record<string, string | number>,
): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(params[key] ?? `{{${key}}}`),
  );
}

export type Language = 'es' | 'en';

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'es', label: 'Español', flag: '🇦🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
];
