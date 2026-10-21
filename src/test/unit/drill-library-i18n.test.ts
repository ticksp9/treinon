/**
 * The drill and session library is written in Portuguese and shown through tx(): every text needs
 * its translation in each language, and the library objects must show the chosen language.
 */
import { afterAll, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { DRILLS as PT_DRILLS } from '@/lib/drill-library/drills';
import { SESSION_PLANS as PT_PLANS, AGE_GUIDES as PT_GUIDES } from '@/lib/drill-library/sessions';
import { AGE_GUIDES, DRILLS, DRILL_CATEGORIES, EQUIPMENT_LABELS, SESSION_PLANS, drillToText } from '@/lib/drill-library';
import en from '@/lib/i18n/locales/ui.en.json';
import es from '@/lib/i18n/locales/ui.es.json';
import de from '@/lib/i18n/locales/ui.de.json';
import zh from '@/lib/i18n/locales/ui.zh.json';

function texts(): string[] {
  const out = new Set<string>();
  const add = (s?: string) => { if (s) out.add(s); };
  for (const d of PT_DRILLS) {
    [d.name, d.objective, d.setup, d.space].forEach(add);
    [...d.howTo, ...d.coachingPoints, ...(d.progressions ?? [])].forEach(add);
    for (const e of d.diagram) { if ('label' in e) add(e.label); if ('text' in e) add(e.text); }
  }
  for (const p of PT_PLANS) { [p.name, p.theme, p.summary].forEach(add); p.blocks.forEach((b) => add(b.note)); }
  for (const g of PT_GUIDES) { [g.format, g.sessionShape, ...g.priorities, ...g.avoid].forEach(add); }
  return [...out];
}

describe('drill library in every language', () => {
  afterAll(() => i18n.changeLanguage('pt'));

  for (const [code, dict] of Object.entries({ en, es, de, zh } as Record<string, Record<string, string>>)) {
    it(`has every text in ${code}`, () => {
      expect(texts().filter((t) => !(t in dict))).toEqual([]);
    });
  }

  it('shows the chosen language', async () => {
    const i = PT_DRILLS.findIndex((d) => d.id === 'semaforo');
    await i18n.changeLanguage('de');
    expect(DRILLS[i].name).toBe('Ampel mit Ball');
    expect(DRILLS[i].howTo[0]).toMatch(/^Grün/);
    expect(DRILL_CATEGORIES[0].label).toBe('Aufwärmen');
    expect(EQUIPMENT_LABELS.bolas).toBe('Bälle');
    expect(drillToText(DRILLS[i])).toContain('Ablauf:');
    await i18n.changeLanguage('es');
    expect(SESSION_PLANS[0].name).toBe(es[PT_PLANS[0].name as keyof typeof es]);
    expect(AGE_GUIDES[0].priorities[0]).toBe('Un balón por niño siempre que sea posible');
    await i18n.changeLanguage('pt');
    expect(DRILLS[i].name).toBe('Semáforo com bola');
  });
});
