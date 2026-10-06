/**
 * Interactive tactical board for the team talk and half-time.
 *  - my XI with names/numbers in a formation, the opponent in theirs (one tap each)
 *  - draw with a finger: pass, run, free line, zone; undo and eraser
 *  - steps: move players/ball and play the movement
 *  - half pitch for set pieces, full-screen "talk" mode, saved plays per team
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowUpRight, Eraser, FolderOpen, Hand, Maximize2, Minimize2, Pause, Pencil, Play, Plus, Redo2, RotateCcw, Save, Square, Trash2, Undo2, Download, MoveUpRight,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  BH, BW, addStep, deleteStep, drawingAt, formationCodes, moveToken, normalizeBoard, placeFormation, positionsAt, positionsAtTime, removeToken, uid,
  type BoardPlayer, type BoardState, type DrawKind, type Drawing, type Token,
} from '@/lib/tactic-board';
import { cn } from '@/lib/utils';

type Tool = 'move' | DrawKind | 'erase';
const TOOLS: { id: Tool; label: string; icon: typeof Hand }[] = [
  { id: 'move', label: 'Mover', icon: Hand },
  { id: 'pass', label: 'Passe', icon: ArrowUpRight },
  { id: 'run', label: 'Corrida', icon: MoveUpRight },
  { id: 'free', label: 'Traço', icon: Pencil },
  { id: 'zone', label: 'Zona', icon: Square },
  { id: 'erase', label: 'Borracha', icon: Eraser },
];
const COLORS = ['#ffffff', '#facc15', '#f97316', '#38bdf8', '#111827'];
const SPORTS: Record<string, string> = { football_11: 'Futebol 11', football_9: 'Futebol 9', football_7: 'Futebol 7', football_5: 'Futebol 5', futsal: 'Futsal' };
const HOME = '#2563eb', AWAY = '#dc2626';

interface Props {
  initial: BoardState;
  /** my XI (or squad) to put names on the tokens */
  players?: BoardPlayer[];
  /** live-match tactics: slot → player */
  slotMap?: Record<string, string | null>;
  /** saved plays belong to a team */
  teamId?: string | null;
  /** start in full-screen talk mode (e.g. opened from the live match) */
  startFull?: boolean;
  onClose?: () => void;
}

/** Pitch lines for each format, in board units. */
function PitchLines({ sport }: { sport: string }) {
  const futsal = sport === 'futsal' || sport === 'football_5';
  const big = sport === 'football_11' ? { d: 16.5, w: 40.3 } : sport === 'football_9' ? { d: 13, w: 36 } : { d: 11, w: 32 };
  const small = sport === 'football_11' ? { d: 5.5, w: 18.3 } : null;
  const line = { stroke: 'white', strokeWidth: 0.35, fill: 'none', opacity: 0.9 } as const;
  const y = (w: number) => (BH - w) / 2;
  return (
    <g>
      <rect x={0} y={0} width={BW} height={BH} {...line} />
      <line x1={BW / 2} y1={0} x2={BW / 2} y2={BH} {...line} />
      <circle cx={BW / 2} cy={BH / 2} r={futsal ? 6 : 9.15} {...line} />
      <circle cx={BW / 2} cy={BH / 2} r={0.6} fill="white" />
      {futsal ? (
        <>
          <path d={`M0,${BH / 2 - 16} A16,16 0 0 1 0,${BH / 2 + 16}`} {...line} />
          <path d={`M${BW},${BH / 2 - 16} A16,16 0 0 0 ${BW},${BH / 2 + 16}`} {...line} />
        </>
      ) : (
        <>
          <rect x={0} y={y(big.w)} width={big.d} height={big.w} {...line} />
          <rect x={BW - big.d} y={y(big.w)} width={big.d} height={big.w} {...line} />
          {small && <rect x={0} y={y(small.w)} width={small.d} height={small.w} {...line} />}
          {small && <rect x={BW - small.d} y={y(small.w)} width={small.d} height={small.w} {...line} />}
          <circle cx={sport === 'football_11' ? 11 : big.d * 0.7} cy={BH / 2} r={0.5} fill="white" />
          <circle cx={BW - (sport === 'football_11' ? 11 : big.d * 0.7)} cy={BH / 2} r={0.5} fill="white" />
        </>
      )}
      {/* goals */}
      <rect x={-1.6} y={BH / 2 - (futsal ? 3 : 3.66)} width={1.6} height={futsal ? 6 : 7.32} fill="white" opacity={0.35} stroke="white" strokeWidth={0.3} />
      <rect x={BW} y={BH / 2 - (futsal ? 3 : 3.66)} width={1.6} height={futsal ? 6 : 7.32} fill="white" opacity={0.35} stroke="white" strokeWidth={0.3} />
    </g>
  );
}

