import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LivePitch, type PitchPlayerInfo } from '@/components/matches/LivePitch';
import { reconcileTactics } from '@/lib/live-tactics';

const onField = [
  { player_id: 'gk', position: 'GK', name: 'Rui Guarda' },
  { player_id: 'd1', position: 'CB', name: 'Tiago Silva' },
  { player_id: 'd2', position: 'LB', name: 'Pedro Costa' },
  { player_id: 'm1', position: 'CM', name: 'João Mota' },
  { player_id: 'm2', position: 'RM', name: 'André Reis' },
  { player_id: 'a1', position: 'ST', name: 'Diogo Alves' },
  { player_id: 'a2', position: 'LW', name: 'Hugo Sá' },
];
const benchInfo = [{ player_id: 'b1', name: 'Nuno Lopes' }];

function setup() {
  const tactics = reconcileTactics('football_7', null, onField)!;
  const players = new Map<string, PitchPlayerInfo>(
    [...onField, ...benchInfo].map((p, i) => [p.player_id, {
      player_id: p.player_id, name: p.name, number: i + 1, seconds: 600, freshness: 80, goals: 0, yellow: 0, red: 0,
    }]),
  );
  const handlers = { onFormationChange: vi.fn(), onSwap: vi.fn(), onSubstitute: vi.fn(), onEvent: vi.fn() };
  render(<LivePitch sportType="football_7" tactics={tactics} players={players} bench={['b1']} {...handlers} />);
  return { tactics, handlers };
}

describe('LivePitch', () => {
  it('shows every player on the field by name', () => {
    setup();
    expect(screen.getByText('Rui G.')).toBeInTheDocument();
    expect(screen.getByText('Diogo A.')).toBeInTheDocument();
    expect(screen.getByText('Nuno L.')).toBeInTheDocument(); // bench
  });

  it('pitch → pitch swaps positions', () => {
    const { handlers } = setup();
    fireEvent.click(screen.getByLabelText(/Tiago Silva/));
    fireEvent.click(screen.getByLabelText(/João Mota/));
    expect(handlers.onSwap).toHaveBeenCalledTimes(1);
  });

  it('pitch → bench substitutes (out, in)', () => {
    const { handlers } = setup();
    fireEvent.click(screen.getByLabelText(/Diogo Alves/));
    fireEvent.click(screen.getByText('Nuno L.'));
    expect(handlers.onSubstitute).toHaveBeenCalledWith('a1', 'b1');
  });

  it('bench → pitch substitutes too', () => {
    const { handlers } = setup();
    fireEvent.click(screen.getByText('Nuno L.'));
    fireEvent.click(screen.getByLabelText(/Hugo Sá/));
    expect(handlers.onSubstitute).toHaveBeenCalledWith('a2', 'b1');
  });

  it('selected player → goal', () => {
    const { handlers } = setup();
    fireEvent.click(screen.getByLabelText(/Diogo Alves/));
    fireEvent.click(screen.getByText('⚽ Golo'));
    expect(handlers.onEvent).toHaveBeenCalledWith('goal', 'a1');
  });
});
