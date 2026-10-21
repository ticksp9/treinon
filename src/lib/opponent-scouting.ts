/**
 * Scouting of opponents: one sheet per opposing team, kept from match to match.
 * The sheet holds how they play (schemes drawn on the tactical board, filed by moment of
 * the game), their squad and what was seen in each match watched.
 */
import { emptyBoard, formationCodes, placeFormation, type BoardState } from '@/lib/tactic-board';
import { tx } from '@/lib/i18n/ui';

export interface Opponent {
  id: string; owner_id: string; club_id: string | null;
  name: string; category: string | null; sport_type: string; competition: string | null;
  coach_name: string | null; usual_formation: string | null;
  strengths: string | null; weaknesses: string | null; notes: string | null;
  created_at: string; updated_at: string;
}
export interface OpponentPlayer {
  id: string; opponent_id: string; shirt_number: string | null; name: string | null;
  position: string | null; foot: 'right' | 'left' | 'both' | null; is_key: boolean; notes: string | null;
}
export type SchemeMoment = 'attack' | 'defense' | 'transition_attack' | 'transition_defense' | 'set_piece_for' | 'set_piece_against';
export interface OpponentScheme {
  id: string; opponent_id: string; moment: SchemeMoment; title: string; notes: string | null;
  board_data: unknown; updated_at: string;
}
export interface OpponentObservation {
  id: string; opponent_id: string; observed_on: string; against: string | null; result: string | null;
  formation: string | null; notes: string | null;
}

/** The moments of the game, always from the opponent's point of view. */
export const MOMENTS: { key: SchemeMoment; label: string; hint: string; half: boolean }[] = [
  { key: 'attack', get label() { return tx('Como atacam'); }, get hint() { return tx('Saída de bola, como chegam à frente e como finalizam.'); }, half: false },
  { key: 'defense', get label() { return tx('Como defendem'); }, get hint() { return tx('Altura do bloco, pressão e espaços que deixam.'); }, half: false },
  { key: 'transition_attack', get label() { return tx('Quando ganham a bola'); }, get hint() { return tx('Contra-ataque: quem lança e para onde.'); }, half: false },
  { key: 'transition_defense', get label() { return tx('Quando perdem a bola'); }, get hint() { return tx('Reagem a pressionar ou recuam? Quem fica fora de posição?'); }, half: false },
  { key: 'set_piece_for', get label() { return tx('Bolas paradas a atacar'); }, get hint() { return tx('Cantos, livres e lançamentos deles.'); }, half: true },
  { key: 'set_piece_against', get label() { return tx('Bolas paradas a defender'); }, get hint() { return tx('Como marcam nos cantos e livres contra eles.'); }, half: true },
];
export const momentLabel = (m: string) => MOMENTS.find((x) => x.key === m)?.label ?? m;

export const SPORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'football_11', get label() { return tx('Futebol 11'); } },
  { value: 'football_9', get label() { return tx('Futebol 9'); } },
  { value: 'football_7', get label() { return tx('Futebol 7'); } },
  { value: 'football_5', get label() { return tx('Futebol 5'); } },
  { value: 'futsal', get label() { return tx('Futsal'); } },
];
export const sportLabel = (s: string) => SPORT_OPTIONS.find((o) => o.value === s)?.label ?? s;

export const FOOT_LABEL: Record<string, string> = { right: 'Direito', left: 'Esquerdo', both: 'Ambos' };

