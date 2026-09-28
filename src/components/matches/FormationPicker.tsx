/**
 * Reusable visual formation picker.
 *
 * Two modes:
 *  - mode="readonly": just shows slots on a normalized pitch
 *  - mode="assign":   lets the user assign a player to each slot (click slot → list)
 *
 * Coordinates are normalized [0,1]; y=0 is the team's own goal line,
 * y=1 the opponent's. The picker renders the pitch vertically with the
 * team attacking upwards (typical tactic-board orientation).
 */
import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import {
  listAvailableFormations,
  getFormation,
  expectedPlayersForSport,
  roleLabel,
  type Formation,
  type FormationSlot,
  type SportType,
} from '@/lib/tactical-formations';

export interface FormationPlayerOption {
  id: string;
  name: string;
  number?: number | null;
  position?: string | null;
}

export interface SlotAssignment {
  slot_id: string;
  player_id: string | null;
}

interface Props {
  sportType: SportType | string;
  /** Initial formation code; if absent, first available is used. */
  initialCode?: string;
  /** Pool of players that can be assigned (typically starters). */
  players: FormationPlayerOption[];
  /** Pre-existing assignments to seed the picker. */
  initialAssignments?: SlotAssignment[];
  /** Called whenever (formation, assignments) change. */
  onChange?: (state: {
    formation: Formation;
    assignments: SlotAssignment[];
    allAssigned: boolean;
  }) => void;
  /** Show internal confirm/cancel actions. */
  showActions?: boolean;
  onConfirm?: (state: { formation: Formation; assignments: SlotAssignment[] }) => void;
  onCancel?: () => void;
  readonly?: boolean;
  title?: string;
}

const FIELD_RATIO = 1.55; // height / width

