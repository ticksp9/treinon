/**
 * Bench list: draggable player chips. Accepts drops from on-field slots
 * (player returns to bench).
 */
import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface BenchPlayer {
  player_id: string;
  name: string;
  number?: number | null;
  position?: string | null;
}

interface Props {
  players: BenchPlayer[];
  readonly?: boolean;
  onDragStartPlayer?: (playerId: string, fromSlotId: 'bench') => void;
  onDropToBench?: () => void;
  onDoubleClickPlayer?: (playerId: string) => void;
}

export function BenchList({
  players,
  readonly,
  onDragStartPlayer,
  onDropToBench,
  onDoubleClickPlayer,
}: Props) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        String(p.number ?? '').includes(q) ||
        (p.position ?? '').toLowerCase().includes(q),
    );
  }, [players, filter]);

  return (
    <div
      className="flex flex-col rounded-md border bg-card h-full min-h-[160px]"
      onDragOver={(e) => {
        if (readonly) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        if (readonly) return;
        e.preventDefault();
        onDropToBench?.();
      }}
      aria-label="Banco de jogadores"
    >
      <div className="p-2 border-b">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar (nome, nº, posição)…"
          className="h-8 text-sm"
        />
      </div>
      <ScrollArea className="flex-1 max-h-[420px]">
        <ul className="p-1.5 space-y-1">
          {filtered.length === 0 && (
            <li className="text-xs text-muted-foreground px-2 py-3 text-center">
              Sem jogadores no banco.
            </li>
          )}
          {filtered.map((p) => (
            <li
              key={p.player_id}
              draggable={!readonly}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/x-player-id', p.player_id);
                e.dataTransfer.setData('text/x-from-slot', 'bench');
                onDragStartPlayer?.(p.player_id, 'bench');
              }}
              onDoubleClick={() => onDoubleClickPlayer?.(p.player_id)}
              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-grab active:cursor-grabbing min-h-[44px]"
            >
              <Badge variant="outline" className="w-7 justify-center shrink-0">
                {p.number ?? '–'}
              </Badge>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{p.name}</div>
                {p.position && (
                  <div className="text-[10px] text-muted-foreground truncate">{p.position}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