/** "G.D. São João " and "gd sao joao" are the same team. */
export const normalizeTeamName = (name: string | null | undefined) =>
  (name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const sameTeam = (a: string | null | undefined, b: string | null | undefined) => {
  const x = normalizeTeamName(a), y = normalizeTeamName(b);
  return !!x && x === y;
};

export interface PlayedMatch { id: string; opponent_name: string; match_date: string; status?: string | null; is_home?: boolean | null; goals_for?: number | null; goals_against?: number | null; team_name?: string | null }

/** Our own matches against this team, most recent first. */
export function matchesAgainst<T extends PlayedMatch>(matches: T[], opponentName: string): T[] {
  return matches.filter((m) => sameTeam(m.opponent_name, opponentName)).sort((a, b) => b.match_date.localeCompare(a.match_date));
}

export interface HeadToHead { played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number }

/** Only matches with a final score count. */
export function headToHead(matches: PlayedMatch[]): HeadToHead {
  const h: HeadToHead = { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
  for (const m of matches) {
    if (m.goals_for == null || m.goals_against == null || (m.status && m.status !== 'completed')) continue;
    h.played++; h.goalsFor += m.goals_for; h.goalsAgainst += m.goals_against;
    if (m.goals_for > m.goals_against) h.won++; else if (m.goals_for < m.goals_against) h.lost++; else h.drawn++;
  }
  return h;
}

/** Key players first, then by shirt number, then by name. */
export function sortSquad<T extends Pick<OpponentPlayer, 'is_key' | 'shirt_number' | 'name'>>(players: T[]): T[] {
  const num = (p: T) => { const n = parseInt(p.shirt_number ?? '', 10); return Number.isFinite(n) ? n : 999; };
  return [...players].sort((a, b) => Number(b.is_key) - Number(a.is_key) || num(a) - num(b) || (a.name ?? '').localeCompare(b.name ?? '', 'pt'));
}

/**
 * The board a new scheme starts from: the opponent (red) already in his usual shape,
 * with the squad's numbers when the formation is known. Set pieces open on half a pitch.
 */
export function newSchemeBoard(sport: string, moment: SchemeMoment, usualFormation?: string | null): BoardState {
  const codes = formationCodes(sport);
  const code = usualFormation && codes.some((c) => c.code === usualFormation) ? usualFormation : codes[0]?.code;
  const base = { ...emptyBoard(sport), half: !!MOMENTS.find((m) => m.key === moment)?.half };
  return code ? placeFormation(base, 'away', code) : base;
}

export function schemesByMoment(schemes: OpponentScheme[]): Record<SchemeMoment, OpponentScheme[]> {
  const out = Object.fromEntries(MOMENTS.map((m) => [m.key, [] as OpponentScheme[]])) as Record<SchemeMoment, OpponentScheme[]>;
  for (const s of schemes) (out[s.moment] ??= []).push(s);
  return out;
}

/** One line for the list: "3 esquemas · 12 jogadores · 2 observações". */
export function sheetSummary(counts: { schemes: number; players: number; observations: number }): string {
  const part = (n: number, one: string, many: string) => (n > 0 ? `${n} ${n === 1 ? one : many}` : null);
  return [part(counts.schemes, 'esquema', 'esquemas'), part(counts.players, 'jogador', 'jogadores'), part(counts.observations, tx('observação'), tx('observações'))]
    .filter(Boolean).join(' · ') || 'Ficha ainda vazia';
}

// ── the game plan of one match ──
export interface MatchPlan {
  id: string; match_id: string; opponent_id: string | null;
  key_points: string[]; notes: string | null; scheme_ids: string[]; updated_at: string;
}
export const MAX_KEY_POINTS = 6;

/** What is saved: trimmed, no empty lines, no repeats, at most six. */
export function cleanKeyPoints(points: string[]): string[] {
  const out: string[] = [];
  for (const p of points) {
    const t = p.replace(/\s+/g, ' ').trim().slice(0, 200);
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, MAX_KEY_POINTS);
}

/** The sheet of the team a match is against: the one the plan points to, else the one with the same name. */
export function sheetForMatch<T extends Pick<Opponent, 'id' | 'name' | 'sport_type'>>(sheets: T[], opponentName: string, planOpponentId?: string | null, sport?: string | null): T | null {
  const linked = planOpponentId ? sheets.find((s) => s.id === planOpponentId) : null;
  if (linked) return linked;
  const same = sheets.filter((s) => sameTeam(s.name, opponentName));
  return same.find((s) => sport && s.sport_type === sport) ?? same[0] ?? null;
}

/** The next match still to be played against this team (the earliest from today on). */
export function nextMatchAgainst<T extends PlayedMatch>(matches: T[], opponentName: string, today = new Date()): T | null {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return matchesAgainst(matches, opponentName)
    .filter((m) => m.status !== 'completed' && Date.parse(m.match_date) >= from)
    .sort((a, b) => a.match_date.localeCompare(b.match_date))[0] ?? null;
}

/** The schemes the plan picked, in the plan's order; schemes deleted meanwhile are skipped. */
export function plannedSchemes(schemes: OpponentScheme[], ids: string[]): OpponentScheme[] {
  return ids.map((id) => schemes.find((s) => s.id === id)).filter((s): s is OpponentScheme => !!s);
}
