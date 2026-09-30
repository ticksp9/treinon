/**
 * Automatic team selection and the assistant's pre-match report, Football Manager style.
 * Two ways to pick, because in youth football the best XI is not always the right XI:
 *  - 'best': ability + form + how well each player fits the position
 *  - 'fair': who has played least this season starts (still respecting positions)
 */
import { getFormation } from './tactical-formations';
import { fitScore, type LiveTactics } from './live-tactics';

export type PickMode = 'best' | 'fair';

export interface Candidate {
  player_id: string;
  name?: string;
  position?: string | null;
  /** 1–10, latest evaluation */
  ability?: number | null;
  /** average of the last match ratings */
  form?: number | null;
  formTrend?: 'up' | 'down' | 'flat';
  /** minutes played this season (before this match) */
  seasonMinutes?: number;
}

const isGk = (c: Candidate) => (c.position || '').toUpperCase() === 'GK';

function quality(c: Candidate, mode: PickMode, maxMinutes: number): number {
  const ability = c.ability ?? 5;
  const form = c.form ?? ability;
  if (mode === 'best') return ability + (form - 5) * 0.5;
  // fair: fewer minutes → higher; ability only breaks ties
  const share = maxMinutes > 0 ? (c.seasonMinutes ?? 0) / maxMinutes : 0;
  return (1 - share) * 10 + ability * 0.05;
}

/**
 * Pick the starters for a formation. Globally greedy over (slot, player) pairs so
 * goalkeepers go in goal and each player lands in the best-fitting place.
 */
export function pickStartingXI(
  sportType: string,
  formationCode: string,
  candidates: Candidate[],
  mode: PickMode,
  roles?: LiveTactics['roles'],
): { tactics: LiveTactics; starterIds: string[] } | null {
  const formation = getFormation(sportType, formationCode);
  if (!formation) return null;
  const maxMinutes = Math.max(0, ...candidates.map((c) => c.seasonMinutes ?? 0));
  const free = [...candidates];
  const empty = [...formation.slots];
  const slots: Record<string, string | null> = Object.fromEntries(formation.slots.map((s) => [s.slot_id, null]));

  while (empty.length > 0 && free.length > 0) {
    let bs = 0, bp = 0, best = -Infinity;
    empty.forEach((slot, si) => free.forEach((c, pi) => {
      const gkSlot = slot.role === 'goalkeeper';
      const mismatch = gkSlot !== isGk(c) ? -20 : 0;
      const sc = quality(c, mode, maxMinutes) + 1.5 * fitScore(slot, c) + mismatch;
      if (sc > best) { best = sc; bs = si; bp = pi; }
    }));
    slots[empty[bs].slot_id] = free[bp].player_id;
    empty.splice(bs, 1);
    free.splice(bp, 1);
  }
  const tactics: LiveTactics = { formation: formationCode, slots };
  if (roles) tactics.roles = roles;
  return { tactics, starterIds: Object.values(slots).filter(Boolean) as string[] };
}

export interface AssistantNote {
  tone: 'info' | 'warn' | 'good';
  text: string;
}

const first = (name?: string) => (name || '').trim().split(/\s+/)[0] || 'Jogador';

/** Short, practical advice from the "assistant" before kick-off. */
export function assistantReport(
  squad: Candidate[],
  starterIds: string[],
  playersOnField: number,
): AssistantNote[] {
  const notes: AssistantNote[] = [];
  const starters = new Set(starterIds);
  const bench = squad.filter((c) => !starters.has(c.player_id));

  if (squad.length > 0 && !squad.some(isGk)) {
    notes.push({ tone: 'warn', text: 'Não há guarda-redes convocado. Alguém vai ter de ir à baliza.' });
  } else if (starterIds.length > 0 && !squad.some((c) => starters.has(c.player_id) && isGk(c))) {
    notes.push({ tone: 'warn', text: 'O guarda-redes não está no onze inicial.' });
  }
  if (starterIds.length < playersOnField) {
    notes.push({ tone: 'warn', text: `Faltam ${playersOnField - starterIds.length} titulares para ${playersOnField}.` });
  }

  const byMinutes = [...bench].sort((a, b) => (a.seasonMinutes ?? 0) - (b.seasonMinutes ?? 0));
  const avg = squad.length ? squad.reduce((s, c) => s + (c.seasonMinutes ?? 0), 0) / squad.length : 0;
  const lowBench = byMinutes.filter((c) => (c.seasonMinutes ?? 0) < avg * 0.6).slice(0, 3);
  if (lowBench.length > 0 && avg > 0) {
    notes.push({
      tone: 'info',
      text: `${lowBench.map((c) => first(c.name)).join(', ')} ${lowBench.length > 1 ? 'têm' : 'tem'} poucos minutos esta época — boa altura para ${lowBench.length > 1 ? 'jogarem' : 'jogar'}.`,
    });
  }

  const falling = squad.filter((c) => starters.has(c.player_id) && c.formTrend === 'down' && c.form != null);
  if (falling.length > 0) {
    notes.push({ tone: 'warn', text: `${falling.map((c) => `${first(c.name)} (${c.form!.toFixed(1)})`).join(', ')} em quebra de forma.` });
  }
  const rising = bench.filter((c) => c.formTrend === 'up' && (c.form ?? 0) >= 7);
  if (rising.length > 0) {
    notes.push({ tone: 'good', text: `${rising.map((c) => first(c.name)).join(', ')} em boa forma no banco.` });
  }
  if (notes.length === 0) notes.push({ tone: 'good', text: 'Tudo em ordem para o jogo.' });
  return notes;
}
