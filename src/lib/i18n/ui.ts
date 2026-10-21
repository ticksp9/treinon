/**
 * Translating the screens: the Portuguese text is the key.
 *
 *   const t = useT();
 *   <Button>{t('Novo jogador')}</Button>
 *   t('{{n}} jogadores', { n: 12 })
 *
 * In Portuguese the text shows as written; in English it comes from locales/ui.en.json, and a
 * text not translated yet shows in Portuguese instead of breaking. Outside React (PDFs, toasts in
 * plain functions) use `tx()`. A test checks that every t('…') / tx('…') has its English.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { enGB, pt } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import i18n from './index';

type Vars = Record<string, string | number | null | undefined>;
const OPTS = { ns: 'ui', keySeparator: false as const, nsSeparator: false as const };

/** Marks a text in a list or constant as translatable; translate it where it is shown with t(). */
export const tr = (text: string) => text;

/** Translate outside React components. */
export function tx(text: string, vars?: Vars): string {
  return i18n.t(text, { ...OPTS, ...vars, defaultValue: text }) as string;
}

/** Translate inside components (re-renders when the language changes). */
export function useT() {
  const { i18n: inst } = useTranslation('ui');
  const lang = inst.language;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((text: string, vars?: Vars) => tx(text, vars), [lang]);
}

export const isEnglish = () => (i18n.language || 'pt').startsWith('en');

/** date-fns locale for the chosen language. */
export function dateLocale(): Locale {
  return isEnglish() ? enGB : pt;
}

export function useDateLocale(): Locale {
  const { i18n: inst } = useTranslation('ui');
  return inst.language?.startsWith('en') ? enGB : pt;
}

/** Number/date formatting tag for Intl and toLocale*String. */
export const intlLocale = () => (isEnglish() ? 'en-GB' : 'pt-PT');
