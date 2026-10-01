import { describe, it, expect } from 'vitest';
import { contextTeamIds, groupTeams, resolveActive, scopeToContext, type MyTeam } from '@/lib/active-team';

const t = (id: string, club: string | null, clubName: string | null = null): MyTeam =>
  ({ id, name: id, category: null, sport_type: 'football_7', club_id: club, club_name: clubName, my_role: 'head_coach' });
const teams = [t('sub12', 'A', 'Clube A'), t('sub13', 'A', 'Clube A'), t('seniores', 'B', 'Clube B'), t('escolinha', null)];

describe('active team (keeping clubs apart)', () => {
  it('groups by club, own teams last', () => {
    const g = groupTeams(teams);
    expect(g.map((x) => x.label)).toEqual(['Clube A', 'Clube B', 'As minhas equipas']);
    expect(g[0].teams.map((x) => x.id)).toEqual(['sub12', 'sub13']);
  });

  it('context = teams of the same club only', () => {
    expect([...contextTeamIds(teams, 'sub13')!].sort()).toEqual(['sub12', 'sub13']);
    expect([...contextTeamIds(teams, 'seniores')!]).toEqual(['seniores']);
    expect([...contextTeamIds(teams, 'escolinha')!]).toEqual(['escolinha']);
    expect(contextTeamIds(teams, null)).toBeNull();
  });

  it('asks only when there is more than one team and no valid choice', () => {
    expect(resolveActive(teams, null)).toEqual({ activeId: null, mustAsk: true });
    expect(resolveActive(teams, 'sub12')).toEqual({ activeId: 'sub12', mustAsk: false });
    expect(resolveActive(teams, 'gone')).toEqual({ activeId: null, mustAsk: true });
    expect(resolveActive([teams[0]], null)).toEqual({ activeId: 'sub12', mustAsk: false });
    expect(resolveActive([], null)).toEqual({ activeId: null, mustAsk: false });
  });

  it('call-up never mixes players of another club', () => {
    const ctx = contextTeamIds(teams, 'sub13');
    expect(scopeToContext(teams, ctx).map((x) => x.id)).toEqual(['sub12', 'sub13']);
    // club admin lists (teams the user does not coach) are left alone
    expect(scopeToContext([{ id: 'x' }, { id: 'y' }], ctx).map((x) => x.id)).toEqual(['x', 'y']);
  });
});
