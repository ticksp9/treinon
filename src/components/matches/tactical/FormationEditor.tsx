/**
 * Visual formation editor with drag-and-drop and atomic auto-save.
 *
 * Modes:
 *  - 'initial': setup of starters at minute 0 (saves via RPC save_initial_formation)
 *  - 'live':    in-match changes (formation change, player move, slot swap)
 *  - 'edit':    post-game corrections (reuses the same RPCs with overwrite)
 *  - readonly is automatic when the season is archived (caller should pass).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  getFormation,
  expectedPlayersForSport,
  type Formation,
  type SportType,
} from '@/lib/tactical-formations';
import { PitchCanvas } from './PitchCanvas';
import { SlotToken, type SlotTokenPlayer } from './SlotToken';
import { BenchList, type BenchPlayer } from './BenchList';
import { FormationPicker } from './FormationPicker';

export interface EditorPlayer {
  player_id: string;
  name: string;
  number?: number | null;
  position?: string | null;
}

export type FormationEditorMode = 'initial' | 'live' | 'edit';

interface Props {
  matchId: string;
  sportType: SportType | string;
  mode: FormationEditorMode;
  currentMinuteAbs?: number;
  currentPartIndex?: number;
  /** All players that can take part (starters + subs). */
  availablePlayers: EditorPlayer[];
  /** Initial formation code (e.g. '4-3-3'). */
  initialFormationCode?: string;
  /** Pre-existing assignments: slotId -> playerId. */
  initialAssignments?: Record<string, string | null>;
  /** Disable all interactions (e.g. archived season). */
  readonly?: boolean;
  onCommitted?: () => void;
  onCancel?: () => void;
}

type Assignments = Record<string, string | null>;

/** Best-effort slot mapping by role compatibility. */
function remapAssignments(
  prev: { formation: Formation; assignments: Assignments },
  next: Formation,
): Assignments {
  const out: Assignments = Object.fromEntries(next.slots.map((s) => [s.slot_id, null]));
  // 1) keep by exact slot_id
  for (const s of next.slots) {
    if (prev.assignments[s.slot_id]) out[s.slot_id] = prev.assignments[s.slot_id];
  }
  // 2) for players left over, place by role then nearest position
  const placed = new Set(Object.values(out).filter(Boolean) as string[]);
  const leftover: { player: string; oldSlot: string }[] = [];
  for (const [slotId, pid] of Object.entries(prev.assignments)) {
    if (pid && !placed.has(pid)) leftover.push({ player: pid, oldSlot: slotId });
  }
  for (const { player, oldSlot } of leftover) {
    const oldSlotDef = prev.formation.slots.find((s) => s.slot_id === oldSlot);
    // first free slot with same role
    let target = next.slots.find(
      (s) => out[s.slot_id] == null && oldSlotDef && s.role === oldSlotDef.role,
    );
    // else any free slot
    if (!target) target = next.slots.find((s) => out[s.slot_id] == null);
    if (target) {
      out[target.slot_id] = player;
      placed.add(player);
    }
  }
  return out;
}

