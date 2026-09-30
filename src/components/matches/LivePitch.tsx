/**
 * Live pitch, "Football Manager" style: the chosen formation with the players
 * who are on the field right now, their time, estimated freshness, goals and cards.
 *
 * Touch interactions (one hand on the touchline):
 *  - player on pitch → another player on pitch: swap positions
 *  - player on pitch ↔ player on the bench: substitution
 *  - selected player: quick buttons for goal / yellow / red
 */
import { useMemo, useState } from 'react';
import { PitchCanvas } from './tactical/PitchCanvas';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeftRight, Repeat, X } from 'lucide-react';
import { getFormation, listAvailableFormations } from '@/lib/tactical-formations';
import { type LiveTactics } from '@/lib/live-tactics';
import { formatClock } from '@/lib/playing-time-seconds';
import { cn } from '@/lib/utils';

export interface PitchPlayerInfo {
  player_id: string;
  name: string;
  number?: number | null;
  /** total seconds played in this match */
  seconds: number;
  /** estimated freshness 0–100 */
  freshness: number;
  goals: number;
  yellow: number;
  red: number;
}

interface Props {
  sportType: string;
  tactics: LiveTactics;
  players: Map<string, PitchPlayerInfo>;
  /** bench player ids, already sorted (least played first) */
  bench: string[];
  disabled?: boolean;
  onFormationChange: (code: string) => void;
  onSwap: (slotA: string, slotB: string) => void;
  onSubstitute: (outId: string, inId: string) => void;
  onEvent: (type: 'goal' | 'yellow_card' | 'red_card', playerId: string) => void;
}

type Selection = { kind: 'pitch'; slotId: string; playerId: string } | { kind: 'bench'; playerId: string } | null;

const shortName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

const freshnessColor = (f: number) => (f >= 70 ? 'bg-emerald-500' : f >= 45 ? 'bg-amber-500' : 'bg-red-500');

