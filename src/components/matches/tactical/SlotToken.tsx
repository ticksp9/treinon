/**
 * Slot token rendered inside the PitchCanvas at normalized (x,y).
 * Supports HTML5 drag-and-drop. Pointer-event fallback is handled by
 * FormationEditor via a long-press wrapper.
 */
import { type CSSProperties } from 'react';
import type { FormationSlot } from '@/lib/tactical-formations';
import { roleLabel } from '@/lib/tactical-formations';

export interface SlotTokenPlayer {
  player_id: string;
  name: string;
  number?: number | null;
}

interface Props {
  slot: FormationSlot;
  player: SlotTokenPlayer | null;
  state?: 'idle' | 'highlight' | 'invalid';
  readonly?: boolean;
  onDragStartPlayer?: (playerId: string, fromSlotId: string) => void;
  onDropOnSlot?: (slotId: string) => void;
  onDragOverSlot?: (slotId: string) => void;
  onDragLeaveSlot?: (slotId: string) => void;
  onDoubleClick?: (slotId: string) => void;
}

export function SlotToken({
  slot,
  player,
  state = 'idle',
  readonly,
  onDragStartPlayer,
  onDropOnSlot,
  onDragOverSlot,
  onDragLeaveSlot,
  onDoubleClick,
}: Props) {
  const left = `${slot.x * 100}%`;
  const bottom = `${slot.y * 100}%`;
  const style: CSSProperties = { left, bottom };

  const bg =
    state === 'highlight'
      ? 'bg-amber-400 text-amber-950 border-amber-500'
      : state === 'invalid'
        ? 'bg-destructive/80 text-destructive-foreground border-destructive'
        : player
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-background/80 text-muted-foreground border-dashed border-muted-foreground/50';

  return (
    <div
      className="absolute -translate-x-1/2 translate-y-1/2 flex flex-col items-center select-none"
      style={style}
    >
      <div
        role="button"
        aria-label={`${slot.label} · ${roleLabel(slot.role)}${player ? ` · ${player.name}` : ' · vazio'}`}
        draggable={!readonly && !!player}
        onDragStart={(e) => {
          if (!player) return;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/x-player-id', player.player_id);
          e.dataTransfer.setData('text/x-from-slot', slot.slot_id);
          onDragStartPlayer?.(player.player_id, slot.slot_id);
        }}
        onDragOver={(e) => {
          if (readonly) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          onDragOverSlot?.(slot.slot_id);
        }}
        onDragLeave={() => onDragLeaveSlot?.(slot.slot_id)}
        onDrop={(e) => {
          if (readonly) return;
          e.preventDefault();
          onDropOnSlot?.(slot.slot_id);
        }}
        onDoubleClick={() => onDoubleClick?.(slot.slot_id)}
        data-slot-id={slot.slot_id}
        className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-xs font-bold border-2 shadow-md transition-colors cursor-grab active:cursor-grabbing ${bg}`}
        title={`${slot.label} · ${roleLabel(slot.role)}`}
      >
        {player ? (player.number ?? slot.label) : slot.label}
      </div>
      <div className="mt-0.5 text-[10px] max-w-[80px] truncate text-center text-foreground/90 drop-shadow">
        {player ? player.name.split(' ')[0] : roleLabel(slot.role)}
      </div>
    </div>
  );
}
