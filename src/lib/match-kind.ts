/**
 * Championship, friendly or tournament: the minutes of a player are told apart by the kind
 * of match (a coach rotates more in friendlies; the championship minutes are the ones that
 * count for the season's decisions).
 */
export type MatchKind = 'championship' | 'friendly' | 'tournament';

export const MATCH_KINDS: { key: MatchKind; label: string; short: string }[] = [
  { key: 'championship', label: 'Campeonato', short: 'Camp.' },
  { key: 'friendly', label: 'Amigáveis', short: 'Amig.' },
  { key: 'tournament', label: 'Torneios', short: 'Torn.' },
];
export const kindLabel = (k: MatchKind) => MATCH_KINDS.find((x) => x.key === k)!.label;

/** The kind of a match: its type, or (for older matches) what the competition name says. */
export function kindOf(m: { match_type?: string | null; competition?: string | null } | null | undefined): MatchKind {
  const t = (m?.match_type ?? '').toLowerCase();
  if (t === 'friendly' || t === 'tournament' || t === 'championship') return t;
  const c = (m?.competition ?? '').toLowerCase();
  if (c.includes('amig')) return 'friendly';
  if (c.includes('torneio')) return 'tournament';
  return 'championship';
}

export interface KindTotals { kind: MatchKind; matches: number; played: number; starts: number; minutes: number }

/** Per kind: matches called up for, matches with minutes, starts and minutes. */
export function minutesByKind(rows: { minutes_played: number | null; is_starter: boolean | null; match: { match_type?: string | null; competition?: string | null } | null }[]): KindTotals[] {
  const out = new Map<MatchKind, KindTotals>(MATCH_KINDS.map((k) => [k.key, { kind: k.key, matches: 0, played: 0, starts: 0, minutes: 0 }]));
  for (const r of rows) {
    const t = out.get(kindOf(r.match))!;
    t.matches++;
    const min = r.minutes_played ?? 0;
    if (min > 0) t.played++;
    if (r.is_starter) t.starts++;
    t.minutes += min;
  }
  return [...out.values()];
}
