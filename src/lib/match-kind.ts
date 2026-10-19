/**
 * Championship, friendly or tournament: minutes, goals and cards of a player are told apart by
 * the kind of match (a coach rotates more in friendlies; the championship numbers are the ones
 * that count for the season's decisions).
 */
export type MatchKind = 'championship' | 'friendly' | 'tournament';

export const MATCH_KINDS: { key: MatchKind; label: string; short: string }[] = [
  { key: 'championship', label: 'Campeonato', short: 'Camp.' },
  { key: 'friendly', label: 'Amigáveis', short: 'Amig.' },
  { key: 'tournament', label: 'Torneios', short: 'Torn.' },
];
export const kindLabel = (k: MatchKind) => MATCH_KINDS.find((x) => x.key === k)!.label;

type MatchLike = { match_type?: string | null; competition?: string | null } | null | undefined;

/** The kind of a match: its type, or (for older matches) what the competition name says. */
export function kindOf(m: MatchLike): MatchKind {
  const t = (m?.match_type ?? '').toLowerCase();
  if (t === 'friendly' || t === 'tournament' || t === 'championship') return t;
  const c = (m?.competition ?? '').toLowerCase();
  if (c.includes('amig')) return 'friendly';
  if (c.includes('torneio')) return 'tournament';
  return 'championship';
}

export interface KindTotals { kind: MatchKind; matches: number; played: number; starts: number; minutes: number; goals: number; yellow: number; red: number }
export interface LineupRow { player_id?: string; minutes_played: number | null; is_starter: boolean | null; match: MatchLike }
export interface EventRow { player_id?: string | null; event_type: string; is_opponent?: boolean | null; match: MatchLike }

const empty = (kind: MatchKind): KindTotals => ({ kind, matches: 0, played: 0, starts: 0, minutes: 0, goals: 0, yellow: 0, red: 0 });

function add(out: Map<MatchKind, KindTotals>, lineups: LineupRow[], events: EventRow[]) {
  for (const r of lineups) {
    const t = out.get(kindOf(r.match))!;
    t.matches++;
    const min = r.minutes_played ?? 0;
    if (min > 0) t.played++;
    if (r.is_starter) t.starts++;
    t.minutes += min;
  }
  for (const e of events) {
    if (e.is_opponent) continue;
    const t = out.get(kindOf(e.match))!;
    if (e.event_type === 'goal') t.goals++;
    else if (e.event_type === 'yellow_card') t.yellow++;
    else if (e.event_type === 'red_card') t.red++;
  }
}

/** One player: per kind, call-ups, matches with minutes, starts, minutes, goals and cards. */
export function minutesByKind(lineups: LineupRow[], events: EventRow[] = []): KindTotals[] {
  const out = new Map<MatchKind, KindTotals>(MATCH_KINDS.map((k) => [k.key, empty(k.key)]));
  add(out, lineups, events);
  return [...out.values()];
}

/** The whole team: the same per player. */
export function teamByKind(lineups: LineupRow[], events: EventRow[]): Map<string, KindTotals[]> {
  const ids = new Set<string>([...lineups.map((l) => l.player_id), ...events.map((e) => e.player_id)].filter((x): x is string => !!x));
  const out = new Map<string, KindTotals[]>();
  for (const id of ids) out.set(id, minutesByKind(lineups.filter((l) => l.player_id === id), events.filter((e) => e.player_id === id)));
  return out;
}

/** All kinds together. */
export function sumKinds(list: KindTotals[]): Omit<KindTotals, 'kind'> {
  return list.reduce((s, t) => ({ matches: s.matches + t.matches, played: s.played + t.played, starts: s.starts + t.starts, minutes: s.minutes + t.minutes, goals: s.goals + t.goals, yellow: s.yellow + t.yellow, red: s.red + t.red }),
    { matches: 0, played: 0, starts: 0, minutes: 0, goals: 0, yellow: 0, red: 0 });
}
