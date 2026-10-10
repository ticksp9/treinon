/**
 * The live match at a glance, always on screen: score, clock, part — and the things a coach
 * records in a hurry (goal, opponent goal, cards, substitution, end of the part).
 * It stays at the top while the pitch and the list of incidents scroll underneath.
 */
import { AlertTriangle, ArrowLeftRight, Clock, CloudOff, Pause, Play, Square, WifiOff } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  teamName: string;
  opponentName: string;
  goalsFor: number;
  goalsAgainst: number;
  phase: 'playing' | 'interval';
  partLabel: string;
  /** mm:ss of the current part */
  clock: string;
  /** minute of the match, e.g. 37 */
  minute: number;
  isRunning: boolean;
  isOvertime: boolean;
  isOnline: boolean;
  syncProblem: boolean;
  endPartLabel: string;
  isLastPart: boolean;
  nextPartLabel: string;
  onPauseResume: () => void;
  onEndPart: () => void;
  onStartNextPart: () => void;
  onGoal: () => void;
  onOpponentGoal: () => void;
  onYellow: () => void;
  onRed: () => void;
  onSubstitution: () => void;
  /** a player is selected on the pitch: Golo / Amarelo / Vermelho are recorded for him at once */
  selectedName?: string | null;
}

export function LiveHud(p: Props) {
  const action = 'h-12 flex-1 min-w-0 flex-col gap-0.5 px-1 text-[11px] font-semibold leading-none sm:flex-row sm:gap-1.5 sm:text-sm';
  // The page content scrolls inside the app layout, where "sticky" has nothing to stick to.
  // So the bar is fixed to the screen, exactly over a spacer that keeps its place in the page
  // (same left edge and width, whatever the side menu or the rotation of the tablet).
  const spacer = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ left: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const r = spacer.current?.getBoundingClientRect();
      const h = bar.current?.offsetHeight ?? 0;
      if (r) setBox((b) => (b && b.left === r.left && b.width === r.width && b.height === h ? b : { left: r.left, width: r.width, height: h }));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && spacer.current) ro.observe(spacer.current);
    if (ro && bar.current) ro.observe(bar.current);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('orientationchange', measure); };
  }, [p.phase, p.isOnline, p.syncProblem]);

  return (
    <div ref={spacer} style={{ height: box?.height || 132 }}>
    <div ref={bar} style={box ? { left: box.left, width: box.width } : undefined}
      className={cn('z-20 rounded-lg border bg-background/95 px-2.5 py-2 shadow-md backdrop-blur sm:px-4', box ? 'fixed top-[3.75rem]' : 'relative')} role="region" aria-label="Marcador e relógio">
      <div className="mx-auto max-w-6xl 2xl:flex 2xl:items-center 2xl:gap-3">
      <div className="flex items-center gap-2 sm:gap-4 2xl:flex-none">
        {/* score */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 2xl:flex-none">
          <div className="min-w-0 text-right">
            <div className="max-w-[5.5rem] truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:max-w-[9rem]">{p.teamName || 'Nós'}</div>
          </div>
          <div className="flex shrink-0 items-baseline gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 font-mono text-3xl font-bold tabular-nums leading-none sm:text-4xl" aria-label={`Resultado ${p.goalsFor} a ${p.goalsAgainst}`}>
            <span>{p.goalsFor}</span><span className="text-muted-foreground">–</span><span>{p.goalsAgainst}</span>
          </div>
          <div className="min-w-0">
            <div className="max-w-[5.5rem] truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:max-w-[9rem]">{p.opponentName || 'Adversário'}</div>
          </div>
        </div>

        {/* clock */}
        <div className={cn('shrink-0 rounded-md px-2.5 py-1 text-center', p.isOvertime ? 'bg-destructive/10 text-destructive' : !p.isRunning && p.phase === 'playing' ? 'bg-accent/15' : 'bg-muted/60')}>
          <div className="font-mono text-3xl font-bold tabular-nums leading-none sm:text-4xl" aria-label="Tempo da parte">{p.phase === 'interval' ? 'INT' : p.clock}</div>
          <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground">
            {p.isOvertime && <AlertTriangle className="h-3 w-3 text-destructive" />}
            {p.phase === 'interval' ? 'Intervalo' : `${p.partLabel} · ${p.minute}'`}
            {p.phase === 'playing' && !p.isRunning && <span className="font-semibold text-accent">· em pausa</span>}
          </div>
        </div>

        {/* clock controls */}
        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          {p.phase === 'playing' ? (
            <>
              <Button size="sm" variant="outline" className="h-8 px-2" onClick={p.onPauseResume} aria-label={p.isRunning ? 'Pausar o relógio' : 'Continuar o relógio'}>
                {p.isRunning ? <Pause className="h-4 w-4 sm:mr-1" /> : <Play className="h-4 w-4 sm:mr-1" />}
                <span className="hidden sm:inline">{p.isRunning ? 'Pausar' : 'Continuar'}</span>
              </Button>
              <Button size="sm" variant={p.isLastPart ? 'destructive' : 'secondary'} className="h-8 px-2" onClick={p.onEndPart} title={p.endPartLabel}>
                {p.isLastPart ? <Square className="h-4 w-4 sm:mr-1" /> : <Clock className="h-4 w-4 sm:mr-1" />}
                <span className="text-xs sm:text-sm">{p.isLastPart ? 'Fim do jogo' : 'Fim da parte'}</span>
              </Button>
            </>
          ) : (
            <Button size="sm" className="h-10 px-3" onClick={p.onStartNextPart}><Play className="mr-1 h-4 w-4" />{p.nextPartLabel}</Button>
          )}
        </div>
      </div>

      {/* always there (same height), so the pitch does not jump when a player is tapped */}
      {p.phase === 'playing' && (
        <p className={cn('mx-auto mt-1.5 max-w-6xl truncate text-xs', p.selectedName ? 'font-semibold text-accent' : 'text-muted-foreground')} aria-live="polite">
          {p.selectedName
            ? `${p.selectedName} selecionado: toque em Golo (pergunta a assistência), Amarelo ou Vermelho.`
            : 'Toque num jogador no campo e depois em Golo, Amarelo ou Vermelho. Sem jogador escolhido, pergunta quem foi.'}
        </p>
      )}
      {/* what gets recorded during play: one tap each */}
      {p.phase === 'playing' && (
        <div className="mt-2 flex gap-1.5 2xl:mt-0 2xl:min-w-0 2xl:flex-1">
          <Button variant={p.selectedName ? 'default' : 'outline'} className={action} onClick={p.onGoal}><span className="text-base leading-none">⚽</span>Golo</Button>
          <Button variant="outline" className={cn(action, 'border-destructive/40')} onClick={p.onOpponentGoal}><span className="text-base leading-none">⚽</span><span className="truncate">Golo adversário</span></Button>
          <Button variant="outline" className={action} onClick={p.onYellow}><span className="h-4 w-3 rounded-sm border border-yellow-500 bg-yellow-400" />Amarelo</Button>
          <Button variant="outline" className={action} onClick={p.onRed}><span className="h-4 w-3 rounded-sm border border-red-700 bg-red-600" />Vermelho</Button>
          <Button variant="outline" className={action} onClick={p.onSubstitution}><ArrowLeftRight className="h-4 w-4" />Substituição</Button>
        </div>
      )}
      </div>

      {(!p.isOnline || p.syncProblem) && (
        <p className="mx-auto mt-1 flex max-w-5xl items-center gap-1 text-[11px] text-muted-foreground">
          {!p.isOnline ? <WifiOff className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
          {!p.isOnline ? 'Sem rede: fica tudo guardado neste aparelho e é enviado depois.' : 'A guardar neste aparelho; o envio fica pendente.'}
        </p>
      )}
    </div>
    </div>
  );
}
