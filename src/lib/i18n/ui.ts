/**
 * Translating the screens: the Portuguese text is the key.
 *
 *   const t = useT();
 *   <Button>{t('Novo jogador')}</Button>
 *   t('{{n}} jogadores', { n: 12 })
 *
 * In Portuguese the text shows as written; the other languages come from locales/ui.<lang>.json,
 * and a text not translated yet shows in Portuguese instead of breaking. Outside React (PDFs, toasts in
 * plain functions) use `tx()`. A test checks that every t('…') / tx('…') has its translation in every language.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { de, enGB, es, fr, pt, zhCN } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import i18n from './index';

type Vars = Record<string, string | number | null | undefined>;
const OPTS = { ns: 'ui', keySeparator: false as const, nsSeparator: false as const };

// jsPDF's built-in fonts have no Chinese glyphs: while a PDF is being built in Chinese, texts come out in English
let pdfDepth = 0;

/** The language texts are shown in right now ('pt', 'en', 'es', 'fr', 'de' or 'zh'). */
export function lang(): string {
  const l = (i18n.language || 'pt').slice(0, 2);
  return pdfDepth > 0 && l === 'zh' ? 'en' : l;
}

/** Build a PDF with this; in Chinese its texts, dates and numbers come out in English. */
export function inPdfLanguage<T>(build: () => T): T {
  pdfDepth++;
  let async = false;
  try {
    const out = build();
    if (out instanceof Promise) { async = true; return out.finally(() => { pdfDepth--; }) as T; }
    return out;
  } finally {
    if (!async) pdfDepth--;
  }
}

/** Marks a text in a list or constant as translatable; translate it where it is shown with t(). */
export const tr = (text: string) => text;

/** Translate outside React components. */
export function tx(text: string, vars?: Vars): string {
  return i18n.t(text, { ...OPTS, ...vars, lng: lang(), defaultValue: text }) as string;
}

/** Translate inside components (re-renders when the language changes). */
export function useT() {
  const { i18n: inst } = useTranslation('ui');
  const current = inst.language;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((text: string, vars?: Vars) => tx(text, vars), [current]);
}

export const isEnglish = () => lang() === 'en';

const DATE_LOCALES: Record<string, Locale> = { pt, en: enGB, es, fr, de, zh: zhCN };

/** date-fns locale for the chosen language. */
export function dateLocale(): Locale {
  return DATE_LOCALES[lang()] ?? pt;
}

export function useDateLocale(): Locale {
  const { i18n: inst } = useTranslation('ui');
  return DATE_LOCALES[(inst.language || 'pt').slice(0, 2)] ?? pt;
}

const INTL: Record<string, string> = { pt: 'pt-PT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', zh: 'zh-CN' };

/** Number/date formatting tag for Intl and toLocale*String. */
export const intlLocale = () => INTL[lang()] ?? 'pt-PT';

// written-out dates, the way each language writes them
const LONG = {
  date: { pt: "d 'de' MMMM 'de' yyyy", en: 'd MMMM yyyy', es: "d 'de' MMMM 'de' yyyy", fr: 'd MMMM yyyy', de: 'd. MMMM yyyy', zh: 'yyyy年M月d日' },
  dateTime: { pt: "d 'de' MMMM 'de' yyyy 'às' HH:mm", en: 'd MMMM yyyy, HH:mm', es: "d 'de' MMMM 'de' yyyy, HH:mm", fr: "d MMMM yyyy 'à' HH:mm", de: 'd. MMMM yyyy, HH:mm', zh: 'yyyy年M月d日 HH:mm' },
  weekday: { pt: "EEEE, d 'de' MMMM", en: 'EEEE d MMMM', es: "EEEE, d 'de' MMMM", fr: 'EEEE d MMMM', de: 'EEEE, d. MMMM', zh: 'M月d日 EEEE' },
  weekdayYear: { pt: "EEEE, d 'de' MMMM 'de' yyyy", en: 'EEEE d MMMM yyyy', es: "EEEE, d 'de' MMMM 'de' yyyy", fr: 'EEEE d MMMM yyyy', de: 'EEEE, d. MMMM yyyy', zh: 'yyyy年M月d日 EEEE' },
  weekdayTime: { pt: "EEEE, d 'de' MMMM 'às' HH:mm", en: 'EEEE d MMMM, HH:mm', es: "EEEE, d 'de' MMMM, HH:mm", fr: "EEEE d MMMM 'à' HH:mm", de: 'EEEE, d. MMMM, HH:mm', zh: 'M月d日 EEEE HH:mm' },
  monthYear: { pt: "MMMM 'de' yyyy", en: 'MMMM yyyy', es: "MMMM 'de' yyyy", fr: 'MMMM yyyy', de: 'MMMM yyyy', zh: 'yyyy年M月' },
} as const;

/** Month names (January…December) in the chosen language, capitalised. */
export function monthNames(): string[] {
  const f = new Intl.DateTimeFormat(intlLocale(), { month: 'long' });
  return Array.from({ length: 12 }, (_, i) => { const m = f.format(new Date(2026, i, 1)); return m.charAt(0).toUpperCase() + m.slice(1); });
}

/** Weekday names, Monday first, in the chosen language, capitalised. */
export function weekdayNames(): string[] {
  const f = new Intl.DateTimeFormat(intlLocale(), { weekday: 'long' });
  return Array.from({ length: 7 }, (_, i) => { const d = f.format(new Date(2026, 0, 5 + i)); return d.charAt(0).toUpperCase() + d.slice(1); });
}

/** A written-out date in the chosen language, e.g. longDate(d) → "12 de março de 2026" / "12 March 2026". */
export function longDate(d: Date | string | number, kind: keyof typeof LONG = 'date'): string {
  const patterns = LONG[kind] as Record<string, string>;
  return format(new Date(d), patterns[lang()] ?? patterns.pt, { locale: dateLocale() });
}
