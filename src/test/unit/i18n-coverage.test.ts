/**
 * Every text passed to t('…') / tx('…') / tr('…') in a translated screen must have its translation
 * in every language (src/lib/i18n/locales/ui.<lang>.json), otherwise it would show in Portuguese,
 * and the placeholders ({{n}}) must be the same.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import en from '@/lib/i18n/locales/ui.en.json';
import es from '@/lib/i18n/locales/ui.es.json';
import fr from '@/lib/i18n/locales/ui.fr.json';

const ROOT = join(__dirname, '..', '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'test' ? [] : files(p);
    return /\.(tsx?|ts)$/.test(n) ? [p] : [];
  });
}

const CALL = /\b(?:t|tx|tr)\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;
const unescape = (s: string) => s.replace(/\\(['"\\])/g, '$1').replace(/\\n/g, '\n');

function used(): Map<string, string> {
  const out = new Map<string, string>();
  for (const f of files(ROOT)) {
    const src = readFileSync(f, 'utf8');
    if (!/from '@\/lib\/i18n\/ui'/.test(src)) continue;
    for (const m of src.matchAll(CALL)) out.set(unescape(m[2]), f.replace(ROOT, 'src'));
  }
  return out;
}

const LANGS: Record<string, Record<string, string>> = { en, es, fr };

describe('translation of the screens', () => {
  const texts = used();

  it('finds the translated screens', () => {
    expect(texts.size).toBeGreaterThan(50);
  });

  for (const [code, dict] of Object.entries(LANGS)) {
    it(`every text has its ${code} translation`, () => {
      const missing = [...texts].filter(([k]) => !(k in dict)).map(([k, f]) => `${f}: ${k}`);
      expect(missing).toEqual([]);
    });

    it(`placeholders match in ${code}`, () => {
      const vars = (s: string) => [...s.matchAll(/{{s*(w+)s*}}/g)].map((m) => m[1]).sort().join(',');
      const bad = [...texts.keys()].filter((k) => k in dict && vars(k) !== vars(dict[k]));
      expect(bad).toEqual([]);
    });
  }
});
