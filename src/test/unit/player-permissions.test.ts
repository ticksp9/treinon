import { describe, it, expect } from 'vitest';
import {
  canViewPlayerProfile,
  canEditPlayerProfile,
  canCreatePlayerEvaluation,
  canEditPlayerEvaluation,
  canManagePlayerDevelopmentPlan,
  canViewPlayerSeasonHistory,
  canViewSensitiveNotes,
  canEditStrengthsFocus,
  type PlayerPermissionContext,
} from '@/lib/player-permissions';

const player = { id: 'p1', team_id: 't1', club_id: 'c1' };
const otherPlayer = { id: 'p2', team_id: 't9', club_id: 'c1' };

const base = (over: Partial<PlayerPermissionContext>): PlayerPermissionContext => ({
  userId: 'u1',
  isClubAdmin: false,
  isCoordinator: false,
  isCoach: false,
  isStaff: false,
  isGuardian: false,
  isPlayer: false,
  coachedTeamIds: [],
  guardianPlayerIds: [],
  selfPlayerId: null,
  ...over,
});

describe('player-permissions', () => {
  it('club admin sees and edits everything', () => {
    const ctx = base({ isClubAdmin: true });
    expect(canViewPlayerProfile(ctx, player)).toBe(true);
    expect(canEditPlayerProfile(ctx, player)).toBe(true);
    expect(canCreatePlayerEvaluation(ctx, player)).toBe(true);
    expect(canViewSensitiveNotes(ctx, player)).toBe(true);
  });

  it('coordinator can manage development plan', () => {
    const ctx = base({ isCoordinator: true });
    expect(canManagePlayerDevelopmentPlan(ctx, player)).toBe(true);
  });

  it('coach edits only players of own team', () => {
    const ctx = base({ isCoach: true, coachedTeamIds: ['t1'] });
    expect(canEditPlayerProfile(ctx, player)).toBe(true);
    expect(canEditPlayerProfile(ctx, otherPlayer)).toBe(false);
    expect(canCreatePlayerEvaluation(ctx, otherPlayer)).toBe(false);
  });

  it('coach can edit only own evaluation', () => {
    const ctx = base({ isCoach: true, coachedTeamIds: ['t1'] });
    const own = { id: 'e1', evaluator_id: 'u1' };
    const other = { id: 'e2', evaluator_id: 'u2' };
    expect(canEditPlayerEvaluation(ctx, own, player)).toBe(true);
    expect(canEditPlayerEvaluation(ctx, other, player)).toBe(false);
  });

  it('guardian sees only linked players, never sensitive notes', () => {
    const ctx = base({ isGuardian: true, guardianPlayerIds: ['p1'] });
    expect(canViewPlayerProfile(ctx, player)).toBe(true);
    expect(canViewPlayerProfile(ctx, otherPlayer)).toBe(false);
    expect(canViewSensitiveNotes(ctx, player)).toBe(false);
    expect(canEditPlayerProfile(ctx, player)).toBe(false);
    expect(canCreatePlayerEvaluation(ctx, player)).toBe(false);
  });

  it('player sees own profile read-only', () => {
    const ctx = base({ isPlayer: true, selfPlayerId: 'p1' });
    expect(canViewPlayerProfile(ctx, player)).toBe(true);
    expect(canViewPlayerProfile(ctx, otherPlayer)).toBe(false);
    expect(canEditPlayerProfile(ctx, player)).toBe(false);
    expect(canCreatePlayerEvaluation(ctx, player)).toBe(false);
    expect(canViewSensitiveNotes(ctx, player)).toBe(false);
  });

  it('strengths focus follows evaluation rules', () => {
    expect(canEditStrengthsFocus(base({ isClubAdmin: true }), player)).toBe(true);
    expect(canEditStrengthsFocus(base({ isCoach: true, coachedTeamIds: ['t1'] }), player)).toBe(true);
    expect(canEditStrengthsFocus(base({ isGuardian: true }), player)).toBe(false);
  });

  it('season history view follows view profile rules', () => {
    expect(canViewPlayerSeasonHistory(base({ isClubAdmin: true }), player)).toBe(true);
    expect(canViewPlayerSeasonHistory(base({}), player)).toBe(false);
  });

  it('unauthenticated context blocks everything', () => {
    const ctx = base({ userId: null, isClubAdmin: true });
    expect(canViewPlayerProfile(ctx, player)).toBe(false);
    expect(canEditPlayerProfile(ctx, player)).toBe(false);
  });
});
