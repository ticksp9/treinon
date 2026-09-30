/**
 * Plays an animated drill: players and ball move step by step, with the next
 * movements drawn as arrows. Optional "3D" view tilts the pitch like the
 * animated drills coaches share online.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pause, Play, SkipBack, SkipForward, Box, Square } from 'lucide-react';
import { DrillDiagram } from './DrillDiagram';
import { autoAnimate, elementsAt, stepCount, withBall, type DrillAnimation } from '@/lib/drill-library/animation';
import type { DiagramEl } from '@/lib/drill-library/types';
import { cn } from '@/lib/utils';

interface Props {
  elements: DiagramEl[];
  /** explicit animation; if absent, one is built from the diagram's arrows */
  anim?: DrillAnimation | null;
  title?: string;
  className?: string;
  autoPlay?: boolean;
  compact?: boolean;
}

export function AnimatedDrill({ elements: given, anim, title, className, autoPlay = false, compact = false }: Props) {
  const elements = useMemo(() => (anim ? given : withBall(given)), [anim, given]);
  const animation = useMemo(() => anim ?? autoAnimate(elements), [anim, elements]);
  const steps = stepCount(animation);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(autoPlay && !!animation);
  const [speed, setSpeed] = useState(1);
  const [view3d, setView3d] = useState(false);
  const raf = useRef<number>();
  const last = useRef<number>();

  useEffect(() => {
    if (!playing || !animation) return;
    const perStep = (animation.stepSeconds ?? 1.2) * 1000;
    const tick = (now: number) => {
      const dt = last.current ? now - last.current : 0;
      last.current = now;
      setT((prev) => {
        const next = prev + (dt / perStep) * speed;
        // loop with a short pause on the last step
        return next > steps - 1 + 0.6 ? 0 : next;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); last.current = undefined; };
  }, [playing, animation, speed, steps]);

  const shown = elementsAt(elements, animation, Math.min(t, steps - 1));
  const go = (k: number) => { setPlaying(false); setT(Math.max(0, Math.min(steps - 1, k))); };
  const current = Math.min(steps - 1, Math.round(t));
  const note = animation?.frames[Math.floor(Math.min(t, steps - 1))]?.note;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="overflow-hidden rounded-lg bg-[hsl(var(--field-dark))]" style={view3d ? { perspective: '900px' } : undefined}>
        <div
          className="transition-transform duration-500"
          style={view3d ? { transform: 'rotateX(38deg) scale(0.92)', transformOrigin: '50% 60%' } : undefined}
        >
          <DrillDiagram elements={shown} title={title} className="w-full" />
        </div>
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {animation && (
        <div className="flex items-center gap-1.5">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => go(current - 1)} aria-label="Passo anterior"><SkipBack className="h-4 w-4" /></Button>
          <Button size="icon" className="h-8 w-8" onClick={() => { if (t >= steps - 1) setT(0); setPlaying((p) => !p); }} aria-label={playing ? 'Pausa' : 'Reproduzir'}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => go(current + 1)} aria-label="Passo seguinte"><SkipForward className="h-4 w-4" /></Button>
          <span className="ml-1 font-mono text-xs text-muted-foreground">passo {current + 1}/{steps}</span>
          {!compact && (
            <div className="ml-auto flex items-center gap-1">
              {[0.5, 1, 2].map((s) => (
                <Button key={s} size="sm" variant={speed === s ? 'secondary' : 'ghost'} className="h-8 px-2 text-xs" onClick={() => setSpeed(s)}>{s}×</Button>
              ))}
              <Button size="sm" variant={view3d ? 'secondary' : 'ghost'} className="h-8 px-2 text-xs" onClick={() => setView3d((v) => !v)}>
                {view3d ? <Square className="mr-1 h-3.5 w-3.5" /> : <Box className="mr-1 h-3.5 w-3.5" />}{view3d ? '2D' : '3D'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
