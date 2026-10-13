/**
 * Scouting of players: the people we are watching, of any age group.
 * A sheet keeps football data only; each time the player is watched there is an observation
 * with marks from 1 to 5 in each area. The radar is the average of those marks.
 */
import { normalizeTeamName } from '@/lib/opponent-scouting';

export type ScoutStatus = 'identified' | 'following' | 'priority' | 'trial' | 'signed' | 'discarded';
export type Recommendation = 'sign' | 'trial' | 'follow' | 'discard';

export interface ScoutPlayer {
  id: string; owner_id: string; club_id: string | null;
  name: string; birth_date: string | null; birth_year: number | null;
  current_club: string | null; category: string | null; sport_type: string;
  position: string | null; other_positions: string | null; foot: 'right' | 'left' | 'both' | null; height_cm: number | null;
  status: ScoutStatus; found_at: string | null; video_links: string[]; summary: string | null;
  created_at: string; updated_at: string;
}
export type AreaKey = 'technical' | 'tactical' | 'physical' | 'mental' | 'potential';
export interface ScoutObservation {
  id: string; scout_player_id: string; observed_on: string; context: string | null;
  position_played: string | null; minutes_seen: number | null;
  technical: number | null; tactical: number | null; physical: number | null; mental: number | null; potential: number | null;
  strengths: string | null; weaknesses: string | null; notes: string | null; recommendation: Recommendation | null;
}

export const STATUSES: { key: ScoutStatus; label: string; hint: string }[] = [
  { key: 'identified', label: 'Identificado', hint: 'Alguém falou dele ou foi visto uma vez.' },
  { key: 'following', label: 'A seguir', hint: 'Vale a pena voltar a ver.' },
  { key: 'priority', label: 'Prioritário', hint: 'Queremos este jogador.' },
  { key: 'trial', label: 'À experiência', hint: 'Está a treinar connosco.' },
  { key: 'signed', label: 'Inscrito', hint: 'Já é nosso jogador.' },
  { key: 'discarded', label: 'Arquivado', hint: 'Não avançamos, por agora.' },
];
export const statusLabel = (s: string) => STATUSES.find((x) => x.key === s)?.label ?? s;
/** the ones that still need work, in the order a coach reads them */
export const OPEN_STATUSES: ScoutStatus[] = ['priority', 'trial', 'following', 'identified'];

export const AREAS: { key: AreaKey; label: string; hint: string }[] = [
  { key: 'technical', label: 'Técnica', hint: 'Receção, passe, drible, remate.' },
  { key: 'tactical', label: 'Tática', hint: 'Posicionamento, decisão, leitura do jogo.' },
  { key: 'physical', label: 'Física', hint: 'Velocidade, força, resistência.' },
  { key: 'mental', label: 'Mental', hint: 'Atitude, concentração, reação ao erro.' },
  { key: 'potential', label: 'Potencial', hint: 'Até onde pode chegar.' },
];
export const MARK_LABELS = ['', 'Fraco', 'Abaixo', 'Médio', 'Bom', 'Muito bom'];

export const RECOMMENDATIONS: { key: Recommendation; label: string }[] = [
  { key: 'sign', label: 'Inscrever' },
  { key: 'trial', label: 'Chamar à experiência' },
  { key: 'follow', label: 'Continuar a ver' },
  { key: 'discard', label: 'Não avançar' },
];
export const recommendationLabel = (r: string | null | undefined) => RECOMMENDATIONS.find((x) => x.key === r)?.label ?? null;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Average mark in each area over the observations that marked it (null when nobody did). */
export function areaAverages(observations: Pick<ScoutObservation, AreaKey>[]): Record<AreaKey, number | null> {
  const out = {} as Record<AreaKey, number | null>;
  for (const { key } of AREAS) {
    const marks = observations.map((o) => o[key]).filter((v): v is number => typeof v === 'number');
    out[key] = marks.length ? round1(marks.reduce((a, b) => a + b, 0) / marks.length) : null;
  }
  return out;
}

