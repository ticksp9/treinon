/**
 * The tactics of a team: the formations the coach really plays with, with his own name
 * for each ("Principal", "A defender o resultado"), and which one a match starts with.
 * Kept on the team (teams.tactics), per sport, so the whole technical staff shares them.
 * The drawing of each formation is the formation's own (see lib/custom-formations).
 */
import { getFormation } from './tactical-formations';

export interface TeamTactic { code: string; name?: string }
export interface SportTactics { list: TeamTactic[]; default?: string | null }
export type TeamTacticsMap = Record<string, SportTactics>;

export function parseTeamTactics(raw: unknown): TeamTacticsMap {
  const out: TeamTacticsMap = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [sport, v] of Object.entries(raw as Record<string, unknown>)) {
    const st = (v ?? {}) as { list?: unknown; default?: unknown };
    const seen = new Set<string>();
    const list: TeamTactic[] = [];
    for (const item of Array.isArray(st.list) ? st.list : []) {
      const t = item as { code?: unknown; name?: unknown };
      if (typeof t?.code !== 'string' || seen.has(t.code) || !getFormation(sport, t.code)) continue;
      seen.add(t.code);
      const name = typeof t.name === 'string' ? t.name.trim().slice(0, 40) : '';
      list.push(name ? { code: t.code, name } : { code: t.code });
    }
    if (list.length) out[sport] = { list, default: typeof st.default === 'string' && seen.has(st.default) ? st.default : list[0].code };
  }
  return out;
}

export const tacticsFor = (map: TeamTacticsMap, sport: string | null | undefined): SportTactics =>
  (sport && map[sport]) || { list: [], default: null };

/** The formation a new match of this team starts with (null = the app's first one). */
export const defaultTacticCode = (map: TeamTacticsMap, sport: string | null | undefined): string | null =>
  tacticsFor(map, sport).default ?? null;

export const tacticLabel = (t: TeamTactic) => (t.name ? `${t.code} · ${t.name}` : t.code);

/** Adds a formation to the team's tactics (the first one becomes the default) or renames it. */
export function upsertTactic(map: TeamTacticsMap, sport: string, code: string, name?: string): TeamTacticsMap {
  const cur = tacticsFor(map, sport);
  const clean = name?.trim().slice(0, 40);
  const exists = cur.list.some((t) => t.code === code);
  const list = exists
    ? cur.list.map((t) => (t.code === code ? (name === undefined ? t : clean ? { code, name: clean } : { code }) : t))
    : [...cur.list, clean ? { code, name: clean } : { code }];
  return { ...map, [sport]: { list, default: cur.default && list.some((t) => t.code === cur.default) ? cur.default : list[0].code } };
}

export function removeTactic(map: TeamTacticsMap, sport: string, code: string): TeamTacticsMap {
  const cur = tacticsFor(map, sport);
  const list = cur.list.filter((t) => t.code !== code);
  const next = { ...map };
  if (list.length === 0) delete next[sport];
  else next[sport] = { list, default: cur.default === code ? list[0].code : cur.default };
  return next;
}

export function setDefaultTactic(map: TeamTacticsMap, sport: string, code: string): TeamTacticsMap {
  const withIt = tacticsFor(map, sport).list.some((t) => t.code === code) ? map : upsertTactic(map, sport, code);
  return { ...withIt, [sport]: { ...tacticsFor(withIt, sport), default: code } };
}

/** For the formation lists: the team's tactics first (default on top), then everything else. */
export function splitFormations<T extends { code: string; name: string }>(all: T[], tactics: SportTactics): { mine: (T & { label: string; isDefault: boolean })[]; others: T[] } {
  const mineCodes = new Set(tactics.list.map((t) => t.code));
  const byCode = new Map(all.map((f) => [f.code, f]));
  const mine = tactics.list
    .map((t) => {
      const f = byCode.get(t.code) ?? ({ code: t.code, name: t.code } as T);
      return { ...f, label: tacticLabel(t), isDefault: t.code === tactics.default };
    })
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return { mine, others: all.filter((f) => !mineCodes.has(f.code)) };
}
