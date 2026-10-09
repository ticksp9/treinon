import { describe, it, expect } from 'vitest';
import { buildHistory, summarizeAbsences } from '@/components/players/PlayerFMCard';

describe('player history per season', () => {
  it('groups games, minutes, goals, assists and cards by season and team', () => {
    const h = buildHistory(
      [
        { match_id: 'm1', minutes: 40, starter: true, rating: 7, date: '2026-09-20', team: 'Sub-13' },
        { match_id: 'm2', minutes: 20, starter: false, rating: 8, date: '2026-10-04', team: 'Sub-13' },
        { match_id: 'm3', minutes: 0, starter: false, rating: null, date: '2026-10-11', team: 'Sub-13' }, // called up, did not play
        { match_id: 'm4', minutes: 50, starter: true, rating: null, date: '2026-03-01', team: 'Sub-12' }, // previous season
      ],
      [
        { match_id: 'm1', type: 'goal', scorer: true, assist: false },
        { match_id: 'm2', type: 'goal', scorer: false, assist: true },
        { match_id: 'm2', type: 'yellow_card', scorer: true, assist: false },
        { match_id: 'm4', type: 'goal', scorer: true, assist: false },
      ],
    );
    expect(h).toHaveLength(2);
    expect(h[0]).toMatchObject({ season: '2026/2027', team: 'Sub-13', games: 2, starts: 1, minutes: 60, goals: 1, assists: 1, yellow: 1, rated: 2, ratingSum: 15 });
    expect(h[1]).toMatchObject({ season: '2025/2026', team: 'Sub-12', games: 1, goals: 1 });
  });
});

describe('matches missed', () => {
  it('counts the absences of this player by reason, newest first', () => {
    const s = summarizeAbsences([
      { match_date: '2026-09-20', opponent_name: 'A', absences: { p1: 'Doença', p2: 'Lesão' } },
      { match_date: '2026-10-04', opponent_name: 'B', absences: { p1: '' } },
      { match_date: '2026-09-27', opponent_name: 'C', absences: { p1: 'Doença' } },
      { match_date: '2026-09-13', opponent_name: 'D', absences: { p2: 'Doença' } },
      { match_date: '2026-09-06', opponent_name: 'E', absences: null },
    ], 'p1');
    expect(s.total).toBe(3);
    expect(s.list.map((l) => l.opponent)).toEqual(['B', 'C', 'A']);
    expect(s.byReason).toEqual([['Doença', 2], ['Sem motivo indicado', 1]]);
  });
});
