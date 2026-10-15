import { describe, it, expect } from 'vitest';
import { buildCallupPdf, callupFileName, callupLayout, partsText, type CallupGroup } from '@/lib/callup-pdf';

const players = (n: number, from = 1) => Array.from({ length: n }, (_, i) => ({ name: `Jogador ${from + i}`, number: from + i, position: 'CM' }));
const groups = (sizes: number[]): CallupGroup[] => sizes.map((n, i) => ({ label: `Grupo ${i}`, players: players(n, i * 10 + 1) }));

describe('call-up PDF', () => {
  it('writes the game time as the coach reads it', () => {
    expect(partsText([15, 15, 30])).toBe("15' + 15' + 30' (60')");
    expect(partsText(null)).toBeNull();
  });

  it('splits the players in two columns without breaking a group', () => {
    const { columns } = callupLayout(groups([2, 6, 6, 5, 0]));
    expect(columns[0].map((g) => g.label)).toEqual(['Grupo 0', 'Grupo 1']);
    expect(columns[1].map((g) => g.label)).toEqual(['Grupo 2', 'Grupo 3']);
  });

  it('shrinks the lines so even a big call-up fits one page', () => {
    const small = callupLayout(groups([2, 4, 4, 3]));
    const big = callupLayout(groups([4, 12, 12, 10]));
    expect(big.lineHeight).toBeLessThan(small.lineHeight);
    const perColumn = Math.max(...big.columns.map((c) => c.reduce((n, g) => n + g.players.length + 1, 0)));
    expect(perColumn * big.lineHeight).toBeLessThanOrEqual(170 + 0.001);
  });

  it('makes one page, also with 30 players, and a clean file name', () => {
    const sheet = { teamName: 'Sub 13', category: 'Sub-13', opponent: 'S. Mamede', matchDate: '2026-10-17T09:30:00Z', isHome: true, location: 'Tamanca', competition: 'Amigável', arrivalTime: '09:45', parts: [25, 25, 25], groups: groups([3, 9, 9, 9]) };
    const doc = buildCallupPdf(sheet);
    expect(doc.getNumberOfPages()).toBe(1);
    expect(callupFileName(sheet)).toBe('convocatoria-sub-13-vs-s-mamede-2026-10-17.pdf');
  });
});
