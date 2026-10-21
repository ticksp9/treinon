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
import esUi from './locales/ui.es.json';
import deUi from './locales/ui.de.json';
import zhUi from './locales/ui.zh.json';

/** Languages the person can choose. The others have files from the old project but the app is not translated into them yet. */
export const READY_LANGUAGES = ['pt', 'en', 'es', 'de', 'zh'] as const;

export const languages: { code: string; name: string; flag: string; rtl?: boolean }[] = [
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', rtl: true },
];

export type LanguageCode = 'pt' | 'en' | 'fr' | 'es' | 'de' | 'ar' | 'zh';

// first visit: the phone's language when the app speaks it, English otherwise (Portuguese phones get Portuguese)
const detector = new LanguageDetector();
detector.addDetector({
  name: 'device',
  lookup() {
    const list = typeof navigator === 'undefined' ? [] : (navigator.languages?.length ? navigator.languages : [navigator.language]);
    for (const l of list) {
      const code = (l || '').slice(0, 2).toLowerCase();
      if ((READY_LANGUAGES as readonly string[]).includes(code)) return code;
    }
    return 'en';
  },
});

i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
      en: { translation: en, ui: enUi },
      fr: { translation: fr },
      es: { translation: es, ui: esUi },
      de: { translation: de, ui: deUi },
      ar: { translation: ar },
      zh: { translation: zh, ui: zhUi },
    },
    fallbackLng: 'pt',
    supportedLngs: [...READY_LANGUAGES],
    nonExplicitSupportedLngs: true,
    detection: {
      // what the person chose on this device, otherwise the phone's language
      order: ['localStorage', 'device'],
      caches: [],
      lookupLocalStorage: 'language',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
