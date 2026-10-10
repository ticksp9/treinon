/**
 * Pitch, "Football Manager" style: the chosen formation with the players on it.
 * Before kick-off ('setup') it is the team-selection screen; during the match it
 * shows time, estimated freshness, goals and cards.
 *
 * Interactions (drag, or tap one then the other):
 *  - player on pitch → another position: swap / move
 *  - player on pitch ↔ player on the bench: substitution
 *  - bench player → empty position: fill it (setup)
 *  - player on pitch → bench area: take out of the XI (setup)
 *  - selected player during the match: quick buttons for goal / yellow / red
 */
import { useMemo, useRef, useState } from 'react';
import { PitchCanvas } from './tactical/PitchCanvas';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { ArrowLeftRight, ListX, Repeat, Star, X, UserX } from 'lucide-react';
import { splitFormations, type SportTactics } from '@/lib/team-tactics';
import { customFormationCodes, promptNewFormation, removeCustomFormation, useFormationsVersion } from '@/lib/custom-formations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getFormation, listAvailableFormations, type FormationSlot } from '@/lib/tactical-formations';
import { fitScore, type LiveTactics, tacticsFormation } from '@/lib/live-tactics';
import { formatClock } from '@/lib/playing-time-seconds';
import { cn } from '@/lib/utils';
import { ratingBg } from '@/lib/player-card';

const NEW_FORMATION = '__new__';

export interface PitchPlayerInfo {
  player_id: string;
  name: string;
  number?: number | null;
  /** natural position (GK, CB, CM, ST…) */
  position?: string | null;
  /** preferred foot */
  foot?: string | null;
  /** total seconds played in this match */
  seconds: number;
  /** estimated freshness 0–100 */
  freshness: number;
  goals: number;
  yellow: number;
  red: number;
  /** current ability 1–10 (latest evaluation) — shown before the match */
  ability?: number | null;
  /** average of the last match ratings */
  formAvg?: number | null;
  formTrend?: 'up' | 'down' | 'flat';
  /** small badges, e.g. 'C' for captain */
  tags?: string[];
}

interface Props {
  sportType: string;
  tactics: LiveTactics;
  players: Map<string, PitchPlayerInfo>;
  /** bench player ids, already sorted */
  bench: string[];
  disabled?: boolean;
  /** 'setup' = before kick-off: pick the XI, show ability/form instead of time/freshness */
  mode?: 'live' | 'setup';
  /** bench player dropped on an empty slot (setup) */
  onFillSlot?: (slotId: string, playerId: string) => void;
  /** starter dragged to the bench (setup) */
  onBench?: (playerId: string) => void;
  /** a position dragged to a free spot of the pitch (x across, y from own goal) */
  onMoveSlot?: (slotId: string, x: number, y: number) => void;
  /** back to the positions of the formation */
  onResetPositions?: () => void;
  /** the team's tactics for this sport: listed first, default on top */
  teamTactics?: SportTactics;
  /** keep the formation in use as one of the team's tactics / as the default one */
  onKeepTactic?: (code: string, asDefault: boolean) => void;
  /** bench player did not come to the match */
  onAbsent?: (playerId: string) => void;
  /** during the match only these bench players can be marked absent (they never came on) */
  absentable?: Set<string>;
  onFormationChange: (code: string) => void;
  onSwap: (slotA: string, slotB: string) => void;
  onSubstitute: (outId: string, inId: string) => void;
  onEvent: (type: 'goal' | 'yellow_card' | 'red_card', playerId: string) => void;
}

type Src = { kind: 'pitch'; slotId: string; playerId: string } | { kind: 'bench'; playerId: string };
type Selection = Src | null;

const shortName = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

const freshnessColor = (f: number) => (f >= 70 ? 'bg-emerald-500' : f >= 45 ? 'bg-amber-500' : 'bg-red-500');
const trendIcon = (t?: 'up' | 'down' | 'flat') => (t === 'up' ? '▲' : t === 'down' ? '▼' : '');