export function FormationPicker({
  sportType,
  initialCode,
  players,
  initialAssignments,
  onChange,
  showActions = false,
  onConfirm,
  onCancel,
  readonly,
  title = 'Formação tática',
}: Props) {
  const available = useMemo(() => listAvailableFormations(sportType as SportType), [sportType]);
  const expected = useMemo(() => expectedPlayersForSport(sportType), [sportType]);

  const [code, setCode] = useState<string>(initialCode ?? available[0]?.code ?? '');
  const formation = useMemo(() => getFormation(sportType, code) ?? available[0], [sportType, code, available]);

  const [assignments, setAssignments] = useState<SlotAssignment[]>(() => {
    if (!formation) return [];
    const map = new Map((initialAssignments ?? []).map(a => [a.slot_id, a.player_id]));
    return formation.slots.map(s => ({ slot_id: s.slot_id, player_id: map.get(s.slot_id) ?? null }));
  });

  // When formation changes, try to keep assignments by slot_id, else by role compatibility
  function handleFormationChange(newCode: string) {
    const newFormation = getFormation(sportType, newCode);
    if (!newFormation) return;
    setCode(newCode);
    const oldMap = new Map(assignments.map(a => [a.slot_id, a.player_id]));
    const next: SlotAssignment[] = newFormation.slots.map(s => ({
      slot_id: s.slot_id,
      player_id: oldMap.get(s.slot_id) ?? null,
    }));
    setAssignments(next);
    emit(newFormation, next);
  }

  function assignPlayerToSlot(slot_id: string, player_id: string | null) {
    setAssignments(prev => {
      const next = prev.map(a => {
        if (a.slot_id === slot_id) return { ...a, player_id };
        // ensure a player isn't doubly assigned
        if (player_id && a.player_id === player_id) return { ...a, player_id: null };
        return a;
      });
      emit(formation!, next);
      return next;
    });
  }

  function emit(f: Formation, next: SlotAssignment[]) {
    if (!onChange) return;
    onChange({
      formation: f,
      assignments: next,
      allAssigned: next.every(a => !!a.player_id) && next.length === expected,
    });
  }

  const playerById = useMemo(() => {
    const m = new Map<string, FormationPlayerOption>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const usedIds = useMemo(() => new Set(assignments.map(a => a.player_id).filter(Boolean) as string[]), [assignments]);

  if (!formation) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Não há formações disponíveis para esta modalidade.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{expected} jog.</Badge>
          {!readonly && (
            <Select value={code} onValueChange={handleFormationChange}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {available.map(f => (
                  <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {readonly && <Badge>{formation.name}</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        <FieldRenderer
          formation={formation}
          assignments={assignments}
          playerById={playerById}
        />
        {!readonly && (
          <div className="mt-3 space-y-1.5">
            {formation.slots.map((slot, idx) => (
              <SlotRow
                key={slot.slot_id}
                index={idx + 1}
                slot={slot}
                value={assignments.find(a => a.slot_id === slot.slot_id)?.player_id ?? ''}
                players={players}
                usedIds={usedIds}
                onChange={(pid) => assignPlayerToSlot(slot.slot_id, pid || null)}
              />
            ))}
          </div>
        )}
        {showActions && (
          <div className="mt-4 flex justify-end gap-2">
            {onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
            )}
            {onConfirm && (
              <Button
                size="sm"
                onClick={() => onConfirm({ formation, assignments })}
                disabled={!assignments.every(a => !!a.player_id)}
              >
                <Check className="w-4 h-4 mr-1" /> Confirmar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FieldRenderer({
  formation,
  assignments,
  playerById,
}: {
  formation: Formation;
  assignments: SlotAssignment[];
  playerById: Map<string, FormationPlayerOption>;
}) {
  const widthPct = 100;
  return (
    <div
      className="relative w-full rounded-md border bg-emerald-700/15 overflow-hidden"
      style={{ paddingTop: `${FIELD_RATIO * 100}%` }}
      aria-label="Campo tático"
    >
      {/* Pitch lines */}
      <div className="absolute inset-0">
        <div className="absolute left-0 right-0 top-1/2 border-t border-emerald-500/40" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1/4 aspect-square rounded-full border border-emerald-500/40" />
        <div className="absolute left-[20%] right-[20%] top-0 h-[10%] border-b border-x border-emerald-500/40" />
        <div className="absolute left-[20%] right-[20%] bottom-0 h-[10%] border-t border-x border-emerald-500/40" />
      </div>
      {/* Slots — y=0 (own goal) at bottom, y=1 at top */}
      {formation.slots.map(slot => {
        const a = assignments.find(x => x.slot_id === slot.slot_id);
        const player = a?.player_id ? playerById.get(a.player_id) : null;
        const left = `${slot.x * widthPct}%`;
        const bottom = `${slot.y * 100}%`;
        return (
          <div
            key={slot.slot_id}
            className="absolute -translate-x-1/2 translate-y-1/2 flex flex-col items-center"
            style={{ left, bottom }}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                player
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background/80 text-muted-foreground border-dashed border-muted-foreground/40'
              }`}
              title={`${slot.label} · ${roleLabel(slot.role)}`}
            >
              {player ? (player.number ?? slot.label) : slot.label}
            </div>
            {player && (
              <div className="mt-0.5 text-[10px] max-w-[80px] truncate text-center text-foreground/80">
                {player.name.split(' ')[0]}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SlotRow({
  index,
  slot,
  value,
  players,
  usedIds,
  onChange,
}: {
  index: number;
  slot: FormationSlot;
  value: string;
  players: FormationPlayerOption[];
  usedIds: Set<string>;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="w-8 justify-center shrink-0">{index}</Badge>
      <div className="w-20 text-xs text-muted-foreground shrink-0">
        <div className="font-medium text-foreground">{slot.label}</div>
        <div className="truncate">{roleLabel(slot.role)}</div>
      </div>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8"><SelectValue placeholder="Atribuir jogador" /></SelectTrigger>
        <SelectContent>
          {players.map(p => {
            const taken = usedIds.has(p.id) && p.id !== value;
            return (
              <SelectItem key={p.id} value={p.id} disabled={taken}>
                {p.number ? `${p.number} - ` : ''}{p.name}
                {taken ? ' (atribuído)' : ''}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
