/**
 * The app in Spanish and French: texts, written-out dates, number formats and the short position
 * labels follow the chosen language. German and Chinese are hidden for now: choosing them is not offered.
 */
import { afterAll, describe, expect, it } from 'vitest';
import i18n, { READY_LANGUAGES } from '@/lib/i18n';
import { intlLocale, longDate, monthNames, tx } from '@/lib/i18n/ui';
import { shortPositionLabel } from '@/lib/tactical-formations';

const day = new Date(2026, 2, 12, 18, 30);

describe('other languages', () => {
  afterAll(() => i18n.changeLanguage('pt'));

  it('offers Portuguese, English, Spanish and French', () => {
    expect([...READY_LANGUAGES]).toEqual(['pt', 'en', 'es', 'fr']);
  });

  it('Spanish', async () => {
    await i18n.changeLanguage('es');
    expect(tx('Guardar')).toBe('Guardar');
    expect(tx('Novo jogador')).toBe('Nuevo jugador');
    expect(longDate(day)).toBe('12 de marzo de 2026');
    expect(shortPositionLabel('GR')).toBe('POR');
    expect(intlLocale()).toBe('es-ES');
  });

  it('French', async () => {
    await i18n.changeLanguage('fr');
    expect(tx('Guardar')).toBe('Enregistrer');
    expect(tx('Novo jogador')).toBe('Nouveau joueur');
    expect(tx('{{n}} jogadores', { n: 7 })).toBe('7 joueurs');
    expect(longDate(day)).toBe('12 mars 2026');
    expect(longDate(day, 'weekdayTime')).toBe('jeudi 12 mars à 18:30');
    expect(monthNames()[0]).toBe('Janvier');
    expect(shortPositionLabel('PL')).toBe('BU');
    expect(intlLocale()).toBe('fr-FR');
  });

  it('Portuguese stays as written', async () => {
    await i18n.changeLanguage('pt');
    expect(tx('Novo jogador')).toBe('Novo jogador');
    expect(longDate(day, 'weekdayTime')).toBe('quinta-feira, 12 de março às 18:30');
  });
});