export function LivePitch({ sportType, tactics, players, bench, disabled, onFormationChange, onSwap, onSubstitute, onEvent }: Props) {
  const [sel, setSel] = useState<Selection>(null);
  const formation = useMemo(() => getFormation(sportType, tactics.formation), [sportType, tactics.formation]);
  const formations = listAvailableFormations(sportType);
  const selectedPlayer = sel ? players.get(sel.playerId) : null;

  const tapPitch = (slotId: string, playerId: string | null) => {
    if (disabled || !playerId) return;
    if (!sel) return setSel({ kind: 'pitch', slotId, playerId });
    if (sel.kind === 'pitch') {
      if (sel.slotId !== slotId) onSwap(sel.slotId, slotId);
      return setSel(null);
    }
    onSubstitute(playerId, sel.playerId); // bench → pitch
    setSel(null);
  };

  const tapBench = (playerId: string) => {
    if (disabled) return;
    if (sel?.kind === 'pitch') {
      onSubstitute(sel.playerId, playerId);
      return setSel(null);
    }
    setSel(sel?.kind === 'bench' && sel.playerId === playerId ? null : { kind: 'bench', playerId });
  };

  const hint = !sel
    ? 'Toque num jogador para o selecionar.'
    : sel.kind === 'pitch'
      ? 'Toque noutro jogador para trocar de posição, ou num suplente para substituir.'
      : 'Toque no jogador em campo que vai sair.';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Select value={tactics.formation} onValueChange={onFormationChange} disabled={disabled}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {formations.map((f) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground text-right">{hint}</p>
      </div>

      {/* width capped so the whole pitch + bench fit on a phone screen */}
      <div className="mx-auto w-full" style={{ maxWidth: 'min(28rem, 40vh)' }}>
        <PitchCanvas sportType={sportType}>
          {formation?.slots.map((slot) => {
            const pid = tactics.slots[slot.slot_id] ?? null;
            const p = pid ? players.get(pid) : null;
            const isSel = sel?.kind === 'pitch' && sel.slotId === slot.slot_id;
            return (
              <button
                key={slot.slot_id}
                type="button"
                onClick={() => tapPitch(slot.slot_id, pid)}
                className="absolute flex w-[4.5rem] -translate-x-1/2 translate-y-1/2 flex-col items-center gap-0.5 focus:outline-none"
                style={{ left: `${slot.x * 100}%`, bottom: `${slot.y * 100}%` }}
                aria-label={p ? `${p.name}, ${slot.label}` : `${slot.label} livre`}
              >
                <span
                  className={cn(
                    'relative flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-sm font-bold shadow-md transition',
                    slot.role === 'goalkeeper' ? 'bg-amber-400 text-amber-950 border-amber-100' : 'bg-primary text-primary-foreground border-white/80',
                    isSel && 'ring-4 ring-accent scale-110',
                    !p && 'opacity-40',
                  )}
                >
                  {p?.number ?? slot.label}
                  {p && (p.goals > 0 || p.yellow > 0 || p.red > 0) && (
                    <span className="absolute -right-2 -top-2 flex gap-0.5">
                      {p.goals > 0 && <span className="rounded-full bg-white px-1 text-[10px] leading-4 text-black">⚽{p.goals > 1 ? p.goals : ''}</span>}
                      {p.red > 0 ? <span className="h-3.5 w-2.5 rounded-sm bg-red-600" /> : p.yellow > 0 && <span className="h-3.5 w-2.5 rounded-sm bg-yellow-400" />}
                    </span>
                  )}
                </span>
                {p && (
                  <>
                    <span className="max-w-full truncate rounded bg-black/55 px-1 text-[10px] font-semibold leading-4 text-white">{shortName(p.name)}</span>
                    <span className="h-1 w-10 overflow-hidden rounded bg-black/40" title={`Frescura estimada ${p.freshness}%`}>
                      <span className={cn('block h-full', freshnessColor(p.freshness))} style={{ width: `${p.freshness}%` }} />
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </PitchCanvas>
      </div>

      {/* Quick actions for the selected player */}
      {selectedPlayer && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
          <span className="mr-auto text-sm font-medium">
            {selectedPlayer.number ? `${selectedPlayer.number}. ` : ''}{selectedPlayer.name}
            <span className="ml-2 font-mono text-xs text-muted-foreground">{formatClock(selectedPlayer.seconds)} · frescura {selectedPlayer.freshness}%</span>
          </span>
          {sel?.kind === 'pitch' && (
            <>
              <Button size="sm" variant="outline" onClick={() => { onEvent('goal', sel.playerId); setSel(null); }}>⚽ Golo</Button>
              <Button size="sm" variant="outline" onClick={() => { onEvent('yellow_card', sel.playerId); setSel(null); }}>
                <span className="mr-1 inline-block h-3.5 w-2.5 rounded-sm bg-yellow-400" />Amarelo
              </Button>
              <Button size="sm" variant="outline" onClick={() => { onEvent('red_card', sel.playerId); setSel(null); }}>
                <span className="mr-1 inline-block h-3.5 w-2.5 rounded-sm bg-red-600" />Vermelho
              </Button>
            </>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSel(null)} aria-label="Cancelar seleção"><X className="h-4 w-4" /></Button>
        </div>
      )}

      {/* Bench, least played first */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Repeat className="h-3.5 w-3.5" /> Banco — menos minutos primeiro
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {bench.length === 0 && <span className="text-sm text-muted-foreground">Sem suplentes.</span>}
          {bench.map((id, i) => {
            const p = players.get(id);
            if (!p) return null;
            const isSel = sel?.kind === 'bench' && sel.playerId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => tapBench(id)}
                className={cn(
                  'flex min-w-[6.5rem] shrink-0 flex-col items-start rounded-md border bg-card px-2.5 py-1.5 text-left transition',
                  isSel && 'border-accent ring-2 ring-accent/40',
                  sel?.kind === 'pitch' && 'border-dashed border-primary',
                )}
              >
                <span className="flex w-full items-center gap-1 text-sm font-medium">
                  <span className="font-mono text-xs text-muted-foreground">{p.number ?? '–'}</span>
                  <span className="truncate">{shortName(p.name)}</span>
                </span>
                <span className={cn('font-mono text-[11px]', i === 0 ? 'font-semibold text-accent' : 'text-muted-foreground')}>
                  {formatClock(p.seconds)}{i === 0 ? ' · menos' : ''}
                </span>
                <span className="mt-1 h-1 w-full overflow-hidden rounded bg-muted">
                  <span className={cn('block h-full', freshnessColor(p.freshness))} style={{ width: `${p.freshness}%` }} />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <ArrowLeftRight className="h-3 w-3" /> A barra de frescura é uma estimativa pelo tempo seguido em campo e no banco.
      </p>
    </div>
  );
}
