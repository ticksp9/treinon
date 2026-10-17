import { describe, it, expect } from 'vitest';
import { orderByPosition, partLineup, shortName, zoneOfPosition } from '@/lib/report-lineup';

const pos: Record<string, string> = { gk: 'GK', d1: 'CB', d2: 'LB', d3: 'RB', m1: 'CM', m2: 'CDM', m3: 'CAM', f1: 'ST', f2: 'LW' };
const positionOf = (id: string) => pos[id];

describe('report line-up', () => {
  it('fits the starters of a part into the formation, goalkeeper in goal', () => {
    const l = partLineup('football_9', 1, null, { formation: '3-3-2', slots: {} }, Object.keys(pos), positionOf)!;
    expect(l.formation).toBe('3-3-2');
    expect(l.estimated).toBe(true);
    expect(l.spots).toHaveLength(9);
    expect(l.spots.find((s) => s.role === 'goalkeeper')?.playerId).toBe('gk');
    expect(new Set(l.spots.map((s) => s.playerId)).size).toBe(9);
  });

  it('uses the tactic saved when the part started', () => {
    const saved = { 2: { formation: '3-3-2', slots: { GK: 'gk' } } };
    const l = partLineup('football_9', 2, saved, null, ['gk'], positionOf)!;
    expect(l.estimated).toBe(false);
    expect(l.spots.find((s) => s.slotId === 'GK')?.playerId).toBe('gk');
  });

  it('lists goalkeeper, defenders, midfielders, forwards', () => {
    const ids = ['f1', 'm1', 'gk', 'd2', 'f2', 'd1', 'm3', 'd3', 'm2'];
    const order = orderByPosition(ids, null, positionOf);
    expect(order.map((id) => zoneOfPosition(pos[id]))).toEqual([0, 1, 1, 1, 2, 2, 2, 3, 3]);
    const l = partLineup('football_9', 1, null, null, ids, positionOf);
    const onPitch = orderByPosition(ids, l, positionOf);
    expect(onPitch[0]).toBe('gk');
    expect(onPitch.slice(-2).sort()).toEqual(['f1', 'f2']);
  });

  it('shortens names for the drawing', () => {
    expect(shortName('Rodrigo Durães')).toBe('Rodrigo D.');
    expect(shortName('Abraham')).toBe('Abraham');
  });
});
