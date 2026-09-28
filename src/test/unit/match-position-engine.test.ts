import { describe, expect, it } from 'vitest';
import {
  runMatchPositionEngine,
  validatePositionMinutesAgainstOnField,
  predominantRoleByPlayer,
  type MatchFormationLite,
  type PlayerPositionInterval,
} from '@/lib/match-position-engine';

const formation433: MatchFormationLite = {
  id: 'f1',
  match_id: 'm1',
  formation_code: '4-3-3',
  formation_name: '4-3-3',
  sport_type: 'football_11',
  starts_at_minute_abs: 0,
  ends_at_minute_abs: null,
  part_index: 1,
};

const formation343: MatchFormationLite = {
  id: 'f2',
  match_id: 'm1',
  formation_code: '3-4-3',
  formation_name: '3-4-3',
  sport_type: 'football_11',
  starts_at_minute_abs: 30,
  ends_at_minute_abs: null,
  part_index: 1,
};

function mkIv(over: Partial<PlayerPositionInterval>): PlayerPositionInterval {
  return {
    playerId: 'p',
    formationId: 'f1',
    slotId: 'CM',
    role: 'midfielder_center',
    partIndex: 1,
    startMinuteAbs: 0,
    endMinuteAbs: null,
    source: 'initial_lineup',
    ...over,
  };
}

describe('match-position-engine', () => {
  it('simple 4-3-3 without changes: starter occupies slot for full match', () => {
    const intervals = [
      mkIv({ playerId: 'p1', slotId: 'GK', role: 'goalkeeper' }),
      mkIv({ playerId: 'p2', slotId: 'CM', role: 'midfielder_center' }),
    ];
    const res = runMatchPositionEngine({
      formations: [formation433],
      positionEvents: intervals,
      matchEndMinuteAbs: 90,
    });
    expect(res.minutesByPlayerByRole.get('p1')?.get('goalkeeper')).toBe(90);
    expect(res.minutesByPlayerByRole.get('p2')?.get('midfielder_center')).toBe(90);
    expect(res.warnings).toHaveLength(0);
  });

  it('formation change at 30: closes old interval and opens new one', () => {
    const intervals = [
      mkIv({ playerId: 'p1', formationId: 'f1', slotId: 'LW', role: 'winger_left', startMinuteAbs: 0, endMinuteAbs: 30 }),
      mkIv({
        playerId: 'p1', formationId: 'f2', slotId: 'LM', role: 'midfielder_left',
        startMinuteAbs: 30, endMinuteAbs: null, source: 'formation_change',
      }),
    ];
    const res = runMatchPositionEngine({
      formations: [formation433, formation343],
      positionEvents: intervals,
      matchEndMinuteAbs: 90,
    });
    const roleMap = res.minutesByPlayerByRole.get('p1')!;
    expect(roleMap.get('winger_left')).toBe(30);
    expect(roleMap.get('midfielder_left')).toBe(60);
    expect(Array.from(roleMap.values()).reduce((s, v) => s + v, 0)).toBe(90);
  });

  it('substitution to different slot: incoming player gets new slot', () => {
    const intervals = [
      mkIv({ playerId: 'out', slotId: 'ST', role: 'striker', startMinuteAbs: 0, endMinuteAbs: 60 }),
      mkIv({
        playerId: 'in', slotId: 'LW', role: 'winger_left',
        startMinuteAbs: 60, endMinuteAbs: null, source: 'substitution_in',
      }),
    ];
    const res = runMatchPositionEngine({
      formations: [formation433],
      positionEvents: intervals,
      matchEndMinuteAbs: 90,
    });
    expect(res.minutesByPlayerByRole.get('out')?.get('striker')).toBe(60);
    expect(res.minutesByPlayerByRole.get('in')?.get('winger_left')).toBe(30);
  });

  it('player_move without substitution: closes old, opens new for same player', () => {
    const intervals = [
      mkIv({ playerId: 'p1', slotId: 'CM', role: 'midfielder_center', startMinuteAbs: 0, endMinuteAbs: 45 }),
      mkIv({
        playerId: 'p1', slotId: 'RW', role: 'winger_right',
        startMinuteAbs: 45, endMinuteAbs: null, source: 'tactical_move',
      }),
    ];
    const res = runMatchPositionEngine({
      formations: [formation433],
      positionEvents: intervals,
      matchEndMinuteAbs: 90,
    });
    const total = Array.from(res.minutesByPlayerByRole.get('p1')!.values()).reduce((s, v) => s + v, 0);
    expect(total).toBe(90);
    expect(res.minutesByPlayerByRole.get('p1')!.get('midfielder_center')).toBe(45);
    expect(res.minutesByPlayerByRole.get('p1')!.get('winger_right')).toBe(45);
  });

  it('validator: sum of role minutes equals on-field minutes', () => {
    const intervals = [
      mkIv({ playerId: 'p1', slotId: 'CM', role: 'midfielder_center', startMinuteAbs: 0, endMinuteAbs: 90 }),
    ];
    const res = runMatchPositionEngine({
      formations: [formation433],
      positionEvents: intervals,
      matchEndMinuteAbs: 90,
    });
    const onField = new Map([['p1', 90]]);
    expect(validatePositionMinutesAgainstOnField(res, onField)).toHaveLength(0);
  });

  it('predominant role picks the role with most minutes', () => {
    const intervals = [
      mkIv({ playerId: 'p1', slotId: 'CM', role: 'midfielder_center', startMinuteAbs: 0, endMinuteAbs: 30 }),
      mkIv({
        playerId: 'p1', slotId: 'LW', role: 'winger_left',
        startMinuteAbs: 30, endMinuteAbs: 90, source: 'tactical_move',
      }),
    ];
    const res = runMatchPositionEngine({
      formations: [formation433],
      positionEvents: intervals,
      matchEndMinuteAbs: 90,
    });
    expect(predominantRoleByPlayer(res).get('p1')?.role).toBe('winger_left');
  });
});
