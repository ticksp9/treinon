import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import pt from './locales/pt.json';
import en from './locales/en.json';
import fr from './locales/fr.json';
import es from './locales/es.json';
import de from './locales/de.json';
import ar from './locales/ar.json';
import zh from './locales/zh.json';
// screens translated with the Portuguese text as key (see ./ui.ts): only the other languages need a file
import enUi from './locales/ui.en.json';

/** Languages the person can choose. The others have files from the old project but the app is not translated into them yet. */
export const READY_LANGUAGES = ['pt', 'en'] as const;

export const languages: { code: string; name: string; flag: string; rtl?: boolean }[] = [
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export type LanguageCode = 'pt' | 'en' | 'fr' | 'es' | 'de' | 'ar' | 'zh';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
      en: { translation: en, ui: enUi },
      fr: { translation: fr },
      es: { translation: es },
      de: { translation: de },
      ar: { translation: ar },
      zh: { translation: zh },
    },
    fallbackLng: 'pt',
    supportedLngs: [...READY_LANGUAGES],
    nonExplicitSupportedLngs: true,
    detection: {
      // only what the person chose: the phone's language would show a half-translated app
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'language',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
