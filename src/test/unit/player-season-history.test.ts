import { describe, it, expect } from 'vitest';
import {
  aggregateLiveBySeason,
  mergeSeasonHistory,
} from '@/lib/player-season-history-service';

const S1 = '11111111-1111-1111-1111-111111111111'; // 2025/2026
const S2 = '22222222-2222-2222-2222-222222222222'; // 2026/2027
const names = { [S1]: '2025/2026', [S2]: '2026/2027' };

function liveFixture() {
  return aggregateLiveBySeason(
    {
      lineups: [
        { season_id: S1, minutes_played: 90, is_starter: true },
        { season_id: S1, minutes_played: 80, is_starter: true },
        { season_id: S1, minutes_played: 60, is_starter: false },
        { season_id: S1, minutes_played: 120, is_starter: true },
        { season_id: S1, minutes_played: 150, is_starter: true },
        { season_id: S1, minutes_played: 120, is_starter: false },
        { season_id: null, minutes_played: 999, is_starter: true },
      ],
      attendance: [
        { season_id: S1, present: true },
        { season_id: S1, present: false },
      ],
      events: [
        { season_id: S1, event_type: 'goal' },
        { season_id: S1, event_type: 'yellow_card' },
        { season_id: S1, event_type: 'goal', is_assist: true },
      ],
      evaluations: [
        { season_id: S1, overall_rating: 6, strengths: 'a', weaknesses: 'b', evaluation_date: '2026-01-10' },
        { season_id: S1, overall_rating: 8, strengths: 'novo', weaknesses: 'foco', evaluation_date: '2026-05-10' },
      ],
    },
    names,
  );
}

describe('histórico por época do jogador', () => {
  it('agrega 6 jogos e 620 minutos em 2025/2026', () => {
    const row = liveFixture().get(S1)!;
    expect(row.games).toBe(6);
    expect(row.minutes).toBe(620);
    expect(row.starts).toBe(4);
    expect(row.goals).toBe(1);
    expect(row.assists).toBe(1);
    expect(row.yellowCards).toBe(1);
    expect(row.trainingsPresent).toBe(1);
    expect(row.trainingsTotal).toBe(2);
    expect(row.attendanceRate).toBe(50);
    expect(row.avgOverall).toBe(7);
    expect(row.evaluationsCount).toBe(2);
    expect(row.strengths).toBe('novo');
  });

  it('a nova época começa a zero (sem registos não aparece)', () => {
    expect(liveFixture().get(S2)).toBeUndefined();
  });

  it('registos sem época nunca são atribuídos a uma época', () => {
    const live = liveFixture();
    const total = Array.from(live.values()).reduce((s, r) => s + r.minutes, 0);
    expect(total).toBe(620); // os 999' sem season_id ficam de fora
  });

  it('mostra uma linha por época e prefere o snapshot quando existe', () => {
    const live = liveFixture();
    const rows = mergeSeasonHistory(
      [
        { id: S1, name: '2025/2026' },
        { id: S2, name: '2026/2027' },
      ],
      [
        {
          season_id: S1,
          season_label: '2025/2026',
          games_count: 6,
          minutes_total: 620,
          starts_count: 4,
          trainings_total: 40,
          trainings_present: 36,
          attendance_rate: 90,
          goals: 3,
          assists: 2,
          yellow_cards: 1,
          red_cards: 0,
          avg_overall: 7.5,
          evaluations_count: 2,
          age_group: 'Sub-15',
          predominant_role: 'MC',
          minutes_by_role: { MC: 500 },
          strengths_summary: 'x',
          improvements_summary: 'y',
        },
      ],
      live,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('snapshot');
    expect(rows[0].goals).toBe(3);
    expect(rows[0].attendanceRate).toBe(90);
    expect(rows[0].predominantRole).toBe('MC');
  });

  it('mantém estado e equipa explícitos no snapshot fechado', () => {
    const rows = mergeSeasonHistory(
      [{ id: S1, name: '2025/2026', status: 'closed' }],
      [{ season_id: S1, season_label: '2025/2026', team_id: 'team-1', games_count: 33, minutes_total: 931 }],
      new Map(),
      { 'team-1': 'Sub-15 A' },
    );
    expect(rows[0]).toMatchObject({
      seasonLabel: '2025/2026',
      seasonStatus: 'closed',
      teamName: 'Sub-15 A',
      games: 33,
      minutes: 931,
    });
  });

  it('usa o cálculo on-the-fly quando não há snapshot', () => {
    const rows = mergeSeasonHistory([{ id: S1, name: '2025/2026' }], [], liveFixture());
    expect(rows[0].source).toBe('live');
    expect(rows[0].minutes).toBe(620);
  });

  it('gerar o snapshot duas vezes não duplica linhas', () => {
    const snap = { season_id: S1, season_label: '2025/2026', games_count: 6, minutes_total: 620 };
    const rows = mergeSeasonHistory([{ id: S1, name: '2025/2026' }], [snap, { ...snap }], liveFixture());
    expect(rows).toHaveLength(1);
  });

  it('ordena as épocas da mais recente para a mais antiga', () => {
    const live = aggregateLiveBySeason(
      {
        lineups: [
          { season_id: S1, minutes_played: 10, is_starter: true },
          { season_id: S2, minutes_played: 20, is_starter: true },
        ],
        attendance: [],
        events: [],
        evaluations: [],
      },
      names,
    );
    const rows = mergeSeasonHistory(
      [
        { id: S1, name: '2025/2026' },
        { id: S2, name: '2026/2027' },
      ],
      [],
      live,
    );
    expect(rows.map((r) => r.seasonLabel)).toEqual(['2026/2027', '2025/2026']);
  });
});