/** How well the player fits the slot: natural zone, playable, or out of position. */
export function positionFit(slot: FormationSlot, position: string | null | undefined): 'natural' | 'ok' | 'out' | 'unknown' {
  if (!position) return 'unknown';
  const s = fitScore(slot, { player_id: '', position });
  return s >= 5 ? 'natural' : s >= 4 ? 'ok' : 'out';
}
const FIT_CLASS: Record<ReturnType<typeof positionFit>, string> = {
  natural: 'bg-emerald-600 text-white',
  ok: 'bg-emerald-700/90 text-white',
  out: 'bg-amber-500 text-amber-950',
  unknown: 'bg-black/55 text-white',
};

export function LivePitch({ sportType, tactics, players, bench, disabled, mode = 'live', onFillSlot, onBench, onAbsent, absentable, teamTactics, onKeepTactic, onMoveSlot, onResetPositions, onFormationChange, onSwap, onSubstitute, onEvent }: Props) {
  const setup = mode === 'setup';
  const [sel, setSel] = useState<Selection>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; label: string } | null>(null);
  const drag = useRef<{ src: Src; x0: number; y0: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  // the shape of the match, with the positions the coach moved by hand
  const formation = useMemo(() => tacticsFormation(sportType, tactics), [sportType, tactics.formation, tactics.layout]); // eslint-disable-line react-hooks/exhaustive-deps
  const pitchRef = useRef<HTMLDivElement>(null);
  useFormationsVersion(); // re-render when the coach adds a formation
  const formations = listAvailableFormations(sportType);
  const { mine: myTactics, others: otherFormations } = splitFormations(formations, teamTactics ?? { list: [], default: null });
  const inMyTactics = myTactics.some((f) => f.code === tactics.formation);
  const isDefaultTactic = myTactics.some((f) => f.code === tactics.formation && f.isDefault);
  const pickFormation = async (picked: string) => {
    const code = picked === NEW_FORMATION
      ? await promptNewFormation((await supabase.auth.getUser()).data.user?.id, sportType, (msg, ok) => (ok ? toast.success(msg) : toast.error(msg)))
      : picked;
    if (code) onFormationChange(code);
  };
  const selectedPlayer = sel ? players.get(sel.playerId) : null;

  const tapPitch = (slotId: string, playerId: string | null) => {
    if (disabled || suppressClick.current) return;
    if (!playerId) {
      if (sel?.kind === 'bench' && onFillSlot) { onFillSlot(slotId, sel.playerId); setSel(null); }
      else if (sel?.kind === 'pitch') { onSwap(sel.slotId, slotId); setSel(null); }
      return;
    }
    if (!sel) return setSel({ kind: 'pitch', slotId, playerId });
    if (sel.kind === 'pitch') {
      if (sel.slotId !== slotId) onSwap(sel.slotId, slotId);
      return setSel(null);
    }
    onSubstitute(playerId, sel.playerId); // bench → pitch
    setSel(null);
  };

  const tapBench = (playerId: string) => {
    if (disabled || suppressClick.current) return;
    if (sel?.kind === 'pitch') {
      onSubstitute(sel.playerId, playerId);
      return setSel(null);
    }
    setSel(sel?.kind === 'bench' && sel.playerId === playerId ? null : { kind: 'bench', playerId });
  };

  // ── Drag and drop (pointer events: works with finger, pencil and mouse) ──
  const drop = (src: Src, target: string | null) => {
    if (!target) return;
    if (target.startsWith('slot:')) {
      const slotId = target.slice(5);
      const occupant = tactics.slots[slotId] ?? null;
      if (src.kind === 'pitch') {
        if (src.slotId !== slotId) onSwap(src.slotId, slotId);
      } else if (occupant) onSubstitute(occupant, src.playerId);
      else onFillSlot?.(slotId, src.playerId);
    } else if (target.startsWith('bench:')) {
      if (src.kind === 'pitch') onSubstitute(src.playerId, target.slice(6));
    } else if (target === 'bencharea') {
      if (src.kind === 'pitch' && setup) onBench?.(src.playerId);
    }
  };
  const dragProps = (src: Src) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (disabled) return;
      drag.current = { src, x0: e.clientX, y0: e.clientY, moved: false };
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 10) return;
      d.moved = true;
      const p = players.get(d.src.playerId);
      setGhost({ x: e.clientX, y: e.clientY, label: p ? `${p.number ?? ''} ${shortName(p.name)}`.trim() : '' });
    },
    onPointerUp: (e: React.PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d || !d.moved) return;
      setGhost(null);
      setSel(null);
      // the click that follows a drag must not count as a tap
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 50);
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-drop]');
      const target = el?.getAttribute('data-drop') ?? null;
      // a starter dropped on a free spot of the pitch (or just nudged): the position moves there
      const box = pitchRef.current?.getBoundingClientRect();
      if (d.src.kind === 'pitch' && onMoveSlot && box && (!target || target === `slot:${d.src.slotId}`)
          && e.clientX >= box.left && e.clientX <= box.right && e.clientY >= box.top && e.clientY <= box.bottom) {
        onMoveSlot(d.src.slotId, (e.clientX - box.left) / box.width, 1 - (e.clientY - box.top) / box.height);
        return;
      }
      drop(d.src, target);
    },
    onPointerCancel: () => { drag.current = null; setGhost(null); },
  });

  const hint = !sel
    ? (onMoveSlot ? 'Arraste um jogador: para outro (troca), ou para um espaço livre (muda a posição).' : 'Arraste um jogador, ou toque para o selecionar.')
    : sel.kind === 'pitch'
      ? 'Toque noutra posição para trocar, ou num suplente para substituir.'
      : setup ? 'Toque no titular a trocar, ou numa posição livre.' : 'Toque no jogador em campo que vai sair.';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Select value={tactics.formation} onValueChange={pickFormation} disabled={disabled}>
          <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {/* a formation made by a colleague is not in my list but must still show as selected */}
            {!formations.some((f) => f.code === tactics.formation) && !inMyTactics && <SelectItem value={tactics.formation}>{tactics.formation}</SelectItem>}
            {myTactics.length > 0 && (
              <SelectGroup>
                <SelectLabel>As nossas táticas</SelectLabel>
                {myTactics.map((f) => <SelectItem key={f.code} value={f.code}>{f.isDefault ? '★ ' : ''}{f.label}</SelectItem>)}
              </SelectGroup>
            )}
            <SelectGroup>
              {myTactics.length > 0 && <SelectLabel>Outras formações</SelectLabel>}
              {otherFormations.map((f) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}
            </SelectGroup>
            <SelectItem value={NEW_FORMATION} className="font-medium text-primary">+ Nova formação…</SelectItem>
          </SelectContent>
        </Select>
        {setup && !disabled && teamTactics?.default && tactics.formation !== teamTactics.default && (
          <button type="button" className="flex shrink-0 items-center gap-1 rounded border border-primary bg-primary/10 px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20"
            onClick={() => onFormationChange(teamTactics.default!)} title="Mudar este jogo para a tática da equipa">
            <Star className="h-3.5 w-3.5 fill-current" />Usar a nossa tática: {teamTactics.default}
          </button>
        )}
        {onResetPositions && !disabled && tactics.layout && Object.keys(tactics.layout).length > 0 && (
          <button type="button" className="flex shrink-0 items-center gap-1 rounded border px-2 py-1.5 text-xs font-medium hover:bg-muted" onClick={onResetPositions} title="Voltar às posições da formação">
            Repor posições
          </button>
        )}
        {onKeepTactic && !disabled && !isDefaultTactic && (
          <button type="button" className="flex shrink-0 items-center gap-1 rounded border px-2 py-1.5 text-xs font-medium hover:bg-muted"
            onClick={() => onKeepTactic(tactics.formation, inMyTactics)}
            title={inMyTactics ? 'Os próximos jogos abrem com esta tática' : 'Juntar esta formação às táticas da equipa'}>
            <Star className="h-3.5 w-3.5" />{inMyTactics ? 'Tornar a nossa tática por defeito' : 'Guardar nas nossas táticas'}
          </button>
        )}
        {customFormationCodes(sportType).includes(tactics.formation) && !disabled && (
          <button type="button" className="shrink-0 rounded p-1.5 text-muted-foreground hover:text-destructive" aria-label={`Apagar a formação ${tactics.formation} da lista`} title="Apagar esta formação da minha lista"
            onClick={async () => {
              if (!window.confirm(`Apagar a formação ${tactics.formation} da sua lista? Este jogo continua com ela até escolher outra.`)) return;
              await removeCustomFormation((await supabase.auth.getUser()).data.user?.id, sportType, tactics.formation);
              toast.success(`Formação ${tactics.formation} apagada da lista.`);
            }}>
            <ListX className="h-4 w-4" />
          </button>
        )}
        <p className="ml-auto text-xs text-muted-foreground text-right">{hint}</p>
      </div>

      {/* width capped so the whole pitch + bench fit on the screen */}
      <div className="mx-auto w-full select-none" style={{ maxWidth: setup ? 'min(34rem, 62vh)' : 'min(28rem, 40vh)' }}>
        <div ref={pitchRef}>
        <PitchCanvas sportType={sportType}>
          {formation?.slots.map((slot) => {
            const pid = tactics.slots[slot.slot_id] ?? null;
            const p = pid ? players.get(pid) : null;
            const isSel = sel?.kind === 'pitch' && sel.slotId === slot.slot_id;
            const fit = p ? positionFit(slot, p.position) : 'unknown';
            return (
              <button
                key={slot.slot_id}
                type="button"
                data-drop={`slot:${slot.slot_id}`}
                onClick={() => tapPitch(slot.slot_id, pid)}
                {...(pid ? dragProps({ kind: 'pitch', slotId: slot.slot_id, playerId: pid }) : {})}
                className={cn(
                  'absolute flex w-[4.75rem] -translate-x-1/2 translate-y-1/2 flex-col items-center gap-0.5 focus:outline-none',
                  !p && sel && 'animate-pulse',
                )}
                style={{ left: `${slot.x * 100}%`, bottom: `${slot.y * 100}%`, touchAction: 'none' }}
                aria-label={p ? `${p.name}, ${slot.label}` : `${slot.label} livre`}
              >
                <span
                  className={cn(
                    'relative flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-sm font-bold shadow-md transition',
                    slot.role === 'goalkeeper' ? 'bg-amber-400 text-amber-950 border-amber-100' : 'bg-primary text-primary-foreground border-white/80',
                    isSel && 'ring-4 ring-accent scale-110',
                    !p && 'border-dashed opacity-50',
                  )}
                >
                  {p ? (p.number ?? '•') : slot.label}
                  {p?.tags?.includes('C') && (
                    <span className="absolute -bottom-1 -left-2 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-accent-foreground" title="Capitão">C</span>
                  )}
                  {p && (p.goals > 0 || p.yellow > 0 || p.red > 0) && (
                    <span className="absolute -right-2 -top-2 flex gap-0.5">
                      {p.goals > 0 && <span className="rounded-full bg-white px-1 text-[10px] leading-4 text-black">⚽{p.goals > 1 ? p.goals : ''}</span>}
                      {p.red > 0 ? <span className="h-3.5 w-2.5 rounded-sm bg-red-600" /> : p.yellow > 0 && <span className="h-3.5 w-2.5 rounded-sm bg-yellow-400" />}
                    </span>
                  )}
                </span>
                {p && (
                  <>
                    <span className="max-w-full truncate rounded bg-black/60 px-1 text-[10px] font-semibold leading-4 text-white">{shortName(p.name)}</span>
                    <span className="flex items-center gap-0.5">
                      <span
                        className={cn('rounded px-1 text-[9px] font-bold leading-4', FIT_CLASS[fit])}
                        title={fit === 'out' ? `Fora de posição (natural: ${p.position})` : p.position ? `Posição natural: ${p.position}` : 'Posição'}
                      >
                        {slot.label}
                      </span>
                      {setup && p.ability != null && (
                        <span className={cn('rounded px-1 font-mono text-[9px] font-bold leading-4', ratingBg(p.ability))} title="Nota da última avaliação">{p.ability.toFixed(1)}</span>
                      )}
                    </span>
                    {!setup && (
                      <span className="h-1 w-10 overflow-hidden rounded bg-black/40" title={`Frescura estimada ${p.freshness}%`}>
                        <span className={cn('block h-full', freshnessColor(p.freshness))} style={{ width: `${p.freshness}%` }} />
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </PitchCanvas>
        </div>
      </div>

      {/* Quick actions for the selected player */}
      {selectedPlayer && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-2">
          <span className="mr-auto text-sm font-medium">
            {selectedPlayer.number ? `${selectedPlayer.number}. ` : ''}{selectedPlayer.name}
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {setup
                ? `${selectedPlayer.position ?? '—'} · nota ${selectedPlayer.ability?.toFixed(1) ?? '—'} · forma ${selectedPlayer.formAvg?.toFixed(1) ?? '—'}`
                : `${formatClock(selectedPlayer.seconds)} · frescura ${selectedPlayer.freshness}%`}
            </span>
          </span>
          {sel?.kind === 'pitch' && setup && onBench && (
            <Button size="sm" variant="outline" onClick={() => { onBench(sel.playerId); setSel(null); }}>Para o banco</Button>
          )}
          {sel?.kind === 'pitch' && !setup && (
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

      {/* Bench */}
      <div data-drop="bencharea" className={cn('rounded-md', setup && 'border border-dashed p-2')}>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Repeat className="h-3.5 w-3.5" /> {setup ? `Suplentes (${bench.length}) — arraste para o campo · ✕ = não veio` : 'Banco — menos minutos primeiro'}
        </p>
        <div className={cn('flex gap-2', setup ? 'flex-wrap' : 'overflow-x-auto pb-1')}>
          {bench.length === 0 && <span className="text-sm text-muted-foreground">Sem suplentes.</span>}
          {bench.map((id, i) => {
            const p = players.get(id);
            if (!p) return null;
            const isSel = sel?.kind === 'bench' && sel.playerId === id;
            return (
              <div key={id} className="relative shrink-0">
              {onAbsent && (setup || absentable?.has(id)) && (
                <button type="button" onClick={() => onAbsent(id)} aria-label={`${p.name} está ausente: retirar do jogo`} title="Não veio ao jogo: retirar"
                  className="absolute -right-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-destructive shadow-sm hover:bg-destructive hover:text-destructive-foreground">
                  <UserX className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                data-drop={`bench:${id}`}
                onClick={() => tapBench(id)}
                {...dragProps({ kind: 'bench', playerId: id })}
                style={{ touchAction: setup ? 'none' : 'pan-x' }}
                className={cn(
                  'flex min-w-[6.5rem] shrink-0 select-none flex-col items-start rounded-md border bg-card px-2.5 py-1.5 text-left transition',
                  isSel && 'border-accent ring-2 ring-accent/40',
                  sel?.kind === 'pitch' && 'border-dashed border-primary',
                )}
              >
                <span className="flex w-full items-center gap-1 text-sm font-medium">
                  <span className="font-mono text-xs text-muted-foreground">{p.number ?? '–'}</span>
                  <span className="truncate">{shortName(p.name)}</span>
                </span>
                {setup ? (
                  <span className="mt-0.5 flex items-center gap-1 font-mono text-[11px]">
                    <span className="rounded bg-muted px-1 font-sans font-semibold">{p.position ?? '—'}</span>
                    <span className={cn('rounded px-1 font-bold', ratingBg(p.ability))}>{p.ability?.toFixed(1) ?? '—'}</span>
                    {p.formAvg != null && <span className="text-muted-foreground">{p.formAvg.toFixed(1)}{trendIcon(p.formTrend)}</span>}
                  </span>
                ) : (
                  <>
                    <span className={cn('font-mono text-[11px]', i === 0 ? 'font-semibold text-accent' : 'text-muted-foreground')}>
                      {formatClock(p.seconds)}{i === 0 ? ' · menos' : ''}
                    </span>
                    <span className="mt-1 h-1 w-full overflow-hidden rounded bg-muted">
                      <span className={cn('block h-full', freshnessColor(p.freshness))} style={{ width: `${p.freshness}%` }} />
                    </span>
                  </>
                )}
              </button>
              </div>
            );
          })}
        </div>
      </div>

      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <ArrowLeftRight className="h-3 w-3" /> {setup
          ? 'Etiqueta verde = posição natural; amarela = fora de posição. Nota = última avaliação (1–10).'
          : 'A barra de frescura é uma estimativa pelo tempo seguido em campo e no banco.'}
      </p>

      {ghost && (
        <div
          className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-[130%] rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground shadow-lg"
          style={{ left: ghost.x, top: ghost.y }}
        >
          {ghost.label}
        </div>
      )}
    </div>
  );
}
