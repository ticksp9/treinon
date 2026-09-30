/**
 * Exercise editor: draw the drill on the pitch and animate it step by step.
 *  - pick a tool and tap the pitch to add (team A/B, joker, GK, ball, cone, goals, zone)
 *  - drag to move; in step 1 you set the starting layout, in later steps you move
 *    players/ball to where they go next (cones, goals and zones stay put)
 *  - "Ver animação" plays it like the animated drills shared online
 */
import { useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Hand, Plus, Trash2, Play, Save, Loader2, Eraser, Pencil } from 'lucide-react';
import { DrillDiagram } from './DrillDiagram';
import { AnimatedDrill } from './AnimatedDrill';
import { AGE_BANDS, DRILL_CATEGORIES, EQUIPMENT_LABELS, type DiagramEl, type Equipment, type Pt } from '@/lib/drill-library/types';
import { autoAnimate, withBall, elementsAt, isArrow, isMovable, isPlayer, removeElement, resolveFrame, stepCount, type DrillAnimation } from '@/lib/drill-library/animation';
import { useSaveCoachDrill, type AnyDrill } from '@/lib/drill-library/custom';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';

type Tool = 'move' | 'a' | 'd' | 'n' | 'gk' | 'ball' | 'cone' | 'goal' | 'goal_small' | 'zone';

const TOOLS: { id: Tool; label: string; swatch?: string }[] = [
  { id: 'move', label: 'Mover' },
  { id: 'a', label: 'Equipa A', swatch: 'hsl(217 85% 50%)' },
  { id: 'd', label: 'Equipa B', swatch: 'hsl(14 90% 52%)' },
  { id: 'n', label: 'Joker', swatch: 'hsl(45 95% 48%)' },
  { id: 'gk', label: 'GR', swatch: 'hsl(280 60% 45%)' },
  { id: 'ball', label: 'Bola', swatch: '#fff' },
  { id: 'cone', label: 'Cone', swatch: 'hsl(28 95% 55%)' },
  { id: 'goal', label: 'Baliza' },
  { id: 'goal_small', label: 'Mini-baliza' },
  { id: 'zone', label: 'Zona' },
];

const W = 100, H = 64;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

interface Props {
  open: boolean;
  initial: AnyDrill;
  onClose: () => void;
  onSaved?: () => void;
  /** 'training': the drill goes back into a training plan (optionally also saved to my exercises) */
  onSubmit?: (drill: AnyDrill) => void;
}