/** One number for an observation: the average of the areas it marked. */
export function observationMark(o: Pick<ScoutObservation, AreaKey>): number | null {
  const marks = AREAS.map((a) => o[a.key]).filter((v): v is number => typeof v === 'number');
  return marks.length ? round1(marks.reduce((a, b) => a + b, 0) / marks.length) : null;
}

/** The player's overall mark: the average of the area averages. */
export function overallMark(observations: Pick<ScoutObservation, AreaKey>[]): number | null {
  const avgs = Object.values(areaAverages(observations)).filter((v): v is number => v != null);
  return avgs.length ? round1(avgs.reduce((a, b) => a + b, 0) / avgs.length) : null;
}

/** The marks over time, oldest first, for the evolution line. */
export function markHistory(observations: (Pick<ScoutObservation, AreaKey> & { observed_on: string })[]): { date: string; mark: number }[] {
  return [...observations].sort((a, b) => a.observed_on.localeCompare(b.observed_on))
    .map((o) => ({ date: o.observed_on, mark: observationMark(o) }))
    .filter((x): x is { date: string; mark: number } => x.mark != null);
}

export const yearOfBirth = (p: Pick<ScoutPlayer, 'birth_date' | 'birth_year'>): number | null =>
  p.birth_date ? Number(p.birth_date.slice(0, 4)) : p.birth_year ?? null;

/** Age on a given day when the date is known; else the age he turns that year. */
export function ageOf(p: Pick<ScoutPlayer, 'birth_date' | 'birth_year'>, today = new Date()): number | null {
  if (p.birth_date) {
    const [y, m, d] = p.birth_date.split('-').map(Number);
    const had = today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
    return today.getFullYear() - y - (had ? 0 : 1);
  }
  return p.birth_year ? today.getFullYear() - p.birth_year : null;
}
export const isMinor = (p: Pick<ScoutPlayer, 'birth_date' | 'birth_year'>, today = new Date()) => { const a = ageOf(p, today); return a != null && a < 18; };

/** 1–4, only when the full date is known. */
export const birthQuarter = (birthDate: string | null | undefined): number | null =>
  birthDate ? Math.floor((Number(birthDate.slice(5, 7)) - 1) / 3) + 1 : null;

/**
 * Young players born late in the year look worse next to team-mates almost a year older.
 * Worth a line on the sheet so the mark is read with that in mind.
 */
export function relativeAgeNote(p: Pick<ScoutPlayer, 'birth_date' | 'birth_year'>, today = new Date()): string | null {
  const q = birthQuarter(p.birth_date);
  if (!q || !isMinor(p, today)) return null;
  if (q === 4) return 'Nascido no último trimestre do ano: é dos mais novos do escalão. Compare-o com isso em mente.';
  if (q === 1) return 'Nascido no primeiro trimestre do ano: é dos mais velhos do escalão. Parte da vantagem pode ser só idade.';
  return null;
}

export interface PlayerFilter { search: string; status: ScoutStatus | 'open' | 'all'; position: string }

export function filterPlayers<T extends Pick<ScoutPlayer, 'name' | 'current_club' | 'category' | 'position' | 'status'>>(players: T[], f: PlayerFilter): T[] {
  const q = normalizeTeamName(f.search);
  return players.filter((p) =>
    (f.status === 'all' || (f.status === 'open' ? OPEN_STATUSES.includes(p.status) : p.status === f.status))
    && (!f.position || (p.position ?? '').toLowerCase() === f.position.toLowerCase())
    && (!q || normalizeTeamName(`${p.name} ${p.current_club ?? ''} ${p.category ?? ''} ${p.position ?? ''}`).includes(q)));
}

/** Priority first, then on trial, following, identified; inside each, by name. */
export function sortPlayers<T extends Pick<ScoutPlayer, 'name' | 'status'>>(players: T[]): T[] {
  const order: ScoutStatus[] = [...OPEN_STATUSES, 'signed', 'discarded'];
  return [...players].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || a.name.localeCompare(b.name, 'pt'));
}

/** Only http(s) links are kept, at most ten. */
export function cleanLinks(text: string): string[] {
  return Array.from(new Set(text.split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\/\S+\.\S+/i.test(s)))).slice(0, 10);
}
