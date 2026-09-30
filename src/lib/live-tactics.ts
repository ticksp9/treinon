/**
 * Live pitch ("Football Manager" style): which on-field player occupies each slot
 * of the chosen formation, plus an estimated freshness per player.
 */
import { listAvailableFormations, getFormation, type Formation, type FormationSlot } from './tactical-formations';

/** Captain and set-piece takers (FM "Bolas paradas"). Player ids from the squad. */
export interface SetPieceRoles {
  captain?: string | null;
  penalties?: string | null;
  corners?: string | null;
  free_kicks?: string | null;
}

export interface LiveTactics {
  formation: string;
  /** slotId -> playerId */
  slots: Record<string, string | null>;
  roles?: SetPieceRoles;
}

export interface PitchPlayer {
  player_id: string;
  position?: string | null;
}

type Zone = 'gk' | 'def' | 'mid' | 'att';
type Side = 'left' | 'right' | 'center';

const POSITION_ZONE: Record<string, Zone> = {
  GK: 'gk',
  CB: 'def', LB: 'def', RB: 'def', FIX: 'def',
  CDM: 'mid', CM: 'mid', CAM: 'mid', LM: 'mid', RM: 'mid', ALA: 'mid',
  LW: 'att', RW: 'att', CF: 'att', ST: 'att', PIV: 'att', UNI: 'att',
};
const POSITION_SIDE: Record<string, Side> = { LB: 'left', LM: 'left', LW: 'left', RB: 'right', RM: 'right', RW: 'right' };

function roleZone(role: string): Zone {
  if (role === 'goalkeeper') return 'gk';
  if (role.startsWith('defender') || role === 'sweeper' || role === 'fixo') return 'def';
  if (role.startsWith('midfielder') || role.startsWith('ala')) return 'mid';
  return 'att';
}
function roleSide(role: string): Side {
  if (role.endsWith('left')) return 'left';
  if (role.endsWith('right')) return 'right';
  return 'center';
}

export function fitScore(slot: FormationSlot, p: PitchPlayer): number {
  const pos = (p.position || '').toUpperCase();
  const zone = POSITION_ZONE[pos];
  let score = 0;
  if (zone && zone === roleZone(slot.role)) score += 4;
  if (zone === 'gk' && roleZone(slot.role) !== 'gk') score -= 6; // keep GKs out of outfield slots
  if (roleZone(slot.role) === 'gk' && zone !== 'gk') score -= 2;
  const side = POSITION_SIDE[pos] ?? 'center';
  if (side === roleSide(slot.role)) score += 1;
  return score;
}

export function defaultFormationCode(sportType: string | null | undefined): string | null {
  return listAvailableFormations(sportType)[0]?.code ?? null;
}

/**
 * Fill empty slots with on-field players not yet placed. Globally greedy: always
 * take the best remaining (slot, player) pair, so a left winger is not put up
 * front just because the striker slot came first.
 */
function fill(formation: Formation, slots: Record<string, string | null>, onField: PitchPlayer[]) {
  const placed = new Set(Object.values(slots).filter(Boolean) as string[]);
  const free = onField.filter((p) => !placed.has(p.player_id));
  const empty = formation.slots.filter((s) => !slots[s.slot_id]);
  while (empty.length > 0 && free.length > 0) {
    let bs = 0, bp = 0, best = -Infinity;
    empty.forEach((slot, si) => free.forEach((p, pi) => {
      const sc = fitScore(slot, p);
      if (sc > best) { best = sc; bs = si; bp = pi; }
    }));
    slots[empty[bs].slot_id] = free[bp].player_id;
    empty.splice(bs, 1);
    free.splice(bp, 1);
  }
  return slots;
}

/**
 * Keep existing placements of players still on the field, drop those who left,
 * and place anyone new. Works when the formation changes too (by slot id).
 */
export function reconcileTactics(
  sportType: string | null | undefined,
  current: LiveTactics | null | undefined,
  onField: PitchPlayer[],
): LiveTactics | null {
  const code = current?.formation && getFormation(sportType || '', current.formation)
    ? current.formation
    : defaultFormationCode(sportType);
  if (!code) return null;
  const formation = getFormation(sportType || '', code)!;
  const onIds = new Set(onField.map((p) => p.player_id));
  const slots: Record<string, string | null> = {};
  for (const s of formation.slots) {
    const pid = current?.slots?.[s.slot_id] ?? null;
    slots[s.slot_id] = pid && onIds.has(pid) ? pid : null;
  }
  const out: LiveTactics = { formation: code, slots: fill(formation, slots, onField) };
  if (current?.roles) out.roles = current.roles;
  return out;
}

/** Substitution: the player coming in takes the slot of the player going out. */
export function applySubstitution(t: LiveTactics, outId: string, inId: string): LiveTactics {
  const slots = { ...t.slots };
  for (const k of Object.keys(slots)) if (slots[k] === outId) slots[k] = inId;
  return { ...t, slots };
}

/** Swap two slots (coach moves players around on the pitch). */
export function swapSlots(t: LiveTactics, a: string, b: string): LiveTactics {
  const slots = { ...t.slots };
  [slots[a], slots[b]] = [slots[b] ?? null, slots[a] ?? null];
  return { ...t, slots };
}

/**
 * Estimated freshness 0–100 (like "condition" in Football Manager). It is only an
 * indication to help rotate players: drops while a player is on the field without
 * a break and recovers on the bench. Rates per minute.
 */
export const FRESHNESS = { drop: 1.6, recover: 4, min: 25 };

export function estimateFreshness(
  stints: { from: number; to: number }[],
  nowSeconds: number,
): number {
  let value = 100;
  let t = 0;
  for (const s of [...stints].sort((a, b) => a.from - b.from)) {
    value = Math.min(100, value + ((s.from - t) / 60) * FRESHNESS.recover);
    value = Math.max(FRESHNESS.min, value - ((s.to - s.from) / 60) * FRESHNESS.drop);
    t = s.to;
  }
  value = Math.min(100, value + (Math.max(0, nowSeconds - t) / 60) * FRESHNESS.recover);
  return Math.round(value);
}