export function DrillEditor({ open, initial, onClose, onSaved, onSubmit }: Props) {
  const [alsoSave, setAlsoSave] = useState(false);
  const [drill, setDrill] = useState<AnyDrill>(() => withAnimation(initial));
  const [tool, setTool] = useState<Tool>('move');
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ i: number; offset: Pt } | null>(null);
  const save = useSaveCoachDrill();
  const { clubId } = useUserRole();

  const els = drill.diagram;
  const anim = drill.anim ?? null;
  const steps = stepCount(anim);
  const pos = useMemo(() => resolveFrame(els, anim, step), [els, anim, step]);
  const set = (patch: Partial<AnyDrill>) => setDrill((d) => ({ ...d, ...patch }));

  // what is drawn at this step, plus where things came from (previous step)
  const shown = useMemo(() => {
    const base = anim ? elementsAt(els, anim, step, false) : els;
    if (!anim || step === 0) return base;
    const prev = resolveFrame(els, anim, step - 1);
    const trails: DiagramEl[] = [];
    els.forEach((el, i) => {
      if (!isMovable(el)) return;
      const a = prev[i], b = pos[i];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5) return;
      trails.push({ t: el.t === 'ball' ? 'pass' : 'run', from: a, to: b });
    });
    return [...trails, ...base];
  }, [els, anim, step, pos]);

  const atOf = (i: number): Pt | null => {
    const el = els[i];
    if (!('at' in el)) return null;
    return isMovable(el) ? pos[i] : (el as { at: Pt }).at;
  };

  const toPt = (e: React.PointerEvent): Pt => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const r = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return [Math.round(clamp(r.x, 0, W) * 10) / 10, Math.round(clamp(r.y, 0, H) * 10) / 10];
  };

  const addAt = (p: Pt) => {
    let el: DiagramEl;
    const count = (t: string) => els.filter((e) => e.t === t).length + 1;
    switch (tool) {
      case 'a': case 'd': case 'n': el = { t: tool, at: p, n: String(count(tool)) }; break;
      case 'gk': el = { t: 'gk', at: p }; break;
      case 'ball': el = { t: 'ball', at: p }; break;
      case 'cone': el = { t: 'cone', at: p }; break;
      case 'goal': case 'goal_small':
        el = { t: 'goal', at: [p[0] < W / 2 ? Math.min(p[0], 2) : Math.max(p[0], 98), p[1]], side: p[0] < W / 2 ? 'left' : 'right', small: tool === 'goal_small' };
        if (tool === 'goal_small') (el as any).at = p;
        break;
      case 'zone': el = { t: 'zone', at: [clamp(p[0] - 15, 0, W - 30), clamp(p[1] - 10, 0, H - 20)], w: 30, h: 20 }; break;
      default: return;
    }
    set({ diagram: [...els, el] });
    setSelected(els.length);
  };

  const moveTo = (i: number, p: Pt) => {
    const el = els[i];
    if (isMovable(el) && step > 0 && anim) {
      const frames = anim.frames.map((f, k) => (k === step ? { ...f, pos: { ...f.pos, [i]: p } } : f));
      set({ anim: { ...anim, frames } });
    } else if ('at' in el) {
      const diagram = els.map((e, k) => (k === i ? ({ ...e, at: p } as DiagramEl) : e));
      set({ diagram });
    }
  };

  const onDown = (e: React.PointerEvent, i: number | null) => {
    e.stopPropagation();
    const p = toPt(e);
    if (i === null) {
      if (tool !== 'move') addAt(p);
      else setSelected(null);
      return;
    }
    setSelected(i);
    const at = atOf(i);
    if (!at) return;
    drag.current = { i, offset: [p[0] - at[0], p[1] - at[1]] };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = toPt(e);
    moveTo(drag.current.i, [Math.round((p[0] - drag.current.offset[0]) * 10) / 10, Math.round((p[1] - drag.current.offset[1]) * 10) / 10]);
  };
  const onUp = () => { drag.current = null; };

  const addStep = () => {
    const frames = anim?.frames ?? [{ pos: {} }];
    const next: DrillAnimation = { stepSeconds: anim?.stepSeconds ?? 1.2, frames: [...frames.slice(0, step + 1), { pos: {} }, ...frames.slice(step + 1)] };
    set({ anim: next });
    setStep(step + 1);
    setTool('move');
    toast.info(`Passo ${step + 2}: arraste jogadores e bola para onde vão.`);
  };
  const deleteStep = () => {
    if (!anim || step === 0) return;
    const frames = anim.frames.filter((_, k) => k !== step);
    set({ anim: frames.length > 1 ? { ...anim, frames } : null });
    setStep(Math.max(0, step - 1));
  };
  const deleteSelected = () => {
    if (selected === null) return;
    const r = removeElement(els, anim, selected);
    set({ diagram: r.elements, anim: r.anim });
    setSelected(null);
  };
  const selectedEl = selected !== null ? els[selected] : null;

  const doSave = async () => {
    if (!drill.name.trim()) { toast.error('Dê um nome ao exercício.'); return; }
    if (drill.diagram.length === 0) { toast.error('Desenhe o exercício no campo.'); return; }
    try {
      if (onSubmit) {
        if (alsoSave) await save.mutateAsync({ drill: { ...drill, rowId: undefined }, clubId: clubId ?? null });
        onSubmit(drill);
        onClose();
        return;
      }
      await save.mutateAsync({ drill, clubId: clubId ?? null });
      toast.success('Exercício guardado.');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error('Não foi possível guardar: ' + (e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[96vh] max-w-5xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{drill.rowId ? 'Editar exercício' : 'Novo exercício'}</DialogTitle>
          <DialogDescription>Desenhe no campo e crie passos para animar os movimentos dos jogadores e da bola.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="draw">
          <TabsList className="grid w-full grid-cols-2 lg:hidden">
            <TabsTrigger value="draw">Desenho</TabsTrigger>
            <TabsTrigger value="info">Descrição</TabsTrigger>
          </TabsList>
          <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
            {/* ─── Drawing ─── */}
            <TabsContent value="draw" forceMount className="mt-3 space-y-3 data-[state=inactive]:hidden lg:!block">
              {preview ? (
                <AnimatedDrill elements={els} anim={anim} autoPlay title={drill.name} />
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {TOOLS.map((t) => (
                      <Button key={t.id} size="sm" variant={tool === t.id ? 'default' : 'outline'} className="h-8 px-2 text-xs" onClick={() => setTool(t.id)}>
                        {t.id === 'move' ? <Hand className="mr-1 h-3.5 w-3.5" /> : t.swatch ? <span className="mr-1 inline-block h-3 w-3 rounded-full border" style={{ background: t.swatch }} /> : null}
                        {t.label}
                      </Button>
                    ))}
                  </div>
                  <div className="relative overflow-hidden rounded-lg bg-[hsl(var(--field-dark))] touch-none select-none">
                    <DrillDiagram elements={shown} className="pointer-events-none w-full" />
                    <svg
                      ref={svgRef}
                      viewBox={`-2 -2 ${W + 4} ${H + 4}`}
                      className={cn('absolute inset-0 h-full w-full', tool !== 'move' && 'cursor-crosshair')}
                      onPointerDown={(e) => onDown(e, null)}
                      onPointerMove={onMove}
                      onPointerUp={onUp}
                      onPointerCancel={onUp}
                    >
                      {els.map((el, i) => {
                        if (isArrow(el) && anim) return null;
                        if (el.t === 'zone') {
                          return (
                            <rect key={i} x={el.at[0]} y={el.at[1]} width={el.w} height={el.h} fill="transparent"
                              stroke={selected === i ? 'hsl(var(--accent))' : 'transparent'} strokeWidth={0.6}
                              onPointerDown={(e) => (tool === 'move' ? onDown(e, i) : undefined)} />
                          );
                        }
                        const at = atOf(i);
                        if (!at) return null;
                        return (
                          <circle key={i} cx={at[0]} cy={at[1]} r={isPlayer(el) ? 3.2 : 2.4} fill="transparent"
                            stroke={selected === i ? 'hsl(var(--accent))' : 'transparent'} strokeWidth={0.6}
                            onPointerDown={(e) => onDown(e, i)} />
                        );
                      })}
                    </svg>
                  </div>
                </>
              )}

              {/* Steps */}
              <div className="flex flex-wrap items-center gap-1.5">
                {Array.from({ length: steps }, (_, k) => (
                  <Button key={k} size="sm" variant={step === k && !preview ? 'default' : 'outline'} className="h-8 w-9 px-0" onClick={() => { setPreview(false); setStep(k); }}>
                    {k + 1}
                  </Button>
                ))}
                <Button size="sm" variant="outline" className="h-8" onClick={() => { setPreview(false); addStep(); }}><Plus className="mr-1 h-3.5 w-3.5" />Passo</Button>
                {step > 0 && !preview && <Button size="sm" variant="ghost" className="h-8" onClick={deleteStep}><Trash2 className="mr-1 h-3.5 w-3.5" />Passo</Button>}
                <Button size="sm" variant={preview ? 'secondary' : 'default'} className="ml-auto h-8" onClick={() => setPreview((p) => !p)} disabled={steps < 2}>
                  {preview ? <><Pencil className="mr-1 h-3.5 w-3.5" />Editar</> : <><Play className="mr-1 h-3.5 w-3.5" />Ver animação</>}
                </Button>
              </div>

              {!preview && (
                <div className="space-y-2 rounded-md border p-2 text-sm">
                  <p className="text-xs text-muted-foreground">
                    {step === 0
                      ? 'Passo 1: posição inicial. Escolha uma ferramenta e toque no campo; arraste para ajustar.'
                      : `Passo ${step + 1}: arraste jogadores e bola para onde vão. Cones, balizas e zonas não mudam.`}
                  </p>
                  {anim && (
                    <Input
                      placeholder={`O que acontece no passo ${step + 1} (opcional)`}
                      value={anim.frames[step]?.note ?? ''}
                      onChange={(e) => set({ anim: { ...anim, frames: anim.frames.map((f, k) => (k === step ? { ...f, note: e.target.value || undefined } : f)) } })}
                    />
                  )}
                  {selectedEl && (
                    <div className="flex flex-wrap items-center gap-2">
                      {(selectedEl.t === 'a' || selectedEl.t === 'd' || selectedEl.t === 'n') && (
                        <Input
                          className="h-8 w-20"
                          maxLength={3}
                          value={selectedEl.n ?? ''}
                          onChange={(e) => set({ diagram: els.map((x, k) => (k === selected ? ({ ...x, n: e.target.value } as DiagramEl) : x)) })}
                          aria-label="Número"
                        />
                      )}
                      {selectedEl.t === 'zone' && (
                        <>
                          <Label className="text-xs">Largura</Label>
                          <Input type="number" className="h-8 w-16" value={selectedEl.w} onChange={(e) => set({ diagram: els.map((x, k) => (k === selected ? ({ ...x, w: clamp(Number(e.target.value), 4, W) } as DiagramEl) : x)) })} />
                          <Label className="text-xs">Altura</Label>
                          <Input type="number" className="h-8 w-16" value={selectedEl.h} onChange={(e) => set({ diagram: els.map((x, k) => (k === selected ? ({ ...x, h: clamp(Number(e.target.value), 4, H) } as DiagramEl) : x)) })} />
                        </>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={deleteSelected}><Trash2 className="mr-1 h-3.5 w-3.5" />Apagar</Button>
                    </div>
                  )}
                  {anim && els.some(isArrow) && (
                    <Button size="sm" variant="ghost" className="h-8" onClick={() => set({ diagram: els.filter((e) => !isArrow(e)), anim: removeArrowsKeepAnim(els, anim) })}>
                      <Eraser className="mr-1 h-3.5 w-3.5" />Remover setas desenhadas (a animação já mostra os movimentos)
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* ─── Description ─── */}
            <TabsContent value="info" forceMount className="mt-3 space-y-3 data-[state=inactive]:hidden lg:!block">
              <div className="space-y-1.5">
                <Label htmlFor="dr-name">Nome *</Label>
                <Input id="dr-name" value={drill.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Losango de passe com rotação" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={drill.category} onValueChange={(v) => set({ category: v as AnyDrill['category'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DRILL_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Intensidade</Label>
                  <Select value={drill.intensity} onValueChange={(v) => set({ intensity: v as AnyDrill['intensity'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1.5"><Label className="text-xs">Min.</Label><Input type="number" value={drill.minutes} onChange={(e) => set({ minutes: Math.max(1, Number(e.target.value)) })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Jog. mín.</Label><Input type="number" value={drill.players.min} onChange={(e) => set({ players: { ...drill.players, min: Math.max(1, Number(e.target.value)) } })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Jog. máx.</Label><Input type="number" value={drill.players.max} onChange={(e) => set({ players: { ...drill.players, max: Math.max(1, Number(e.target.value)) } })} /></div>
                <div className="space-y-1.5"><Label className="text-xs">Espaço</Label><Input value={drill.space} onChange={(e) => set({ space: e.target.value })} /></div>
              </div>
              <div className="space-y-1.5">
                <Label>Escalões</Label>
                <div className="flex flex-wrap gap-1">
                  {AGE_BANDS.map((a) => (
                    <Button key={a.value} size="sm" variant={drill.ages.includes(a.value) ? 'default' : 'outline'} className="h-7 px-2 text-xs"
                      onClick={() => set({ ages: drill.ages.includes(a.value) ? drill.ages.filter((x) => x !== a.value) : [...drill.ages, a.value] })}>
                      {a.short}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5"><Label>Objetivo</Label><Textarea rows={2} value={drill.objective} onChange={(e) => set({ objective: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Organização</Label><Textarea rows={2} value={drill.setup} onChange={(e) => set({ setup: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Como se joga (uma regra por linha)</Label><Textarea rows={3} value={drill.howTo.join('\n')} onChange={(e) => set({ howTo: lines(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Pontos-chave (um por linha)</Label><Textarea rows={2} value={drill.coachingPoints.join('\n')} onChange={(e) => set({ coachingPoints: lines(e.target.value) })} /></div>
              <div className="space-y-1.5"><Label>Progressões (uma por linha)</Label><Textarea rows={2} value={(drill.progressions ?? []).join('\n')} onChange={(e) => set({ progressions: lines(e.target.value) })} /></div>
              <div className="space-y-1.5">
                <Label>Material</Label>
                <div className="grid grid-cols-2 gap-1">
                  {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((k) => (
                    <label key={k} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={drill.equipment.includes(k)} onCheckedChange={(c) => set({ equipment: c ? [...drill.equipment, k] : drill.equipment.filter((x) => x !== k) })} />
                      {EQUIPMENT_LABELS[k]}
                    </label>
                  ))}
                </div>
              </div>
              {clubId && (
                <label className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
                  <span>Partilhar com os treinadores do clube</span>
                  <Switch checked={!!drill.sharedWithClub} onCheckedChange={(v) => set({ sharedWithClub: v })} />
                </label>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
          {onSubmit && (
            <label className="mr-auto flex items-center gap-2 text-sm">
              <Switch checked={alsoSave} onCheckedChange={setAlsoSave} />
              Guardar também em "Os meus exercícios"
            </label>
          )}
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={doSave} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{onSubmit ? 'Usar no treino' : 'Guardar exercício'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Copies from the library come with arrows: turn them into steps so the drill animates. */
function withAnimation(d: AnyDrill): AnyDrill {
  if (d.anim || d.diagram.length === 0) return d;
  const diagram = withBall(d.diagram);
  const anim = autoAnimate(diagram);
  return anim ? { ...d, diagram, anim } : d;
}

/** Arrow elements are removed: remap frame indices of the elements that remain. */
function removeArrowsKeepAnim(els: DiagramEl[], anim: DrillAnimation): DrillAnimation {
  let cur = { elements: els, anim: anim as DrillAnimation | null };
  for (let i = els.length - 1; i >= 0; i--) {
    if (isArrow(els[i])) cur = removeElement(cur.elements, cur.anim, i);
  }
  return cur.anim ?? anim;
}
