import { describe, it, expect } from 'vitest';
import { reconcileTactics, applySubstitution, swapSlots, estimateFreshness, defaultFormationCode } from '@/lib/live-tactics';
import { getFormation, listAvailableFormations } from '@/lib/tactical-formations';

const f7 = [
  { player_id: 'gk', position: 'GK' },
  { player_id: 'lb', position: 'LB' },
  { player_id: 'cb', position: 'CB' },
  { player_id: 'rb', position: 'RB' },
  { player_id: 'cm', position: 'CM' },
  { player_id: 'lw', position: 'LW' },
  { player_id: 'st', position: 'ST' },
];

describe('live tactics', () => {
  it('has formations for every modality', () => {
    for (const s of ['football_5', 'football_7', 'football_9', 'football_11', 'futsal']) {
      expect(listAvailableFormations(s).length, s).toBeGreaterThan(0);
      expect(defaultFormationCode(s)).toBeTruthy();
    }
  });

  it('places every on-field player once, goalkeeper in goal', () => {
    const t = reconcileTactics('football_7', null, f7)!;
    const formation = getFormation('football_7', t.formation)!;
    const gkSlot = formation.slots.find((s) => s.role === 'goalkeeper')!;
    expect(t.slots[gkSlot.slot_id]).toBe('gk');
    const placed = Object.values(t.slots).filter(Boolean);
    expect(new Set(placed).size).toBe(7);
  });

  it('substitute takes the slot of the player who left', () => {
    const t = reconcileTactics('football_7', null, f7)!;
    const slotOfSt = Object.keys(t.slots).find((k) => t.slots[k] === 'st')!;
    const after = applySubstitution(t, 'st', 'new');
    expect(after.slots[slotOfSt]).toBe('new');
  });

  it('keeps placements after reconcile and fills gaps', () => {
    const t = reconcileTactics('football_7', null, f7)!;
    const [a, b] = Object.keys(t.slots).filter((k) => t.slots[k] !== 'gk');
    const swapped = swapSlots(t, a, b);
    const again = reconcileTactics('football_7', swapped, f7)!;
    expect(again.slots[a]).toBe(swapped.slots[a]);
    // a player leaves without a recorded replacement: slot is refilled by someone new
    const next = reconcileTactics('football_7', again, [...f7.filter((p) => p.player_id !== 'cm'), { player_id: 'x', position: 'CM' }])!;
    expect(Object.values(next.slots)).toContain('x');
    expect(Object.values(next.slots)).not.toContain('cm');
  });

  it('11-a-side friendly with an F7 team uses an F11 formation', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => ({ player_id: `p${i}`, position: i === 0 ? 'GK' : 'CM' }));
    const t = reconcileTactics('football_11', null, eleven)!;
    expect(Object.values(t.slots).filter(Boolean)).toHaveLength(11);
  });

  it('freshness drops on the field and recovers on the bench', () => {
    expect(estimateFreshness([], 600)).toBe(100);
    const tired = estimateFreshness([{ from: 0, to: 1500 }], 1500); // 25 min non-stop
    expect(tired).toBeLessThan(70);
    const rested = estimateFreshness([{ from: 0, to: 1500 }], 1500 + 300); // 5 min on the bench
    expect(rested).toBeGreaterThan(tired);
  });
});