export function FormationEditor({
  matchId,
  sportType,
  mode,
  currentMinuteAbs = 0,
  currentPartIndex = 1,
  availablePlayers,
  initialFormationCode,
  initialAssignments,
  readonly,
  onCommitted,
  onCancel,
}: Props) {
  const expected = expectedPlayersForSport(sportType);

  const [code, setCode] = useState<string>(
    initialFormationCode ?? '',
  );
  const formation: Formation | undefined = useMemo(() => {
    if (!code) return getFormation(sportType, code) ?? undefined;
    return getFormation(sportType, code);
  }, [sportType, code]);

  // initialise from first available if nothing provided
  useEffect(() => {
    if (!code) {
      const first = getFormation(sportType, initialFormationCode ?? '');
      if (first) setCode(first.code);
    }
  }, [code, initialFormationCode, sportType]);

  const [assignments, setAssignments] = useState<Assignments>(() => {
    const f = getFormation(sportType, initialFormationCode ?? '');
    const base: Assignments = Object.fromEntries((f?.slots ?? []).map((s) => [s.slot_id, null]));
    if (initialAssignments) {
      for (const [k, v] of Object.entries(initialAssignments)) base[k] = v ?? null;
    }
    return base;
  });

  // when formation changes, remap
  const handleFormationChange = useCallback(
    (newCode: string) => {
      const prev = formation;
      const next = getFormation(sportType, newCode);
      if (!next) return;
      setCode(newCode);
      if (prev) {
        setAssignments(remapAssignments({ formation: prev, assignments }, next));
      } else {
        setAssignments(Object.fromEntries(next.slots.map((s) => [s.slot_id, null])));
      }
    },
    [assignments, formation, sportType],
  );

  const onFieldIds = useMemo(
    () => new Set(Object.values(assignments).filter(Boolean) as string[]),
    [assignments],
  );

  const bench: BenchPlayer[] = useMemo(
    () => availablePlayers.filter((p) => !onFieldIds.has(p.player_id)),
    [availablePlayers, onFieldIds],
  );

  const playerById = useMemo(() => {
    const m = new Map<string, EditorPlayer>();
    for (const p of availablePlayers) m.set(p.player_id, p);
    return m;
  }, [availablePlayers]);

  // ── Drag & drop logic ────────────────────────────────────────────
  const [dragSource, setDragSource] = useState<{ playerId: string; from: string } | null>(null);

  const findSlotOfPlayer = useCallback(
    (pid: string): string | null => {
      for (const [s, v] of Object.entries(assignments)) if (v === pid) return s;
      return null;
    },
    [assignments],
  );

  const dropOnSlot = useCallback(
    (targetSlotId: string) => {
      if (!dragSource) return;
      const { playerId, from } = dragSource;
      setAssignments((prev) => {
        const next = { ...prev };
        if (from === 'bench') {
          // place; if slot occupied, the previous occupant goes to bench (set null)
          next[targetSlotId] = playerId;
        } else {
          // slot → slot (swap or move)
          const sourceSlot = from;
          const occupant = next[targetSlotId] ?? null;
          next[targetSlotId] = playerId;
          next[sourceSlot] = occupant; // null if empty, swap if present
        }
        return next;
      });
      setDragSource(null);
    },
    [dragSource],
  );

  const dropOnBench = useCallback(() => {
    if (!dragSource) return;
    const { from } = dragSource;
    if (from === 'bench') {
      setDragSource(null);
      return;
    }
    setAssignments((prev) => ({ ...prev, [from]: null }));
    setDragSource(null);
  }, [dragSource]);

  const releaseSlot = useCallback((slotId: string) => {
    setAssignments((prev) => ({ ...prev, [slotId]: null }));
  }, []);

  const assignFirstFreeSlot = useCallback(
    (playerId: string) => {
      if (!formation) return;
      const player = playerById.get(playerId);
      // try role match by player.position
      const free = formation.slots.find((s) => assignments[s.slot_id] == null);
      if (free) setAssignments((prev) => ({ ...prev, [free.slot_id]: playerId }));
      void player;
    },
    [assignments, formation, playerById],
  );

  // ── Validation ───────────────────────────────────────────────────
  const validation = useMemo(() => {
    if (!formation) return { ok: false, error: 'Sem formação selecionada' };
    const filled = formation.slots.filter((s) => assignments[s.slot_id]).length;
    if (filled !== expected) {
      return { ok: false, error: `Preencher ${expected} jogadores (${filled} preenchidos)` };
    }
    const goalkeeperSlot = formation.slots.find((s) => s.role === 'goalkeeper');
    if (!goalkeeperSlot || !assignments[goalkeeperSlot.slot_id]) {
      return { ok: false, error: 'Tem de ter 1 guarda-redes' };
    }
    const ids = Object.values(assignments).filter(Boolean) as string[];
    if (new Set(ids).size !== ids.length) {
      return { ok: false, error: 'Jogador duplicado em campo' };
    }
    return { ok: true, error: null as string | null };
  }, [assignments, expected, formation]);

  // ── Persistence ──────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  const buildAssignmentsPayload = useCallback(() => {
    if (!formation) return [];
    return formation.slots
      .filter((s) => assignments[s.slot_id])
      .map((s) => ({
        slot_id: s.slot_id,
        player_id: assignments[s.slot_id],
        role: s.role,
      }));
  }, [assignments, formation]);

  const handleConfirm = useCallback(async () => {
    if (readonly) return;
    if (!validation.ok || !formation) {
      toast.error(validation.error ?? 'Formação inválida');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'initial' || mode === 'edit') {
        const { error } = await (supabase as any).rpc('save_initial_formation', {
          p_match_id: matchId,
          p_sport_type: sportType,
          p_formation_code: formation.code,
          p_formation_name: formation.name,
          p_slots: formation.slots,
          p_assignments: buildAssignmentsPayload(),
          p_overwrite: mode === 'edit',
        });
        if (error) throw error;
      } else {
        // 'live'
        const { error } = await (supabase as any).rpc('apply_tactical_change', {
          p_match_id: matchId,
          p_minute_abs: currentMinuteAbs,
          p_part_index: currentPartIndex,
          p_change: {
            type: 'formation_change',
            formation_code: formation.code,
            formation_name: formation.name,
            sport_type: sportType,
            slots: formation.slots,
            assignments: buildAssignmentsPayload(),
          },
        });
        if (error) throw error;
      }
      toast.success('Formação gravada');
      onCommitted?.();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro a gravar formação');
    } finally {
      setSaving(false);
    }
  }, [
    buildAssignmentsPayload,
    currentMinuteAbs,
    currentPartIndex,
    formation,
    matchId,
    mode,
    onCommitted,
    readonly,
    sportType,
    validation.error,
    validation.ok,
  ]);

  // ── Render ───────────────────────────────────────────────────────
  if (!formation) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Sem formações disponíveis para esta modalidade.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">
          {mode === 'initial' ? 'Formação inicial' : mode === 'live' ? 'Alterar tática' : 'Corrigir formação'}
        </CardTitle>
        <FormationPicker
          sportType={sportType}
          value={code}
          onChange={handleFormationChange}
          disabled={readonly || saving}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3">
          <PitchCanvas sportType={sportType}>
            {formation.slots.map((slot) => {
              const pid = assignments[slot.slot_id];
              const player: SlotTokenPlayer | null = pid
                ? {
                    player_id: pid,
                    name: playerById.get(pid)?.name ?? '—',
                    number: playerById.get(pid)?.number ?? null,
                  }
                : null;
              return (
                <SlotToken
                  key={slot.slot_id}
                  slot={slot}
                  player={player}
                  readonly={readonly}
                  onDragStartPlayer={(playerId, fromSlot) =>
                    setDragSource({ playerId, from: fromSlot })
                  }
                  onDropOnSlot={dropOnSlot}
                  onDoubleClick={releaseSlot}
                />
              );
            })}
          </PitchCanvas>
          <div className="md:max-h-[520px]">
            <BenchList
              players={bench}
              readonly={readonly}
              onDragStartPlayer={(playerId) => setDragSource({ playerId, from: 'bench' })}
              onDropToBench={dropOnBench}
              onDoubleClickPlayer={assignFirstFreeSlot}
            />
          </div>
        </div>

        {!validation.ok && (
          <div className="text-xs text-destructive">{validation.error}</div>
        )}

        {!readonly && (
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
            )}
            <Button size="sm" onClick={handleConfirm} disabled={!validation.ok || saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              {mode === 'live' ? 'Aplicar' : 'Confirmar'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper used by the suggested move RPC. Allows callers (e.g. drag-handlers
// that only want to move a single player without redrawing everything) to
// commit a tactical move directly.
export async function commitTacticalMove(args: {
  matchId: string;
  minuteAbs: number;
  partIndex: number;
  playerId: string;
  fromSlotId: string | null;
  toSlotId: string;
  role?: string | null;
}): Promise<void> {
  const { error } = await (supabase as any).rpc('apply_tactical_change', {
    p_match_id: args.matchId,
    p_minute_abs: args.minuteAbs,
    p_part_index: args.partIndex,
    p_change: {
      type: 'player_move',
      player_id: args.playerId,
      from_slot_id: args.fromSlotId,
      to_slot_id: args.toSlotId,
      role: args.role ?? null,
    },
  });
  if (error) throw error;
}

export async function commitSlotSwap(args: {
  matchId: string;
  minuteAbs: number;
  partIndex: number;
  aPlayerId: string;
  aSlotId: string;
  bPlayerId: string;
  bSlotId: string;
  aRole?: string | null;
  bRole?: string | null;
}): Promise<void> {
  const { error } = await (supabase as any).rpc('apply_tactical_change', {
    p_match_id: args.matchId,
    p_minute_abs: args.minuteAbs,
    p_part_index: args.partIndex,
    p_change: {
      type: 'slot_swap',
      a_player_id: args.aPlayerId,
      a_slot_id: args.aSlotId,
      b_player_id: args.bPlayerId,
      b_slot_id: args.bSlotId,
      a_role: args.aRole ?? null,
      b_role: args.bRole ?? null,
    },
  });
  if (error) throw error;
}
