import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import { es, en, i } from '@reset-fitness/shared';
import type { Language, Translations } from '@reset-fitness/shared';

const TRANSLATIONS: Record<Language, Translations> = { es, en };

function detectLanguage(): Language {
  try {
    let locale = 'es';
    if (Platform.OS === 'ios') {
      locale =
        NativeModules.SettingsManager?.settings?.AppleLocale ??
        NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] ??
        'es';
    } else {
      locale = NativeModules.I18nManager?.localeIdentifier ?? 'es';
    }
    return locale.startsWith('en') ? 'en' : 'es';
  } catch {
    return 'es';
  }
}

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: detectLanguage(),
      setLanguage: (lang) => set({ language: lang }),
    }),
    {
      name: 'reset-fitness-language',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

/**
 * Shorthand hook for translations + interpolation helper.
 * `t` is derived from the persisted `language` primitive — any change
 * to `language` triggers a re-render in every subscriber.
 *
 * @example
 * const { t, i18n } = useTranslation();
 * t.home.today_title                         // "Tu día de hoy" | "Today's goals"
 * i18n(t.greeting.streak, { n: 5, unit: t.greeting.streak_days })
 */
export function useTranslation() {
  const language    = useI18nStore((s) => s.language);
  const setLanguage = useI18nStore((s) => s.setLanguage);
  const t           = TRANSLATIONS[language];
  return { t, language, setLanguage, i18n: i };
}
