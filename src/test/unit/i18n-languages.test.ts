/**
 * The app in Spanish, German and Chinese: texts, written-out dates, number formats and the short
 * position labels follow the chosen language; PDFs built in Chinese come out in English (jsPDF has
 * no Chinese font).
 */
import { afterAll, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { inPdfLanguage, intlLocale, longDate, tx } from '@/lib/i18n/ui';
import { shortPositionLabel } from '@/lib/tactical-formations';

const day = new Date(2026, 2, 12, 18, 30);

describe('other languages', () => {
  afterAll(() => i18n.changeLanguage('pt'));

  it('Spanish', async () => {
    await i18n.changeLanguage('es');
    expect(tx('Guardar')).toBe('Guardar');
    expect(tx('Novo jogador')).toBe('Nuevo jugador');
    expect(longDate(day)).toBe('12 de marzo de 2026');
    expect(shortPositionLabel('GR')).toBe('POR');
    expect(intlLocale()).toBe('es-ES');
  });

  it('German', async () => {
    await i18n.changeLanguage('de');
    expect(tx('Novo jogador')).toBe('Neuer Spieler');
    expect(tx('{{n}} jogadores', { n: 7 })).toBe('7 Spieler');
    expect(longDate(day)).toBe('12. März 2026');
    expect(shortPositionLabel('PL')).toBe('ST');
  });

  it('Chinese, and its PDFs in English', async () => {
    await i18n.changeLanguage('zh');
    expect(tx('Novo jogador')).toBe('新球员');
    expect(longDate(day)).toBe('2026年3月12日');
    expect(inPdfLanguage(() => [tx('Novo jogador'), longDate(day)])).toEqual(['New player', '12 March 2026']);
    // back to Chinese once the PDF is built
    expect(tx('Novo jogador')).toBe('新球员');
  });

  it('Portuguese stays as written', async () => {
    await i18n.changeLanguage('pt');
    expect(tx('Novo jogador')).toBe('Novo jogador');
    expect(longDate(day, 'weekdayTime')).toBe('quinta-feira, 12 de março às 18:30');
  });
});
