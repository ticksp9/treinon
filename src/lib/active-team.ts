/**
 * "Which team am I working with?" — a coach can have teams in a club, in another
 * club, and teams of their own. Working inside one context keeps players and
 * call-ups from different clubs apart. (pure helpers)
 */
export interface MyTeam {
  id: string;
  name: string;
  category: string | null;
  sport_type: string | null;
  club_id: string | null;
  club_name: string | null;
  my_role: 'owner' | 'head_coach' | 'assistant_coach' | string;
}

export interface TeamGroup { key: string; label: string; clubId: string | null; teams: MyTeam[] }

/** One group per club, plus "As minhas equipas" for teams without a club. */
export function groupTeams(teams: MyTeam[]): TeamGroup[] {
  const groups = new Map<string, TeamGroup>();
  for (const t of teams) {
    const key = t.club_id ?? 'own';
    if (!groups.has(key)) groups.set(key, { key, label: t.club_id ? (t.club_name || 'Clube') : 'As minhas equipas', clubId: t.club_id, teams: [] });
    groups.get(key)!.teams.push(t);
  }
  return [...groups.values()].sort((a, b) => Number(!a.clubId) - Number(!b.clubId) || a.label.localeCompare(b.label));
}

/** Teams in the same context (same club, or all club-less teams) as the active one. */
export function contextTeamIds(teams: MyTeam[], activeId: string | null): Set<string> | null {
  const active = teams.find((t) => t.id === activeId);
  if (!active) return null;
  return new Set(teams.filter((t) => t.club_id === active.club_id).map((t) => t.id));
}

/** The stored choice if still valid; the only team if there is just one; otherwise must ask. */
export function resolveActive(teams: MyTeam[], stored: string | null): { activeId: string | null; mustAsk: boolean } {
  if (stored && teams.some((t) => t.id === stored)) return { activeId: stored, mustAsk: false };
  if (teams.length === 1) return { activeId: teams[0].id, mustAsk: false };
  return { activeId: null, mustAsk: teams.length > 1 };
}

/** Keep only the teams of the active context; if that would hide everything, keep the list. */
export function scopeToContext<T extends { id: string }>(list: T[], ctx: Set<string> | null): T[] {
  if (!ctx) return list;
  const scoped = list.filter((t) => ctx.has(t.id));
  return scoped.length > 0 ? scoped : list;
}

export const ROLE_LABEL: Record<string, string> = { owner: 'Minha equipa', head_coach: 'Treinador principal', assistant_coach: 'Adjunto' };
