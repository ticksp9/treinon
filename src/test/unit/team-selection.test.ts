import { describe, it, expect } from 'vitest';
import { pickStartingXI, assistantReport, type Candidate } from '@/lib/team-selection';
import { listAvailableFormations } from '@/lib/tactical-formations';

const f7 = listAvailableFormations('football_7')[0];

const squad: Candidate[] = [
  { player_id: 'gk1', name: 'Rui Gomes', position: 'GK', ability: 6, seasonMinutes: 300 },
  { player_id: 'gk2', name: 'Tomás Reis', position: 'GK', ability: 5, seasonMinutes: 20 },
  { player_id: 'd1', name: 'Ana', position: 'CB', ability: 8, seasonMinutes: 300 },
  { player_id: 'd2', name: 'Bia', position: 'LB', ability: 7, seasonMinutes: 280 },
  { player_id: 'd3', name: 'Caio', position: 'RB', ability: 5, seasonMinutes: 40 },
  { player_id: 'm1', name: 'Dani', position: 'CM', ability: 8, seasonMinutes: 310 },
  { player_id: 'm2', name: 'Edu', position: 'CM', ability: 4, seasonMinutes: 30 },
  { player_id: 'a1', name: 'Filipe', position: 'ST', ability: 9, seasonMinutes: 320 },
  { player_id: 'a2', name: 'Gil', position: 'LW', ability: 6, seasonMinutes: 150 },
  { player_id: 'a3', name: 'Hugo', position: 'RW', ability: 4, seasonMinutes: 10 },
];

describe('automatic team selection', () => {
  it('fills every slot with exactly one goalkeeper in goal', () => {
    const r = pickStartingXI('football_7', f7.code, squad, 'best')!;
    expect(r.starterIds).toHaveLength(f7.slots.length);
    const gkSlot = f7.slots.find((s) => s.role === 'goalkeeper')!;
    expect(['gk1', 'gk2']).toContain(r.tactics.slots[gkSlot.slot_id]);
    expect(r.starterIds.filter((id) => id.startsWith('gk'))).toHaveLength(1);
  });

  it('best XI prefers the strongest players', () => {
    const r = pickStartingXI('football_7', f7.code, squad, 'best')!;
    expect(r.starterIds).toContain('a1');
    expect(r.starterIds).toContain('gk1');
    expect(r.starterIds).not.toContain('a3');
  });

  it('fair XI gives the pitch to who played least', () => {
    const r = pickStartingXI('football_7', f7.code, squad, 'fair')!;
    expect(r.starterIds).toContain('gk2');
    expect(r.starterIds).toContain('a3');
    expect(r.starterIds).toContain('m2');
    expect(r.starterIds).not.toContain('a1');
  });

  it('keeps captain and set-piece takers', () => {
    const r = pickStartingXI('football_7', f7.code, squad, 'best', { captain: 'd1' })!;
    expect(r.tactics.roles?.captain).toBe('d1');
  });

  it('assistant flags low minutes and a missing goalkeeper', () => {
    const r = pickStartingXI('football_7', f7.code, squad, 'best')!;
    const notes = assistantReport(squad, r.starterIds, 7).map((n) => n.text).join(' | ');
    expect(notes).toMatch(/poucos minutos/);
    const noGk = assistantReport(squad.filter((c) => c.position !== 'GK'), [], 7).map((n) => n.text).join(' ');
    expect(noGk).toMatch(/guarda-redes/);
  });
});