export function TacticBoard({ initial, players, slotMap, teamId, startFull = false, onClose }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [state, setState] = useState<BoardState>(initial);
  const [undo, setUndo] = useState<BoardState[]>([]);
  const [redo, setRedo] = useState<BoardState[]>([]);
  const [tool, setTool] = useState<Tool>('move');
  const [color, setColor] = useState(COLORS[0]);
  const [step, setStep] = useState(0);
  const [playT, setPlayT] = useState<number | null>(null);
  const [full, setFull] = useState(startFull);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraftState] = useState<Drawing | null>(null);
  // the ref is what pointer-up reads: fast fingers lift before React re-renders
  const draftRef = useRef<Drawing | null>(null);
  const setDraft = (d: Drawing | null) => { draftRef.current = d; setDraftState(d); };
  const [savedOpen, setSavedOpen] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);

  const formations = useMemo(() => formationCodes(state.sport), [state.sport]);
  const totalSteps = state.steps.length;
  const pos = playT != null ? positionsAtTime(state, playT) : positionsAt(state, step);
  const shownStep = playT != null ? Math.min(totalSteps, Math.floor(playT + 0.001)) : step;

  // ── history ──
  const commit = (next: BoardState) => { setUndo((u) => [...u.slice(-40), state]); setRedo([]); setState(next); };
  const doUndo = () => setUndo((u) => { if (!u.length) return u; setRedo((r) => [...r, state]); setState(u[u.length - 1]); return u.slice(0, -1); });
  const doRedo = () => setRedo((r) => { if (!r.length) return r; setUndo((u) => [...u, state]); setState(r[r.length - 1]); return r.slice(0, -1); });

  // ── playback ──
  useEffect(() => {
    if (playT == null) return;
    let raf = 0, last = 0;
    const tick = (now: number) => {
      const dt = last ? now - last : 0;
      last = now;
      setPlayT((t) => {
        if (t == null) return t;
        const n = t + dt / 1300;
        return n >= totalSteps + 0.5 ? null : n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playT == null, totalSteps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (playT == null && step > totalSteps) setStep(totalSteps); }, [playT, step, totalSteps]);

  // ── pointer ──
  const toPt = (e: React.PointerEvent): [number, number] => {
    const svg = svgRef.current!;
    const p = svg.createSVGPoint();
    p.x = e.clientX; p.y = e.clientY;
    const r = p.matrixTransform(svg.getScreenCTM()!.inverse());
    return [Math.round(r.x * 10) / 10, Math.round(r.y * 10) / 10];
  };
  const tokenAt = (p: [number, number]): Token | null => {
    for (let i = state.tokens.length - 1; i >= 0; i--) {
      const t = state.tokens[i], q = pos[t.id];
      if (q && Math.hypot(q[0] - p[0], q[1] - p[1]) <= (t.kind === 'ball' || t.kind === 'cone' ? 2.6 : 3.4)) return t;
    }
    return null;
  };
  const onDown = (e: React.PointerEvent) => {
    if (playT != null) return;
    const p = toPt(e);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const t = tokenAt(p);
    if (tool === 'erase') {
      if (t) { commit(removeToken(state, t.id)); return; }
      const d = drawingAt(state, step, p);
      if (d) commit({ ...state, drawings: state.drawings.filter((x) => x.id !== d.id) });
      return;
    }
    if (tool === 'move') {
      if (!t) { setSelected(null); return; }
      const q = pos[t.id];
      setUndo((u) => [...u.slice(-40), state]); setRedo([]);
      drag.current = { id: t.id, dx: p[0] - q[0], dy: p[1] - q[1], moved: false };
      return;
    }
    setDraft({ id: uid('d'), t: tool, pts: [p, p], color, step });
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag.current) {
      const p = toPt(e);
      const d = drag.current;
      d.moved = true;
      setState((s) => moveToken(s, d.id, step, [p[0] - d.dx, p[1] - d.dy]));
      return;
    }
    const d = draftRef.current;
    if (!d) return;
    const p = toPt(e);
    if (d.t === 'free') {
      const lastP = d.pts[d.pts.length - 1];
      if (Math.hypot(lastP[0] - p[0], lastP[1] - p[1]) > 0.8) setDraft({ ...d, pts: [...d.pts, p] });
      return;
    }
    setDraft({ ...d, pts: [d.pts[0], p] });
  };
  const onUp = () => {
    if (drag.current) {
      const d = drag.current;
      drag.current = null;
      if (!d.moved) { setUndo((u) => u.slice(0, -1)); setSelected((s) => (s === d.id ? null : d.id)); }
      return;
    }
    const draft = draftRef.current;
    if (draft) {
      const a = draft.pts[0], b = draft.pts[draft.pts.length - 1];
      const long = draft.t === 'free' ? draft.pts.length > 3 : Math.hypot(a[0] - b[0], a[1] - b[1]) > 2.5;
      if (long) commit({ ...state, drawings: [...state.drawings, draft] });
      setDraft(null);
    }
  };

  // ── actions ──
  const setFormation = (side: 'home' | 'away', code: string) => commit(placeFormation(state, side, code, side === 'home' ? players : undefined, side === 'home' ? slotMap : undefined));
  const addLoose = (kind: 'ball' | 'cone') => commit({ ...state, tokens: [...state.tokens, { id: uid(kind[0]), kind, x: state.half ? BW * 0.75 : BW / 2 + (kind === 'cone' ? 4 : 0), y: BH / 2 + (kind === 'cone' ? 4 : 0) }] });
  const clearDrawings = () => commit({ ...state, drawings: state.drawings.filter((d) => d.step !== step) });
  const clearSide = (side: 'away') => commit({ ...state, tokens: state.tokens.filter((t) => t.kind !== side), awayFormation: null });
  const newStep = () => { commit(addStep(state, step)); setStep(step + 1); setTool('move'); toast.info(`Passo ${step + 2}: arraste os jogadores e a bola para onde vão.`); };
  const selectedToken = state.tokens.find((t) => t.id === selected) ?? null;
  const patchToken = (patch: Partial<Token>) => setState((s) => ({ ...s, tokens: s.tokens.map((t) => (t.id === selected ? { ...t, ...patch } : t)) }));

  // ── saved plays ──
  const { data: saved = [] } = useQuery({
    queryKey: ['tactical-boards', teamId ?? 'mine', user?.id],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from('tactical_boards').select('id, name, board_data, updated_at').order('updated_at', { ascending: false });
      q = teamId ? q.eq('team_id', teamId) : q.eq('owner_id', user!.id);
      const { data } = await q;
      return (data ?? []) as { id: string; name: string; board_data: unknown; updated_at: string }[];
    },
  });
  const savePlay = async () => {
    if (!user) return;
    const name = window.prompt('Nome da jogada (ex.: Canto ofensivo 1)');
    if (!name?.trim()) return;
    const { error } = await supabase.from('tactical_boards').insert({ name: name.trim(), owner_id: user.id, team_id: teamId ?? null, board_data: JSON.parse(JSON.stringify(state)) } as never);
    if (error) return toast.error('Não foi possível guardar: ' + error.message);
    toast.success('Jogada guardada.');
    qc.invalidateQueries({ queryKey: ['tactical-boards'] });
  };
  const deletePlay = async (id: string) => {
    const { error } = await supabase.from('tactical_boards').delete().eq('id', id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['tactical-boards'] });
  };

  const exportPng = async () => {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const vb = svg.viewBox.baseVal;
    const scale = 16;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = vb.width * scale; c.height = vb.height * scale;
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      const a = document.createElement('a');
      a.download = 'quadro-tatico.png'; a.href = c.toDataURL('image/png'); a.click();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
  };

  const viewBox = state.half ? `${BW / 2 - 3} -3 ${BW / 2 + 6} ${BH + 6}` : `-3 -3 ${BW + 6} ${BH + 6}`;
  const drawings = [...state.drawings.filter((d) => d.step === shownStep), ...(draft ? [draft] : [])];
  const tb = (active: boolean) => cn('h-9 px-2.5', active && 'ring-2 ring-primary');

  return (
    <div className={cn('flex flex-col gap-2', full && 'fixed inset-0 z-50 overflow-auto bg-background p-2 sm:p-3')}>
      {/* tools */}
      <div className="flex flex-wrap items-center gap-1.5">
        {TOOLS.map((t) => (
          <Button key={t.id} size="sm" variant={tool === t.id ? 'default' : 'outline'} className={tb(false)} onClick={() => setTool(t.id)} title={t.label}>
            <t.icon className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">{t.label}</span>
          </Button>
        ))}
        <span className="mx-1 flex items-center gap-1">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} aria-label={`Cor ${c}`}
              className={cn('h-6 w-6 rounded-full border-2', color === c ? 'border-primary ring-2 ring-primary/40' : 'border-muted-foreground/40')} style={{ background: c }} />
          ))}
        </span>
        <Button size="icon" variant="outline" className="h-9 w-9" onClick={doUndo} disabled={!undo.length} aria-label="Desfazer"><Undo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="outline" className="h-9 w-9" onClick={doRedo} disabled={!redo.length} aria-label="Refazer"><Redo2 className="h-4 w-4" /></Button>
        <Button size="sm" variant="outline" className="h-9" onClick={clearDrawings} title="Apaga os desenhos deste passo"><RotateCcw className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Limpar desenhos</span></Button>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant={state.half ? 'default' : 'outline'} className="h-9" onClick={() => setState((s) => ({ ...s, half: !s.half }))} title="Meio-campo (bolas paradas)">½ campo</Button>
          <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => setFull((f) => !f)} aria-label={full ? 'Sair do ecrã inteiro' : 'Ecrã inteiro'}>
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          {onClose && <Button size="sm" variant="secondary" className="h-9" onClick={onClose}>Fechar</Button>}
        </div>
      </div>

      {/* teams */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Select value={state.sport} onValueChange={(v) => commit({ ...state, sport: v, homeFormation: null, awayFormation: null })}>
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(SPORTS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
        </Select>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full" style={{ background: HOME }} />
          <Select value={state.homeFormation ?? ''} onValueChange={(v) => setFormation('home', v)}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="A minha equipa" /></SelectTrigger>
            <SelectContent>{formations.map((f) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}</SelectContent>
          </Select>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-full" style={{ background: AWAY }} />
          <Select value={state.awayFormation ?? ''} onValueChange={(v) => setFormation('away', v)}>
            <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Adversário" /></SelectTrigger>
            <SelectContent>{formations.map((f) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}</SelectContent>
          </Select>
          {state.tokens.some((t) => t.kind === 'away') && <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => clearSide('away')} aria-label="Tirar adversário"><Trash2 className="h-4 w-4" /></Button>}
        </span>
        <Button size="sm" variant="outline" className="h-9" onClick={() => addLoose('ball')}>⚽ Bola</Button>
        <Button size="sm" variant="outline" className="h-9" onClick={() => addLoose('cone')}>▲ Cone</Button>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="outline" className="h-9" onClick={() => setSavedOpen((o) => !o)}><FolderOpen className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Jogadas ({saved.length})</span></Button>
          <Button size="sm" variant="outline" className="h-9" onClick={savePlay}><Save className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Guardar</span></Button>
          <Button size="icon" variant="outline" className="h-9 w-9" onClick={exportPng} aria-label="Exportar imagem"><Download className="h-4 w-4" /></Button>
        </div>
      </div>

      {savedOpen && (
        <div className="flex flex-wrap gap-2 rounded-md border p-2">
          {saved.length === 0 && <span className="text-sm text-muted-foreground">Ainda não há jogadas guardadas. Prepare os cantos, livres e saídas de bola antes do jogo e guarde-os aqui.</span>}
          {saved.map((s) => (
            <span key={s.id} className="flex items-center overflow-hidden rounded-md border">
              <button type="button" className="px-2.5 py-1.5 text-sm hover:bg-muted" onClick={() => { commit(normalizeBoard(s.board_data, state.sport)); setStep(0); setSavedOpen(false); }}>{s.name}</button>
              <button type="button" className="border-l px-1.5 py-1.5 text-destructive hover:bg-muted" onClick={() => window.confirm(`Apagar "${s.name}"?`) && deletePlay(s.id)} aria-label={`Apagar ${s.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
            </span>
          ))}
        </div>
      )}

      {/* pitch */}
      <div className={cn('mx-auto w-full select-none overflow-hidden rounded-lg', full ? 'max-w-[min(100%,calc((100vh-13rem)*1.5))]' : 'max-w-[min(64rem,calc((100vh-19rem)*1.5))]')} style={{ background: '#1f5a36', touchAction: 'none' }}>
        <svg
          ref={svgRef}
          viewBox={viewBox}
          className={cn('block w-full', tool !== 'move' && 'cursor-crosshair')}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        >
          <defs>
            {COLORS.map((c, i) => (
              <marker key={c} id={`tb-arrow-${i}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={c} />
              </marker>
            ))}
          </defs>
          {/* grass stripes */}
          {Array.from({ length: 10 }, (_, i) => <rect key={i} x={i * (BW / 10)} y={0} width={BW / 10} height={BH} fill={i % 2 ? '#256b40' : '#2a7747'} />)}
          <PitchLines sport={state.sport} />

          {drawings.map((d) => {
            const ci = Math.max(0, COLORS.indexOf(d.color));
            if (d.t === 'zone') {
              const [a, b] = d.pts;
              return <rect key={d.id} x={Math.min(a[0], b[0])} y={Math.min(a[1], b[1])} width={Math.abs(a[0] - b[0])} height={Math.abs(a[1] - b[1])} fill={d.color} fillOpacity={0.22} stroke={d.color} strokeWidth={0.4} strokeDasharray="1.5 1" />;
            }
            if (d.t === 'free') return <polyline key={d.id} points={d.pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={d.color} strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round" />;
            const [a, b] = d.pts;
            return <line key={d.id} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={d.color} strokeWidth={0.75} strokeLinecap="round" strokeDasharray={d.t === 'run' ? '2.2 1.6' : undefined} markerEnd={`url(#tb-arrow-${ci})`} />;
          })}

          {/* where each token came from (previous step) */}
          {playT == null && step > 0 && (() => {
            const prev = positionsAt(state, step - 1);
            return state.tokens.map((t) => {
              const a = prev[t.id], b = pos[t.id];
              if (!a || !b || Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.8) return null;
              return <line key={`tr-${t.id}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="white" strokeOpacity={0.55} strokeWidth={0.4} strokeDasharray="1.2 1.2" />;
            });
          })()}

          {state.tokens.map((t) => {
            const p = pos[t.id];
            if (!p) return null;
            const sel = selected === t.id;
            if (t.kind === 'ball') return <circle key={t.id} cx={p[0]} cy={p[1]} r={1.3} fill="white" stroke="#111" strokeWidth={0.35} />;
            if (t.kind === 'cone') return <path key={t.id} d={`M${p[0]},${p[1] - 1.6} L${p[0] + 1.4},${p[1] + 1.1} L${p[0] - 1.4},${p[1] + 1.1} Z`} fill="#fb923c" stroke="white" strokeWidth={0.25} />;
            return (
              <g key={t.id}>
                <circle cx={p[0]} cy={p[1]} r={2.7} fill={t.kind === 'home' ? HOME : AWAY} stroke={sel ? '#facc15' : 'white'} strokeWidth={sel ? 0.8 : 0.45} />
                <text x={p[0]} y={p[1] + 1} textAnchor="middle" fontSize={2.6} fontWeight={700} fill="white" style={{ pointerEvents: 'none' }}>{t.n}</text>
                {t.name && (
                  <text x={p[0]} y={p[1] + 5.3} textAnchor="middle" fontSize={2.2} fontWeight={600} fill="white" stroke="#0b2a17" strokeWidth={0.55} paintOrder="stroke" style={{ pointerEvents: 'none' }}>{t.name}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* selected token: quick edit (e.g. "their number 10") */}
      {selectedToken && (selectedToken.kind === 'home' || selectedToken.kind === 'away') && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
          <span className="h-3.5 w-3.5 rounded-full" style={{ background: selectedToken.kind === 'home' ? HOME : AWAY }} />
          <Input className="h-8 w-16" maxLength={3} value={selectedToken.n ?? ''} onChange={(e) => patchToken({ n: e.target.value })} aria-label="Número" />
          <Input className="h-8 w-40" maxLength={18} placeholder="Nome (opcional)" value={selectedToken.name ?? ''} onChange={(e) => patchToken({ name: e.target.value })} aria-label="Nome" />
          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { commit(removeToken(state, selectedToken.id)); setSelected(null); }}><Trash2 className="mr-1 h-4 w-4" />Tirar</Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>Fechar</Button>
        </div>
      )}

      {/* steps */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Passos</span>
        {Array.from({ length: totalSteps + 1 }, (_, k) => (
          <Button key={k} size="sm" variant={shownStep === k ? 'default' : 'outline'} className="h-9 w-9 px-0" onClick={() => { setPlayT(null); setStep(k); }}>{k + 1}</Button>
        ))}
        <Button size="sm" variant="outline" className="h-9" onClick={newStep} disabled={playT != null}><Plus className="mr-1 h-4 w-4" />Passo</Button>
        {step > 0 && playT == null && <Button size="sm" variant="ghost" className="h-9" onClick={() => { commit(deleteStep(state, step)); setStep(step - 1); }}><Trash2 className="mr-1 h-4 w-4" />Passo</Button>}
        <Button size="sm" className="ml-auto h-9" disabled={totalSteps === 0} onClick={() => setPlayT((t) => (t == null ? 0 : null))}>
          {playT == null ? <><Play className="mr-1.5 h-4 w-4" />Ver movimento</> : <><Pause className="mr-1.5 h-4 w-4" />Parar</>}
        </Button>
      </div>
      {!full && (
        <p className="text-xs text-muted-foreground">
          Arraste os jogadores. Escolha Passe, Corrida, Traço ou Zona e desenhe com o dedo. Toque num jogador para mudar o número/nome. "+ Passo" cria o movimento seguinte.
        </p>
      )}
    </div>
  );
}
