import { describe, it, expect } from 'vitest';
import { orderForNotes } from '@/components/matches/OurPlayerNotes';

const l = (id: string, number: number | null, minutes: number | null) => ({ player_id: id, minutes_played: minutes, player: { name: id, number } });

describe('notes about our players in the match report', () => {
  it('lists who played first, then by shirt number, each player once', () => {
    const out = orderForNotes([l('bench', 2, 0), l('nine', 9, 40), l('one', 1, 60), l('nine', 9, 40), l('none', null, null)]);
    expect(out.map((r) => r.player_id)).toEqual(['one', 'nine', 'bench', 'none']);
  });
});
