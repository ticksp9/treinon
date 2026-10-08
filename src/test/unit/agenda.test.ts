import { describe, it, expect } from 'vitest';
import { buildAgenda, dayLabel, eventShareText, groupByDay, splitAgenda, timeLabel } from '@/lib/agenda';

const now = new Date('2026-10-08T15:00:00');
const teamNames = { t1: 'Sub-13' };

const agenda = buildAgenda({
  teamNames,
  calledUpMatchIds: new Set(['m1']),
  matches: [
    { id: 'm1', match_date: '2026-10-10T10:30:00', opponent_name: 'Rival FC', is_home: true, location: null, team_id: 't1', status: 'scheduled' },
    { id: 'm0', match_date: '2026-10-03T10:30:00', opponent_name: 'Antigo', is_home: false, location: 'Campo X', team_id: 't1', status: 'completed' },
  ],
  trainings: [
    { id: 'tr1', name: '', training_date: '2026-10-08T09:00:00', team_id: 't1' },
    { id: 'tr2', name: 'Sem data', training_date: null, team_id: 't1' },
  ],
  events: [
    { id: 'e1', owner_id: 'u1', club_id: 'c1', team_id: null, title: 'Jantar de Natal', description: 'Trazer sobremesa', kind: 'social', starts_at: '2026-10-10T20:00:00', ends_at: '2026-10-10T23:00:00', location: 'Sede' },
    { id: 'e2', owner_id: 'u1', club_id: null, team_id: null, title: 'Convívio', description: null, kind: 'estranho', starts_at: '2026-10-07T18:00:00', ends_at: '2026-10-09T12:00:00', location: null },
  ],
});

describe('family agenda', () => {
  it('puts matches, trainings and events in date order with clear titles', () => {
    expect(agenda.map((i) => i.id)).toEqual(['m0', 'e2', 'tr1', 'm1', 'e1']);
    const m1 = agenda.find((i) => i.id === 'm1')!;
    expect(m1.title).toBe('Sub-13 vs Rival FC');
    expect(m1.location).toBe('Casa');
    expect(m1.calledUp).toBe(true);
    expect(agenda.find((i) => i.id === 'm0')!.title).toBe('Antigo vs Sub-13');
    expect(agenda.find((i) => i.id === 'tr1')!.title).toBe('Treino');
    expect(agenda.find((i) => i.id === 'e1')!.scope).toBe('Todo o clube');
    expect(agenda.find((i) => i.id === 'e2')!.scope).toBe('Todas as equipas');
    expect(agenda.find((i) => i.id === 'e2')!.eventKind).toBe('other');
  });

  it('today counts as upcoming, even this morning; an event still running too', () => {
    const { upcoming, past } = splitAgenda(agenda, now);
    expect(upcoming.map((i) => i.id)).toEqual(['e2', 'tr1', 'm1', 'e1']);
    expect(past.map((i) => i.id)).toEqual(['m0']);
  });

  it('groups by day with friendly labels', () => {
    const days = groupByDay(splitAgenda(agenda, now).upcoming);
    expect(days.map((d) => d.items.length)).toEqual([1, 1, 2]);
    expect(dayLabel(days[1].day, now)).toBe('Hoje · quinta-feira, 8 de outubro');
    expect(dayLabel(new Date('2026-10-09T08:00:00'), now).startsWith('Amanhã')).toBe(true);
    expect(dayLabel(days[2].day, now)).toBe('Sábado, 10 de outubro');
  });

  it('shows times and writes the event for WhatsApp', () => {
    const e1 = agenda.find((i) => i.id === 'e1')!;
    expect(timeLabel(e1)).toBe('20:00–23:00');
    expect(timeLabel(agenda.find((i) => i.id === 'e2')!)).toBe('18:00 até 9 out 12:00');
    const text = eventShareText(e1);
    expect(text).toContain('*Jantar de Natal* · Todo o clube');
    expect(text).toContain('sábado, 10 de outubro · 20:00–23:00');
    expect(text).toContain('📍 Sede');
    expect(text).toContain('Trazer sobremesa');
  });
});
