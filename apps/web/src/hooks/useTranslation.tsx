import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { es, en, i } from '@habito/shared';
import type { Language, Translations } from '@habito/shared';

const TRANSLATIONS: Record<Language, Translations> = { es, en };
const STORAGE_KEY = 'habito-language';

function detectLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
  if (saved === 'en' || saved === 'es') return saved;
  return navigator.language.startsWith('en') ? 'en' : 'es';
}

interface I18nCtx {
  t: Translations;
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Interpolate {{key}} placeholders. */
  i18n: typeof i;
}

const I18nContext = createContext<I18nCtx | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [language, setLang] = useState<Language>(detectLanguage);

  const setLanguage = (lang: Language) => {
    setLang(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // t is derived inline — changing `language` always produces a new reference
  const t = TRANSLATIONS[language];

  return (
    <I18nContext.Provider value={{ t, language, setLanguage, i18n: i }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation(): I18nCtx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used inside I18nProvider');
  return ctx;
}
