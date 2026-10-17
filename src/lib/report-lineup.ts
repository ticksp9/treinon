/**
 * The line-up of each part of a match, as the report shows it: the tactic used, each player
 * on his spot, and the starters listed goalkeeper → defenders → midfielders → forwards.
 *
 * The tactic of each part is saved when the part starts. For matches played before that,
 * the formation saved at the end of the match is used and the starters of the part are fitted
 * into it by their positions (the same rule the live screen uses).
 */
import { reconcileTactics, tacticsFormation, type LiveTactics } from '@/lib/live-tactics';

export interface LineupSpot { slotId: string; role: string; label: string; x: number; y: number; playerId: string | null }
export interface PartLineup { formation: string; spots: LineupSpot[]; estimated: boolean }

const POSITION_ZONE: Record<string, number> = {
  GK: 0, CB: 1, LB: 1, RB: 1, LWB: 1, RWB: 1, FIX: 1, SW: 1,
  CDM: 2, DM: 2, CM: 2, CAM: 2, LM: 2, RM: 2, ALA: 2, AM: 2,
  LW: 3, RW: 3, CF: 3, ST: 3, PIV: 3, UNI: 3, SS: 3,
};

/** 0 goalkeeper, 1 defence, 2 midfield, 3 attack, 4 unknown */
export function zoneOfRole(role: string | null | undefined): number {
  if (!role) return 4;
  if (role === 'goalkeeper') return 0;
  if (role.startsWith('defender') || role === 'sweeper' || role === 'fixo') return 1;
  if (role.startsWith('midfielder') || role.startsWith('ala')) return 2;
  return 3;
}
export const zoneOfPosition = (pos: string | null | undefined) => POSITION_ZONE[(pos ?? '').toUpperCase()] ?? 4;

export function partLineup(
  sport: string | null | undefined,
  part: number,
  saved: Record<string, LiveTactics> | null | undefined,
  finalTactics: LiveTactics | null | undefined,
  starterIds: string[],
  positionOf: (id: string) => string | null | undefined,
): PartLineup | null {
  if (!sport || !starterIds.length) return null;
  const own = saved?.[String(part)];
  const t = own ?? reconcileTactics(sport, finalTactics ?? null, starterIds.map((id) => ({ player_id: id, position: positionOf(id) })));
  if (!t) return null;
  const f = tacticsFormation(sport, t);
  if (!f) return null;
  return {
    formation: t.formation,
    estimated: !own,
    spots: f.slots.map((s) => ({ slotId: s.slot_id, role: s.role, label: s.label, x: s.x, y: s.y, playerId: t.slots[s.slot_id] ?? null })),
  };
}

/** Goalkeeper first, then defenders, midfielders and forwards; left to right inside each line (as on the drawing). */
export function orderByPosition(ids: string[], lineup: PartLineup | null, positionOf: (id: string) => string | null | undefined, numberOf: (id: string) => number | null | undefined = () => null): string[] {
  const spot = new Map((lineup?.spots ?? []).filter((s) => s.playerId).map((s) => [s.playerId as string, s]));
  const key = (id: string) => {
    const s = spot.get(id);
    return { zone: s ? zoneOfRole(s.role) : zoneOfPosition(positionOf(id)), y: s ? s.y : 0, x: s ? s.x : 0.5, n: numberOf(id) ?? 99 };
  };
  return [...ids].sort((a, b) => {
    const ka = key(a), kb = key(b);
    return ka.zone - kb.zone || ka.x - kb.x || ka.n - kb.n;
  });
}

/** "Rodrigo Durães" → "Rodrigo D." (fits under a dot on the pitch drawing) */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] ?? '';
}
