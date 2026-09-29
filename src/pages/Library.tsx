import { useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  BookOpen, Clock, Users, Search, Plus, Check, Printer, Share2, Package, Sparkles, ListChecks, GraduationCap, X, Dumbbell,
} from 'lucide-react';
import { DrillDiagram, DiagramLegend } from '@/components/library/DrillDiagram';
import {
  DRILLS, SESSION_PLANS, AGE_GUIDES, AGE_BANDS, DRILL_CATEGORIES, EQUIPMENT_LABELS,
  categoryLabel, isLowResource, sessionDrills, drillsToExercises, drillToText,
  type AgeBand, type Drill, type DrillCategory, type SessionPlan,
} from '@/lib/drill-library';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { shareText } from '@/lib/share';

const AGE_TO_TRAINING_GROUP: Record<AgeBand, string> = {
  sub7: 'sub-7', sub9: 'sub-9', sub11: 'sub-11', sub13: 'sub-13',
  sub15: 'sub-15', sub17: 'sub-17', sub19: 'sub-19', senior: 'senior',
};

const INTENSITY: Record<Drill['intensity'], { label: string; className: string }> = {
  baixa: { label: 'Intensidade baixa', className: 'bg-sky-500/10 text-sky-700 dark:text-sky-300' },
  media: { label: 'Intensidade média', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300' },
  alta: { label: 'Intensidade alta', className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300' },
};

type Picked = { drill: Drill; minutes: number; note?: string };

function agesLabel(ages: AgeBand[]) {
  const shorts = AGE_BANDS.filter((a) => ages.includes(a.value)).map((a) => a.short);
  if (shorts.length <= 2) return shorts.join(', ');
  return `${shorts[0]} a ${shorts[shorts.length - 1]}`;
}

function printPlan(title: string, subtitle: string, items: Picked[]) {
  const w = window.open('', '_blank');
  if (!w) {
    toast.error('Permita janelas pop-up para imprimir.');
    return;
  }
  const blocks = items.map(({ drill, minutes, note }, i) => `
    <section class="block">
      <div class="diagram">${renderToStaticMarkup(<DrillDiagram elements={drill.diagram} />)}</div>
      <div class="text">
        <h2>${i + 1}. ${drill.name} <span>${minutes} min</span></h2>
        ${note ? `<p class="note">${note}</p>` : ''}
        <p><b>Objetivo:</b> ${drill.objective}</p>
        <p><b>Organização:</b> ${drill.setup} (${drill.space})</p>
        <ul>${drill.howTo.map((s) => `<li>${s}</li>`).join('')}</ul>
        <p><b>Pontos-chave:</b> ${drill.coachingPoints.join(' · ')}</p>
      </div>
    </section>`).join('');
  const total = items.reduce((s, x) => s + x.minutes, 0);
  w.document.write(`<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${title}</title>
    <style>
      :root{--field:145 65% 35%;--field-dark:145 65% 25%;--accent:38 92% 50%}
      body{font-family:system-ui,sans-serif;margin:24px;color:#111}
      header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #1a7f37;margin-bottom:12px}
      h1{font-size:20px;margin:0}.sub{color:#555;font-size:13px}
      .block{display:flex;gap:16px;page-break-inside:avoid;border-bottom:1px solid #ddd;padding:10px 0}
      .diagram{width:230px;flex:none}.diagram svg{width:100%;height:auto}
      h2{font-size:15px;margin:0 0 4px}h2 span{font-weight:400;color:#555;font-size:13px}
      p,li{font-size:12px;margin:2px 0}.note{color:#b45309}
      footer{margin-top:12px;font-size:11px;color:#777}
    </style></head><body>
    <header><h1>${title}</h1><span class="sub">${subtitle} · ${total} min</span></header>
    ${blocks}
    <footer>Plano gerado com TreinON — gratuito para todas as equipas.</footer>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
  </body></html>`);
  w.document.close();
}

function shareablePlan(title: string, items: Picked[]) {
  const total = items.reduce((s, x) => s + x.minutes, 0);
  return [
    `⚽ *${title}* (${total} min)`,
    ...items.map(({ drill, minutes }, i) => `${i + 1}. ${drill.name} — ${minutes}'`),
    '',
    'Feito com TreinON',
  ].join('\n');
}

/** The library is public (free coaching content); saving needs an account. */
function PublicLayout({ children }: { children: React.ReactNode; title?: string }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur-md">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 font-display font-bold">
            <img src="/pwa-192x192.png" alt="" className="h-7 w-7 rounded-lg" /> TreinON
          </button>
          <Button size="sm" onClick={() => navigate('/auth?tab=signup&next=/biblioteca')}>Criar conta grátis</Button>
        </div>
      </header>
      <div className="container mx-auto px-4 py-6">{children}</div>
    </div>
  );
}

export default function Library() {
  const { user } = useAuth();
  const Layout = user ? AppLayout : PublicLayout;
  const navigate = useNavigate();
  const [age, setAge] = useState<AgeBand | 'all'>('all');
  const [category, setCategory] = useState<DrillCategory | 'all'>('all');
  const [lowResource, setLowResource] = useState(false);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Drill | null>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [createFor, setCreateFor] = useState<{ title: string; items: Picked[]; age?: AgeBand } | null>(null);
  const [trainingName, setTrainingName] = useState('');
  const [trainingDate, setTrainingDate] = useState('');
  const [trainingAge, setTrainingAge] = useState<AgeBand | ''>('');
  const [saving, setSaving] = useState(false);

  const drills = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DRILLS.filter((d) =>
      (age === 'all' || d.ages.includes(age)) &&
      (category === 'all' || d.category === category) &&
      (!lowResource || isLowResource(d)) &&
      (!q || d.name.toLowerCase().includes(q) || d.objective.toLowerCase().includes(q)),
    );
  }, [age, category, lowResource, query]);

  const plans = useMemo(() => SESSION_PLANS.filter((p) => age === 'all' || p.ages.includes(age)), [age]);
  const guides = useMemo(() => AGE_GUIDES.filter((g) => age === 'all' || g.age === age), [age]);

  const isPicked = (d: Drill) => picked.some((p) => p.drill.id === d.id);
  const togglePick = (d: Drill) =>
    setPicked((prev) => (prev.some((p) => p.drill.id === d.id) ? prev.filter((p) => p.drill.id !== d.id) : [...prev, { drill: d, minutes: d.minutes }]));
  const pickedMinutes = picked.reduce((s, p) => s + p.minutes, 0);

  const openCreate = (title: string, items: Picked[], planAge?: AgeBand) => {
    if (!user) {
      toast.info('Crie uma conta gratuita para guardar treinos. Pode imprimir ou partilhar sem conta.', {
        action: { label: 'Criar conta', onClick: () => navigate('/auth?tab=signup&next=/biblioteca') },
      });
      printPlan(title, 'Plano de treino', items);
      return;
    }
    setCreateFor({ title, items, age: planAge });
    setTrainingName(title);
    setTrainingDate('');
    setTrainingAge(planAge ?? (age === 'all' ? '' : age));
  };

  const saveTraining = async () => {
    if (!user || !createFor) return;
    setSaving(true);
    try {
      const exercises = drillsToExercises(createFor.items);
      const { error } = await supabase.from('coach_trainings').insert({
        coach_id: user.id,
        owner_id: user.id,
        name: trainingName || createFor.title,
        description: 'Criado a partir da Biblioteca TreinON',
        age_group: trainingAge ? AGE_TO_TRAINING_GROUP[trainingAge] : null,
        objectives: [...new Set(createFor.items.map((i) => i.drill.objective))].slice(0, 3).join(' '),
        exercises: JSON.parse(JSON.stringify(exercises)),
        tactical_notes: null,
        diagram_url: null,
        duration_minutes: createFor.items.reduce((s, i) => s + i.minutes, 0),
        training_date: trainingDate || null,
        status: 'draft',
      });
      if (error) throw error;
      toast.success('Treino guardado nos teus treinos', {
        action: { label: 'Abrir', onClick: () => navigate('/training') },
      });
      setCreateFor(null);
      if (createFor.items === picked) setPicked([]);
    } catch (e) {
      toast.error('Não foi possível guardar: ' + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title="Biblioteca">
      <div className="mx-auto max-w-7xl space-y-6 pb-28">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-primary/5 to-accent/10 p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <BookOpen className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-2xl font-bold">Biblioteca do treinador</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">
                {DRILLS.length} exercícios com esquema, {SESSION_PLANS.length} treinos completos e um guia por escalão.
                Pensado para quem treina sozinho e com pouco material — tudo gratuito.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar exercício…" className="pl-9" />
          </div>
          <Select value={age} onValueChange={(v) => setAge(v as AgeBand | 'all')}>
            <SelectTrigger className="md:w-56"><SelectValue placeholder="Escalão" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os escalões</SelectItem>
              {AGE_BANDS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
            <Switch checked={lowResource} onCheckedChange={setLowResource} />
            <Package className="h-4 w-4 text-muted-foreground" />
            Só bolas e cones
          </label>
        </div>

        <Tabs defaultValue="drills">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="drills" className="gap-1.5"><Dumbbell className="h-4 w-4" />Exercícios</TabsTrigger>
            <TabsTrigger value="plans" className="gap-1.5"><ListChecks className="h-4 w-4" />Treinos prontos</TabsTrigger>
            <TabsTrigger value="guide" className="gap-1.5"><GraduationCap className="h-4 w-4" />Guia por escalão</TabsTrigger>
          </TabsList>

          {/* ─── Drills ─── */}
          <TabsContent value="drills" className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <Button size="sm" variant={category === 'all' ? 'default' : 'outline'} onClick={() => setCategory('all')} className="rounded-full">Todos</Button>
              {DRILL_CATEGORIES.map((c) => (
                <Button key={c.value} size="sm" variant={category === c.value ? 'default' : 'outline'} onClick={() => setCategory(c.value)} className="shrink-0 rounded-full">
                  {c.label}
                </Button>
              ))}
            </div>

            {drills.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum exercício com estes filtros.</CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {drills.map((d) => (
                  <Card key={d.id} className={`group overflow-hidden transition hover:shadow-md ${isPicked(d) ? 'ring-2 ring-primary' : ''}`}>
                    <button type="button" onClick={() => setOpen(d)} className="block w-full text-left">
                      <DrillDiagram elements={d.diagram} title={d.name} className="w-full bg-[hsl(var(--field-dark))]" />
                      <div className="space-y-2 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display font-semibold leading-tight">{d.name}</h3>
                          <Badge variant="secondary" className="shrink-0">{categoryLabel(d.category)}</Badge>
                        </div>
                        <p className="line-clamp-2 text-sm text-muted-foreground">{d.objective}</p>
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5"><Clock className="h-3 w-3" />{d.minutes} min</span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5"><Users className="h-3 w-3" />{d.players.min}–{d.players.max}</span>
                          <span className="rounded-md bg-muted px-2 py-0.5">{agesLabel(d.ages)}</span>
                          {isLowResource(d) && <span className="rounded-md bg-primary/10 px-2 py-0.5 text-primary">Pouco material</span>}
                        </div>
                      </div>
                    </button>
                    <div className="border-t px-4 py-2">
                      <Button variant={isPicked(d) ? 'secondary' : 'ghost'} size="sm" className="w-full" onClick={() => togglePick(d)}>
                        {isPicked(d) ? <><Check className="mr-1 h-4 w-4" />No treino</> : <><Plus className="mr-1 h-4 w-4" />Adicionar ao treino</>}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── Plans ─── */}
          <TabsContent value="plans" className="grid gap-4 lg:grid-cols-2">
            {plans.map((p: SessionPlan) => {
              const items = sessionDrills(p);
              return (
                <Card key={p.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="font-display text-lg">{p.name}</CardTitle>
                      <Badge variant="outline" className="shrink-0"><Clock className="mr-1 h-3 w-3" />{p.minutes} min</Badge>
                    </div>
                    <CardDescription>{p.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-4">
                    <ol className="space-y-2">
                      {items.map(({ drill, minutes, note }, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                          <button type="button" onClick={() => setOpen(drill)} className="flex-1 text-left text-sm hover:underline">
                            {drill.name}
                            {note && <span className="block text-xs text-muted-foreground">{note}</span>}
                          </button>
                          <span className="text-xs text-muted-foreground">{minutes}'</span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => openCreate(p.name, items, p.ages[0])}><Sparkles className="mr-1 h-4 w-4" />Usar este treino</Button>
                      <Button size="sm" variant="outline" onClick={() => printPlan(p.name, p.theme, items)}><Printer className="mr-1 h-4 w-4" />Imprimir</Button>
                      <Button size="sm" variant="outline" onClick={() => shareText(shareablePlan(p.name, items), p.name)}><Share2 className="mr-1 h-4 w-4" />Partilhar</Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          {/* ─── Guide ─── */}
          <TabsContent value="guide" className="grid gap-4 md:grid-cols-2">
            {guides.map((g) => (
              <Card key={g.age}>
                <CardHeader>
                  <CardTitle className="font-display">{AGE_BANDS.find((a) => a.value === g.age)?.label}</CardTitle>
                  <CardDescription>{g.format} · {g.sessionShape}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-sm font-semibold text-primary">Prioridades</p>
                    <ul className="space-y-1 text-sm">{g.priorities.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{x}</li>)}</ul>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-destructive">Evitar</p>
                    <ul className="space-y-1 text-sm">{g.avoid.map((x) => <li key={x} className="flex gap-2"><X className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />{x}</li>)}</ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Selection tray */}
      {picked.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-4 md:bottom-4 md:left-[var(--sidebar-width,0px)]">
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl border bg-card/95 p-3 shadow-xl backdrop-blur">
            <div className="flex-1 text-sm">
              <p className="font-semibold">{picked.length} exercício{picked.length > 1 ? 's' : ''} · {pickedMinutes} min</p>
              <p className="truncate text-xs text-muted-foreground">{picked.map((p) => p.drill.name).join(' → ')}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPicked([])}>Limpar</Button>
            <Button size="sm" onClick={() => openCreate('O meu treino', picked)}>Criar treino</Button>
          </div>
        </div>
      )}

      {/* Drill detail */}
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">{open.name}</DialogTitle>
                <DialogDescription>{open.objective}</DialogDescription>
              </DialogHeader>
              <DrillDiagram elements={open.diagram} title={open.name} className="w-full rounded-lg" />
              <DiagramLegend />
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge variant="secondary">{categoryLabel(open.category)}</Badge>
                <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />{open.minutes} min</Badge>
                <Badge variant="outline"><Users className="mr-1 h-3 w-3" />{open.players.min}–{open.players.max} jogadores</Badge>
                <Badge variant="outline">{agesLabel(open.ages)}</Badge>
                <span className={`rounded-md px-2 py-0.5 ${INTENSITY[open.intensity].className}`}>{INTENSITY[open.intensity].label}</span>
              </div>
              <div className="space-y-4 text-sm">
                <p><span className="font-semibold">Organização: </span>{open.setup} <span className="text-muted-foreground">({open.space})</span></p>
                <p><span className="font-semibold">Material: </span>{open.equipment.map((e) => EQUIPMENT_LABELS[e]).join(', ')}</p>
                <div>
                  <p className="mb-1 font-semibold">Como jogar</p>
                  <ol className="list-decimal space-y-1 pl-5">{open.howTo.map((s) => <li key={s}>{s}</li>)}</ol>
                </div>
                <div className="rounded-lg bg-primary/5 p-3">
                  <p className="mb-1 font-semibold text-primary">Pontos-chave para o treinador</p>
                  <ul className="space-y-1">{open.coachingPoints.map((s) => <li key={s} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{s}</li>)}</ul>
                </div>
                {open.progressions && (
                  <div>
                    <p className="mb-1 font-semibold">Progressões</p>
                    <ul className="list-disc space-y-1 pl-5">{open.progressions.map((s) => <li key={s}>{s}</li>)}</ul>
                  </div>
                )}
              </div>
              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={() => shareText(`⚽ *${open.name}*\n\n${drillToText(open)}\n\nFeito com TreinON`, open.name)}>
                  <Share2 className="mr-1 h-4 w-4" />Partilhar
                </Button>
                <Button onClick={() => { togglePick(open); setOpen(null); }}>
                  {isPicked(open) ? 'Retirar do treino' : <><Plus className="mr-1 h-4 w-4" />Adicionar ao treino</>}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create training */}
      <Dialog open={!!createFor} onOpenChange={(v) => !v && setCreateFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Guardar nos meus treinos</DialogTitle>
            <DialogDescription>
              {createFor?.items.length} exercícios · {createFor?.items.reduce((s, i) => s + i.minutes, 0)} min. Depois podes editar tudo em Treinos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="lib-name">Nome</Label>
              <Input id="lib-name" value={trainingName} onChange={(e) => setTrainingName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lib-date">Data (opcional)</Label>
                <Input id="lib-date" type="date" value={trainingDate} onChange={(e) => setTrainingDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Escalão</Label>
                <Select value={trainingAge} onValueChange={(v) => setTrainingAge(v as AgeBand)}>
                  <SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
                  <SelectContent>{AGE_BANDS.map((a) => <SelectItem key={a.value} value={a.value}>{a.short}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => createFor && printPlan(trainingName || createFor.title, 'Plano de treino', createFor.items)}>
              <Printer className="mr-1 h-4 w-4" />Imprimir
            </Button>
            <Button onClick={saveTraining} disabled={saving}>{saving ? 'A guardar…' : 'Guardar treino'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
