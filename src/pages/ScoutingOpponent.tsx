/**
 * The sheet of one opponent: how they play (schemes drawn on the tactical board, by moment
 * of the game), their squad, the matches watched and a summary with our own results against them.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, FileText, Pencil, Plus, Star, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { BoardPreview } from '@/components/board/BoardPreview';
import { TacticBoard } from '@/components/board/TacticBoard';
import { OpponentFormDialog, formToRow, type OpponentForm } from '@/components/scouting/OpponentFormDialog';
import { MatchPlanCard } from '@/components/scouting/MatchPlanCard';
import { clearBoardDraft, normalizeBoard, type BoardState } from '@/lib/tactic-board';
import {
  FOOT_LABEL, MOMENTS, headToHead, matchesAgainst, newSchemeBoard, nextMatchAgainst, schemesByMoment, sortSquad, sportLabel,
  type Opponent, type OpponentObservation, type OpponentPlayer, type OpponentScheme, type PlayedMatch, type SchemeMoment,
} from '@/lib/opponent-scouting';
import { tx, intlLocale } from '@/lib/i18n/ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types
const NO_FOOT = '__none__';
const day = (d: string) => new Date(d).toLocaleDateString(intlLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' });

interface SchemeDraft { id: string | null; moment: SchemeMoment; title: string; notes: string; board: BoardState; key: string }
interface PlayerDraft { id: string | null; shirt_number: string; name: string; position: string; foot: string; is_key: boolean; notes: string }
interface ObsDraft { id: string | null; observed_on: string; against: string; result: string; formation: string; notes: string }

export default function ScoutingOpponent() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [scheme, setScheme] = useState<SchemeDraft | null>(null);
  const [player, setPlayer] = useState<PlayerDraft | null>(null);
  const [obs, setObs] = useState<ObsDraft | null>(null);
  const [summary, setSummary] = useState<{ strengths: string; weaknesses: string; notes: string } | null>(null);

  const { data: opponent, isLoading } = useQuery({
    queryKey: ['scout-opponent', id],
    enabled: !!id && !!user,
    queryFn: async () => ((await db.from('scout_opponents').select('*').eq('id', id).maybeSingle()).data ?? null) as Opponent | null,
  });
  const { data: schemes = [] } = useQuery({
    queryKey: ['scout-schemes', id],
    enabled: !!id && !!user,
    queryFn: async () => ((await db.from('scout_opponent_schemes').select('*').eq('opponent_id', id).order('created_at')).data ?? []) as OpponentScheme[],
  });
  const { data: players = [] } = useQuery({
    queryKey: ['scout-players', id],
    enabled: !!id && !!user,
    queryFn: async () => ((await db.from('scout_opponent_players').select('*').eq('opponent_id', id)).data ?? []) as OpponentPlayer[],
  });
  const { data: observations = [] } = useQuery({
    queryKey: ['scout-observations', id],
    enabled: !!id && !!user,
    queryFn: async () => ((await db.from('scout_opponent_observations').select('*').eq('opponent_id', id).order('observed_on', { ascending: false })).data ?? []) as OpponentObservation[],
  });
  const { data: ourMatches = [] } = useQuery({
    queryKey: ['scout-our-matches', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('matches').select('id, opponent_name, match_date, status, is_home, goals_for, goals_against, team:teams(name)').eq('is_deleted', false).order('match_date', { ascending: false }).limit(500);
      return ((data ?? []) as unknown as (PlayedMatch & { team: { name: string } | null })[]).map((m) => ({ ...m, team_name: m.team?.name ?? null }));
    },
  });

  const grouped = useMemo(() => schemesByMoment(schemes), [schemes]);
  const squad = useMemo(() => sortSquad(players), [players]);
  const against = useMemo(() => (opponent ? matchesAgainst(ourMatches, opponent.name) : []), [ourMatches, opponent]);
  const h2h = useMemo(() => headToHead(against), [against]);
  const nextMatch = useMemo(() => (opponent ? nextMatchAgainst(ourMatches, opponent.name) : null), [ourMatches, opponent]);
  const refresh = (what: string) => { qc.invalidateQueries({ queryKey: [what, id] }); qc.invalidateQueries({ queryKey: ['scout-opponents'] }); };
  const fail = (what: string, e: { message: string }) => toast.error(`${what}: ${e.message}`);

  // ── the sheet itself ──
  const saveHeader = async (form: OpponentForm) => {
    const { error } = await db.from('scout_opponents').update(formToRow(form)).eq('id', id);
    if (error) { fail('Não foi possível guardar', error); throw error; }
    refresh('scout-opponent'); toast.success(tx('Ficha atualizada.'));
  };
  const removeOpponent = async () => {
    if (!opponent || !window.confirm(tx('Apagar a ficha de "{{v0}}"? Os esquemas, o plantel e as observações desta equipa são apagados.', { v0: opponent.name }))) return;
    const { data, error } = await db.from('scout_opponents').delete().eq('id', id).select('id');
    if (error) return fail('Não foi possível apagar', error);
    if (!data?.length) return toast.error(tx('Só quem criou a ficha (ou o administrador do clube) a pode apagar.'));
    qc.invalidateQueries({ queryKey: ['scout-opponents'] });
    toast.success(tx('Ficha apagada.'));
    navigate('/scouting');
  };
  const saveSummary = async () => {
    if (!summary) return;
    const { error } = await db.from('scout_opponents').update({ strengths: summary.strengths.trim() || null, weaknesses: summary.weaknesses.trim() || null, notes: summary.notes.trim() || null }).eq('id', id);
    if (error) return fail('Não foi possível guardar', error);
    setSummary(null); refresh('scout-opponent'); toast.success(tx('Resumo guardado.'));
  };

  // ── schemes ──
  const openNewScheme = (moment: SchemeMoment) => opponent && setScheme({
    id: null, moment, title: '', notes: '', board: newSchemeBoard(opponent.sport_type, moment, opponent.usual_formation), key: `scout-scheme-new-${opponent.id}-${moment}`,
  });
  const openScheme = (s: OpponentScheme) => opponent && setScheme({
    id: s.id, moment: s.moment, title: s.title, notes: s.notes ?? '', board: normalizeBoard(s.board_data, opponent.sport_type), key: `scout-scheme-${s.id}-${s.updated_at}`,
  });
  const saveScheme = async (board: BoardState) => {
    if (!scheme) return;
    const title = scheme.title.trim();
    if (!title) return toast.error(tx('Dê um nome ao esquema (ex.: Saída de bola pelo lateral direito).'));
    const row = { moment: scheme.moment, title, notes: scheme.notes.trim() || null, board_data: board };
    const { error } = scheme.id
      ? await db.from('scout_opponent_schemes').update(row).eq('id', scheme.id)
      : await db.from('scout_opponent_schemes').insert({ ...row, opponent_id: id });
    if (error) return fail('Não foi possível guardar o esquema', error);
    clearBoardDraft(scheme.key);
    setScheme(null); refresh('scout-schemes'); toast.success(tx('Esquema guardado.'));
  };
  const removeScheme = async (s: OpponentScheme) => {
    if (!window.confirm(tx('Apagar o esquema "{{v0}}"?', { v0: s.title }))) return;
    const { error } = await db.from('scout_opponent_schemes').delete().eq('id', s.id);
    if (error) return fail('Não foi possível apagar', error);
    refresh('scout-schemes');
  };

  // ── squad ──
  const blankPlayer = (): PlayerDraft => ({ id: null, shirt_number: '', name: '', position: '', foot: NO_FOOT, is_key: false, notes: '' });
  const savePlayer = async () => {
    if (!player) return;
    if (!player.shirt_number.trim() && !player.name.trim()) return toast.error(tx('Indique pelo menos o número ou o nome.'));
    const row = { shirt_number: player.shirt_number.trim() || null, name: player.name.trim() || null, position: player.position.trim() || null, foot: player.foot === NO_FOOT ? null : player.foot, is_key: player.is_key, notes: player.notes.trim() || null };
    const { error } = player.id ? await db.from('scout_opponent_players').update(row).eq('id', player.id) : await db.from('scout_opponent_players').insert({ ...row, opponent_id: id });
    if (error) return fail('Não foi possível guardar o jogador', error);
    setPlayer(null); refresh('scout-players');
  };
  const toggleKey = async (p: OpponentPlayer) => {
    const { error } = await db.from('scout_opponent_players').update({ is_key: !p.is_key }).eq('id', p.id);
    if (error) return fail('Não foi possível guardar', error);
    refresh('scout-players');
  };
  const removePlayer = async (p: OpponentPlayer) => {
    if (!window.confirm(tx('Tirar {{v0}} do plantel?', { v0: p.name || `o n.º ${p.shirt_number}` }))) return;
    const { error } = await db.from('scout_opponent_players').delete().eq('id', p.id);
    if (error) return fail('Não foi possível apagar', error);
    refresh('scout-players');
  };

  // ── matches watched ──
  const blankObs = (): ObsDraft => ({ id: null, observed_on: new Date().toISOString().slice(0, 10), against: '', result: '', formation: opponent?.usual_formation ?? '', notes: '' });
  const saveObs = async () => {
    if (!obs) return;
    const row = { observed_on: obs.observed_on, against: obs.against.trim() || null, result: obs.result.trim() || null, formation: obs.formation.trim() || null, notes: obs.notes.trim() || null };
    const { error } = obs.id ? await db.from('scout_opponent_observations').update(row).eq('id', obs.id) : await db.from('scout_opponent_observations').insert({ ...row, opponent_id: id });
    if (error) return fail('Não foi possível guardar a observação', error);
    setObs(null); refresh('scout-observations');
  };
  const removeObs = async (o: OpponentObservation) => {
    if (!window.confirm(tx('Apagar esta observação?'))) return;
    const { error } = await db.from('scout_opponent_observations').delete().eq('id', o.id);
    if (error) return fail('Não foi possível apagar', error);
    refresh('scout-observations');
  };

  if (isLoading) return <AppLayout title={tx('Scouting')}><p className="py-10 text-center text-sm text-muted-foreground">{tx('A carregar…')}</p></AppLayout>;
  if (!opponent) {
    return (
      <AppLayout title={tx('Scouting')}>
        <div className="space-y-3 py-10 text-center">
          <p className="font-medium">{tx('Ficha não encontrada')}</p>
          <p className="text-sm text-muted-foreground">{tx('Pode ter sido apagada, ou pertence a outra equipa técnica.')}</p>
          <Button variant="outline" asChild><Link to="/scouting">{tx('Voltar aos adversários')}</Link></Button>
        </div>
      </AppLayout>
    );
  }

  // drawing a scheme takes the whole screen: the board needs the room
  if (scheme) {
    return (
      <AppLayout title={tx('Scouting')}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => { if (window.confirm(tx('Sair sem guardar? O desenho fica neste aparelho até voltar a abrir este esquema.'))) setScheme(null); }}><ArrowLeft className="mr-1 h-4 w-4" />{opponent.name}</Button>
            <span className="text-sm text-muted-foreground">{scheme.id ? tx('Editar esquema') : tx('Novo esquema')} {tx('· a vermelho, o adversário')}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-[14rem_1fr]">
            <Select value={scheme.moment} onValueChange={(v) => setScheme((s) => s && { ...s, moment: v as SchemeMoment })}>
              <SelectTrigger aria-label={tx('Momento do jogo')}><SelectValue /></SelectTrigger>
              <SelectContent>{MOMENTS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input maxLength={120} placeholder={tx('Nome do esquema (ex.: Saída de bola pelo lateral direito)')} value={scheme.title} onChange={(e) => setScheme((s) => s && { ...s, title: e.target.value })} aria-label={tx('Nome do esquema')} />
          </div>
          <Textarea rows={2} maxLength={4000} placeholder={tx('O que se vê e como podemos aproveitar (ex.: o central esquerdo demora a soltar; pressionar aí).')} value={scheme.notes} onChange={(e) => setScheme((s) => s && { ...s, notes: e.target.value })} aria-label={tx('Notas do esquema')} />
          <TacticBoard key={scheme.key} persistKey={scheme.key} initial={scheme.board} onSaveExternal={saveScheme} saveLabel="Guardar esquema" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={tx('Scouting')}>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <Button variant="ghost" size="icon" asChild aria-label={tx('Voltar aos adversários')}><Link to="/scouting"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold">{opponent.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {opponent.category && <Badge variant="secondary">{opponent.category}</Badge>}
              <Badge variant="outline">{sportLabel(opponent.sport_type)}</Badge>
              {opponent.usual_formation && <Badge variant="outline" className="font-mono">{opponent.usual_formation}</Badge>}
              {opponent.competition && <span className="text-sm text-muted-foreground">{opponent.competition}</span>}
              {opponent.coach_name && <span className="text-sm text-muted-foreground">{tx('· Treinador:')}{' '}{opponent.coach_name}</span>}
            </div>
          </div>
          <Button variant="outline" size="sm" asChild><Link to={`/scouting/adversarios/${opponent.id}/relatorio${nextMatch ? `?jogo=${nextMatch.id}` : ''}`} target="_blank"><FileText className="mr-1.5 h-4 w-4" />{tx('Relatório')}</Link></Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="mr-1.5 h-4 w-4" />{tx('Editar')}</Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={removeOpponent}><Trash2 className="mr-1.5 h-4 w-4" />{tx('Apagar')}</Button>
        </div>

        {nextMatch && (
          <MatchPlanCard matchId={nextMatch.id} opponentName={nextMatch.opponent_name} sportType={opponent.sport_type}
            heading={tx('próximo jogo, {{v0}}{{v1}}', { v0: day(nextMatch.match_date), v1: nextMatch.team_name ? ` · ${nextMatch.team_name}` : '' })} />
        )}

        <Tabs defaultValue="schemes">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="schemes">{tx('Como jogam (')}{schemes.length})</TabsTrigger>
            <TabsTrigger value="squad">{tx('Plantel (')}{players.length})</TabsTrigger>
            <TabsTrigger value="observations">{tx('Jogos vistos (')}{observations.length})</TabsTrigger>
            <TabsTrigger value="summary">{tx('Resumo')}</TabsTrigger>
          </TabsList>

          {/* ── schemes, by moment of the game ── */}
          <TabsContent value="schemes" className="space-y-5">
            {MOMENTS.map((m) => (
              <section key={m.key} className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-2 border-b pb-1.5">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wide">{m.label}</h2>
                    <p className="text-xs text-muted-foreground">{m.hint}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => openNewScheme(m.key)}><Plus className="mr-1 h-3.5 w-3.5" />{tx('Esquema')}</Button>
                </div>
                {grouped[m.key].length === 0 ? (
                  <p className="text-sm text-muted-foreground">{tx('Ainda sem esquemas.')}</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {grouped[m.key].map((s) => (
                      <Card key={s.id} className="overflow-hidden">
                        <button type="button" className="block w-full text-left" onClick={() => openScheme(s)} aria-label={tx('Abrir o esquema {{v0}}', { v0: s.title })}>
                          <BoardPreview state={normalizeBoard(s.board_data, opponent.sport_type)} className="rounded-none" />
                        </button>
                        <CardContent className="space-y-1 p-3">
                          <div className="flex items-start gap-1">
                            <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{s.title}</p>
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => openScheme(s)} aria-label={tx('Editar esquema')}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removeScheme(s)} aria-label={tx('Apagar esquema')}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                          {s.notes && <p className="whitespace-pre-line text-xs text-muted-foreground">{s.notes}</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </TabsContent>

          {/* ── squad ── */}
          <TabsContent value="squad" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{tx('A estrela marca os jogadores-chave; aparecem primeiro.')}</p>
              <Button size="sm" onClick={() => setPlayer(blankPlayer())}><Plus className="mr-1.5 h-4 w-4" />{tx('Jogador')}</Button>
            </div>
            {squad.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-2 h-8 w-8 opacity-50" />{tx('Ainda sem jogadores. Basta o número e uma nota (ex.: «10 — esquerdino, remata de longe»).')}</CardContent></Card>
            ) : (
              <div className="divide-y rounded-md border bg-card">
                {squad.map((p) => (
                  <div key={p.id} className="flex items-start gap-2 p-2.5">
                    <button type="button" onClick={() => toggleKey(p)} className="mt-0.5 shrink-0" aria-label={p.is_key ? tx('Deixar de marcar como jogador-chave') : tx('Marcar como jogador-chave')} aria-pressed={p.is_key}>
                      <Star className={cn('h-4 w-4', p.is_key ? 'fill-accent text-accent' : 'text-muted-foreground/50')} />
                    </button>
                    <span className="w-8 shrink-0 text-center font-mono text-sm font-bold tabular-nums">{p.shirt_number || '–'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-medium">{p.name || tx('Sem nome')}</span>
                        {p.position && <Badge variant="outline" className="text-[11px]">{p.position}</Badge>}
                        {p.foot && <span className="text-xs text-muted-foreground">{tx('Pé')}{' '}{FOOT_LABEL[p.foot].toLowerCase()}</span>}
                      </div>
                      {p.notes && <p className="whitespace-pre-line text-xs text-muted-foreground">{p.notes}</p>}
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setPlayer({ id: p.id, shirt_number: p.shirt_number ?? '', name: p.name ?? '', position: p.position ?? '', foot: p.foot ?? NO_FOOT, is_key: p.is_key, notes: p.notes ?? '' })} aria-label={tx('Editar jogador')}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-destructive" onClick={() => removePlayer(p)} aria-label={tx('Apagar jogador')}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── matches watched ── */}
          <TabsContent value="observations" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{tx('Um registo por jogo visto, ao vivo ou em vídeo.')}</p>
              <Button size="sm" onClick={() => setObs(blankObs())}><Plus className="mr-1.5 h-4 w-4" />{tx('Jogo visto')}</Button>
            </div>
            {observations.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Eye className="mx-auto mb-2 h-8 w-8 opacity-50" />{tx('Ainda sem jogos vistos.')}</CardContent></Card>
            ) : observations.map((o) => (
              <Card key={o.id}>
                <CardContent className="space-y-1 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm tabular-nums">{day(o.observed_on)}</span>
                    {o.against && <span className="text-sm font-medium">vs {o.against}</span>}
                    {o.result && <Badge variant="secondary" className="font-mono">{o.result}</Badge>}
                    {o.formation && <Badge variant="outline" className="font-mono">{o.formation}</Badge>}
                    <span className="ml-auto flex">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setObs({ id: o.id, observed_on: o.observed_on, against: o.against ?? '', result: o.result ?? '', formation: o.formation ?? '', notes: o.notes ?? '' })} aria-label={tx('Editar observação')}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeObs(o)} aria-label={tx('Apagar observação')}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </span>
                  </div>
                  {o.notes && <p className="whitespace-pre-line text-sm">{o.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* ── summary: strengths, weaknesses, our results against them ── */}
          <TabsContent value="summary" className="space-y-4">
            <Card>
              <CardContent className="space-y-3 p-4">
                {summary ? (
                  <>
                    <div><Label htmlFor="sum-strong">{tx('Pontos fortes')}</Label><Textarea id="sum-strong" rows={3} maxLength={4000} value={summary.strengths} onChange={(e) => setSummary({ ...summary, strengths: e.target.value })} /></div>
                    <div><Label htmlFor="sum-weak">{tx('Pontos fracos')}</Label><Textarea id="sum-weak" rows={3} maxLength={4000} value={summary.weaknesses} onChange={(e) => setSummary({ ...summary, weaknesses: e.target.value })} /></div>
                    <div><Label htmlFor="sum-notes">{tx('Outras notas')}</Label><Textarea id="sum-notes" rows={3} maxLength={8000} value={summary.notes} onChange={(e) => setSummary({ ...summary, notes: e.target.value })} placeholder={tx('Campo, ambiente, comportamento do banco…')} /></div>
                    <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSummary(null)}>{tx('Cancelar')}</Button><Button onClick={saveSummary}>{tx('Guardar resumo')}</Button></div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx('Pontos fortes')}</p><p className="mt-1 whitespace-pre-line text-sm">{opponent.strengths || '—'}</p></div>
                      <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx('Pontos fracos')}</p><p className="mt-1 whitespace-pre-line text-sm">{opponent.weaknesses || '—'}</p></div>
                    </div>
                    {opponent.notes && <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx('Outras notas')}</p><p className="mt-1 whitespace-pre-line text-sm">{opponent.notes}</p></div>}
                    <Button size="sm" variant="outline" onClick={() => setSummary({ strengths: opponent.strengths ?? '', weaknesses: opponent.weaknesses ?? '', notes: opponent.notes ?? '' })}><Pencil className="mr-1.5 h-4 w-4" />{tx('Editar resumo')}</Button>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx('Os nossos jogos contra esta equipa')}</p>
                {against.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{tx('Nenhum jogo no calendário com o nome «')}{opponent.name}{tx('». Os jogos aparecem aqui quando o adversário tem exatamente este nome.')}</p>
                ) : (
                  <>
                    {h2h.played > 0 && (
                      <p className="font-mono text-sm tabular-nums">{h2h.played} J · {h2h.won} V · {h2h.drawn} E · {h2h.lost} D · {h2h.goalsFor}–{h2h.goalsAgainst} {tx('em golos')}</p>
                    )}
                    <div className="divide-y">
                      {against.map((m) => (
                        <div key={m.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                          <span className="font-mono tabular-nums">{day(m.match_date)}</span>
                          <span className="text-muted-foreground">{m.team_name}{m.is_home === false ? tx(' (fora)') : m.is_home ? tx(' (casa)') : ''}</span>
                          <span className="ml-auto font-mono font-semibold tabular-nums">{m.goals_for != null && m.goals_against != null && m.status === 'completed' ? `${m.goals_for}–${m.goals_against}` : tx('por jogar')}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <OpponentFormDialog open={editOpen} onOpenChange={setEditOpen} initial={opponent} onSubmit={saveHeader} />

      <Dialog open={!!player} onOpenChange={(o) => !o && setPlayer(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{player?.id ? tx('Editar jogador') : tx('Jogador do adversário')}</DialogTitle></DialogHeader>
          {player && (
            <div className="grid grid-cols-[5rem_1fr] gap-3">
              <div><Label htmlFor="pl-n">N.º</Label><Input id="pl-n" maxLength={3} inputMode="numeric" value={player.shirt_number} onChange={(e) => setPlayer({ ...player, shirt_number: e.target.value })} autoFocus /></div>
              <div><Label htmlFor="pl-name">{tx('Nome')}</Label><Input id="pl-name" maxLength={120} value={player.name} onChange={(e) => setPlayer({ ...player, name: e.target.value })} /></div>
              <div><Label htmlFor="pl-pos">{tx('Posição')}</Label><Input id="pl-pos" maxLength={20} value={player.position} onChange={(e) => setPlayer({ ...player, position: e.target.value })} placeholder="MC" /></div>
              <div>
                <Label>{tx('Pé')}</Label>
                <Select value={player.foot} onValueChange={(v) => setPlayer({ ...player, foot: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_FOOT}>{tx('Não sei')}</SelectItem>
                    {Object.entries(FOOT_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label htmlFor="pl-notes">{tx('Notas')}</Label><Textarea id="pl-notes" rows={3} maxLength={2000} value={player.notes} onChange={(e) => setPlayer({ ...player, notes: e.target.value })} placeholder={tx('O que faz bem, o que evita, como o travar.')} /></div>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4" checked={player.is_key} onChange={(e) => setPlayer({ ...player, is_key: e.target.checked })} />
                {tx('Jogador-chave')}
              </label>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setPlayer(null)}>{tx('Cancelar')}</Button><Button onClick={savePlayer}>{tx('Guardar')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!obs} onOpenChange={(o) => !o && setObs(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{obs?.id ? tx('Editar jogo visto') : tx('Jogo visto')}</DialogTitle></DialogHeader>
          {obs && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="ob-date">{tx('Data')}</Label><Input id="ob-date" type="date" value={obs.observed_on} onChange={(e) => setObs({ ...obs, observed_on: e.target.value })} /></div>
              <div><Label htmlFor="ob-vs">{tx('Contra quem jogaram')}</Label><Input id="ob-vs" maxLength={120} value={obs.against} onChange={(e) => setObs({ ...obs, against: e.target.value })} /></div>
              <div><Label htmlFor="ob-res">{tx('Resultado')}</Label><Input id="ob-res" maxLength={20} value={obs.result} onChange={(e) => setObs({ ...obs, result: e.target.value })} placeholder="2-1" /></div>
              <div><Label htmlFor="ob-form">{tx('Formação que usaram')}</Label><Input id="ob-form" maxLength={20} value={obs.formation} onChange={(e) => setObs({ ...obs, formation: e.target.value })} placeholder="4-3-3" /></div>
              <div className="sm:col-span-2"><Label htmlFor="ob-notes">{tx('O que se viu')}</Label><Textarea id="ob-notes" rows={6} maxLength={8000} value={obs.notes} onChange={(e) => setObs({ ...obs, notes: e.target.value })} placeholder={tx('Como entraram, o que mudou depois dos golos ou das substituições, quem fez a diferença.')} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setObs(null)}>{tx('Cancelar')}</Button><Button onClick={saveObs} disabled={!obs?.observed_on}>{tx('Guardar')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
