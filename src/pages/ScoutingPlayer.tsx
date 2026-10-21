/**
 * The sheet of a watched player: who he is (football data only), where he stands
 * (identified → following → priority → on trial → signed), the radar of the marks and
 * every observation. A contact is kept apart, only with permission.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Eye, FileText, Info, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { ScoutEvolution, ScoutRadar } from '@/components/scouting/ScoutCharts';
import { ScoutPlayerFormDialog, playerFormToRow, type ScoutPlayerForm } from '@/components/scouting/ScoutPlayerFormDialog';
import { STATUS_TONE } from '@/components/scouting/ScoutPlayersTab';
import { FOOT_LABEL, sportLabel } from '@/lib/opponent-scouting';
import {
  AREAS, MARK_LABELS, RECOMMENDATIONS, STATUSES, ageOf, areaAverages, cleanLinks, isMinor, markHistory, observationMark, overallMark,
  recommendationLabel, relativeAgeNote, statusLabel, yearOfBirth,
  type AreaKey, type Recommendation, type ScoutObservation, type ScoutPlayer, type ScoutStatus,
} from '@/lib/player-scouting';
import { tx, intlLocale } from '@/lib/i18n/ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types
const NO_REC = '__none__';
const day = (d: string) => new Date(d).toLocaleDateString(intlLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
const num = (n: number | null) => (n != null ? String(n).replace('.', ',') : '–');

interface ObsDraft { id: string | null; observed_on: string; context: string; position_played: string; minutes_seen: string; marks: Record<AreaKey, number | null>; strengths: string; weaknesses: string; notes: string; recommendation: string }
interface Contact { scout_player_id: string; contact: string; permission_note: string | null }

export default function ScoutingPlayer() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [obs, setObs] = useState<ObsDraft | null>(null);
  const [notes, setNotes] = useState<{ summary: string; links: string } | null>(null);
  const [contactDraft, setContactDraft] = useState<{ contact: string; note: string; allowed: boolean } | null>(null);

  const { data: player, isLoading } = useQuery({
    queryKey: ['scout-player', id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data } = await db.from('scout_players').select('*').eq('id', id).maybeSingle();
      return data ? ({ ...data, video_links: data.video_links ?? [] } as ScoutPlayer) : null;
    },
  });
  const { data: observations = [] } = useQuery({
    queryKey: ['scout-player-observations', id],
    enabled: !!id && !!user,
    queryFn: async () => ((await db.from('scout_player_observations').select('*').eq('scout_player_id', id).order('observed_on', { ascending: false })).data ?? []) as ScoutObservation[],
  });
  // only who may read it gets a row back
  const { data: contact = null } = useQuery({
    queryKey: ['scout-player-contact', id],
    enabled: !!id && !!user,
    queryFn: async () => ((await db.from('scout_player_contacts').select('scout_player_id, contact, permission_note').eq('scout_player_id', id).maybeSingle()).data ?? null) as Contact | null,
  });

  const averages = useMemo(() => areaAverages(observations), [observations]);
  const overall = useMemo(() => overallMark(observations), [observations]);
  const history = useMemo(() => markHistory(observations), [observations]);
  const refresh = (key: string) => { qc.invalidateQueries({ queryKey: [key, id] }); qc.invalidateQueries({ queryKey: ['scout-players-list'] }); };
  const fail = (what: string, e: { message: string }) => toast.error(`${what}: ${e.message}`);

  const saveHeader = async (form: ScoutPlayerForm) => {
    const { error } = await db.from('scout_players').update(playerFormToRow(form)).eq('id', id);
    if (error) { fail('Não foi possível guardar', error); throw error; }
    refresh('scout-player'); toast.success(tx('Ficha atualizada.'));
  };
  const setStatus = async (status: ScoutStatus) => {
    const { error } = await db.from('scout_players').update({ status }).eq('id', id);
    if (error) return fail('Não foi possível mudar o estado', error);
    refresh('scout-player');
    toast.success(status === 'signed' ? tx('Marcado como inscrito. Crie-o em Jogadores para entrar no plantel.') : tx('Estado: {{v0}}.', { v0: statusLabel(status) }));
  };
  const remove = async () => {
    if (!player || !window.confirm(tx('Apagar a ficha de "{{v0}}"? As observações e o contacto são apagados.', { v0: player.name }))) return;
    const { data, error } = await db.from('scout_players').delete().eq('id', id).select('id');
    if (error) return fail('Não foi possível apagar', error);
    if (!data?.length) return toast.error(tx('Só quem criou a ficha (ou o administrador do clube) a pode apagar.'));
    qc.invalidateQueries({ queryKey: ['scout-players-list'] });
    toast.success(tx('Ficha apagada.'));
    navigate('/scouting?tab=jogadores');
  };
  const saveNotes = async () => {
    if (!notes) return;
    const { error } = await db.from('scout_players').update({ summary: notes.summary.trim() || null, video_links: cleanLinks(notes.links) }).eq('id', id);
    if (error) return fail('Não foi possível guardar', error);
    setNotes(null); refresh('scout-player');
  };

  // ── observations ──
  const blankObs = (): ObsDraft => ({
    id: null, observed_on: new Date().toISOString().slice(0, 10), context: '', position_played: player?.position ?? '', minutes_seen: '',
    marks: { technical: null, tactical: null, physical: null, mental: null, potential: null }, strengths: '', weaknesses: '', notes: '', recommendation: NO_REC,
  });
  const editObs = (o: ScoutObservation) => setObs({
    id: o.id, observed_on: o.observed_on, context: o.context ?? '', position_played: o.position_played ?? '', minutes_seen: o.minutes_seen != null ? String(o.minutes_seen) : '',
    marks: { technical: o.technical, tactical: o.tactical, physical: o.physical, mental: o.mental, potential: o.potential },
    strengths: o.strengths ?? '', weaknesses: o.weaknesses ?? '', notes: o.notes ?? '', recommendation: o.recommendation ?? NO_REC,
  });
  const saveObs = async () => {
    if (!obs) return;
    const mins = parseInt(obs.minutes_seen, 10);
    const row = {
      observed_on: obs.observed_on, context: obs.context.trim() || null, position_played: obs.position_played.trim() || null,
      minutes_seen: Number.isFinite(mins) && mins >= 0 && mins <= 200 ? mins : null, ...obs.marks,
      strengths: obs.strengths.trim() || null, weaknesses: obs.weaknesses.trim() || null, notes: obs.notes.trim() || null,
      recommendation: obs.recommendation === NO_REC ? null : (obs.recommendation as Recommendation),
    };
    const { error } = obs.id ? await db.from('scout_player_observations').update(row).eq('id', obs.id) : await db.from('scout_player_observations').insert({ ...row, scout_player_id: id });
    if (error) return fail('Não foi possível guardar a observação', error);
    setObs(null); refresh('scout-player-observations'); toast.success(tx('Observação guardada.'));
  };
  const removeObs = async (o: ScoutObservation) => {
    if (!window.confirm(tx('Apagar a observação de {{v0}}?', { v0: day(o.observed_on) }))) return;
    const { error } = await db.from('scout_player_observations').delete().eq('id', o.id);
    if (error) return fail('Não foi possível apagar', error);
    refresh('scout-player-observations');
  };

  // ── contact ──
  const saveContact = async () => {
    if (!contactDraft || !contactDraft.allowed || !contactDraft.contact.trim()) return;
    const row = { scout_player_id: id, contact: contactDraft.contact.trim(), permission_given: true, permission_note: contactDraft.note.trim() || null, noted_by: user!.id };
    const { error } = contact
      ? await db.from('scout_player_contacts').update({ contact: row.contact, permission_note: row.permission_note }).eq('scout_player_id', id)
      : await db.from('scout_player_contacts').insert(row);
    if (error) return toast.error(error.code === '23505' ? tx('Já existe um contacto guardado por outra pessoa; só ela e o administrador do clube o veem.') : tx('Não foi possível guardar o contacto: ') + error.message);
    setContactDraft(null); refresh('scout-player-contact'); toast.success(tx('Contacto guardado.'));
  };
  const removeContact = async () => {
    if (!window.confirm(tx('Apagar o contacto guardado?'))) return;
    const { error } = await db.from('scout_player_contacts').delete().eq('scout_player_id', id);
    if (error) return fail('Não foi possível apagar', error);
    refresh('scout-player-contact');
  };

  if (isLoading) return <AppLayout title={tx('Scouting')}><p className="py-10 text-center text-sm text-muted-foreground">{tx('A carregar…')}</p></AppLayout>;
  if (!player) {
    return (
      <AppLayout title={tx('Scouting')}>
        <div className="space-y-3 py-10 text-center">
          <p className="font-medium">{tx('Ficha não encontrada')}</p>
          <p className="text-sm text-muted-foreground">{tx('Pode ter sido apagada, ou pertence a outra equipa técnica.')}</p>
          <Button variant="outline" asChild><Link to="/scouting?tab=jogadores">{tx('Voltar aos jogadores')}</Link></Button>
        </div>
      </AppLayout>
    );
  }

  const age = ageOf(player);
  const minor = isMinor(player);
  const ageNote = relativeAgeNote(player);
  const facts: [string, string | null][] = [
    ['Nascimento', player.birth_date ? `${day(player.birth_date)}${age != null ? ` (${age} anos)` : ''}` : yearOfBirth(player) ? `${yearOfBirth(player)}${age != null ? ` (${age} anos este ano)` : ''}` : null],
    ['Clube atual', player.current_club], ['Escalão', player.category], ['Modalidade', sportLabel(player.sport_type)],
    ['Posição', [player.position, player.other_positions].filter(Boolean).join(' · ') || null],
    ['Pé', player.foot ? FOOT_LABEL[player.foot] : null], ['Altura', player.height_cm ? `${player.height_cm} cm` : null], ['Onde foi visto', player.found_at],
  ];

  return (
    <AppLayout title={tx('Scouting')}>
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <Button variant="ghost" size="icon" asChild aria-label={tx('Voltar aos jogadores')}><Link to="/scouting?tab=jogadores"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold">{player.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', STATUS_TONE[player.status])}>{statusLabel(player.status)}</span>
              {player.position && <Badge variant="outline">{player.position}</Badge>}
              {[player.current_club, player.category, age != null ? `${age} anos` : null].filter(Boolean).join(' · ')}
            </div>
          </div>
          <Button variant="outline" size="sm" asChild><Link to={`/scouting/jogadores/${player.id}/relatorio`} target="_blank"><FileText className="mr-1.5 h-4 w-4" />{tx('Relatório')}</Link></Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="mr-1.5 h-4 w-4" />{tx('Editar')}</Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}><Trash2 className="mr-1.5 h-4 w-4" />{tx('Apagar')}</Button>
        </div>

        {/* where he stands */}
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx('Estado')}</p>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={tx('Estado do jogador')}>
              {STATUSES.map((s) => (
                <Button key={s.key} size="sm" variant={player.status === s.key ? 'default' : 'outline'} className="h-8" aria-pressed={player.status === s.key} title={s.hint} onClick={() => player.status !== s.key && setStatus(s.key)}>{s.label}</Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{STATUSES.find((s) => s.key === player.status)?.hint}</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Card>
            <CardContent className="space-y-3 p-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {facts.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="min-w-0"><dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</dt><dd className="text-sm">{v}</dd></div>
                ))}
              </dl>
              {ageNote && <p className="flex gap-2 rounded-md border border-accent/50 bg-accent/10 p-2 text-sm"><Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{ageNote}</p>}

              {notes ? (
                <div className="space-y-2">
                  <div><Label htmlFor="sp-summary">{tx('Resumo')}</Label><Textarea id="sp-summary" rows={4} maxLength={4000} value={notes.summary} onChange={(e) => setNotes({ ...notes, summary: e.target.value })} placeholder={tx('O que o distingue, onde encaixa na nossa equipa, o que falta ver.')} /></div>
                  <div><Label htmlFor="sp-links">{tx('Vídeos (uma ligação por linha)')}</Label><Textarea id="sp-links" rows={2} value={notes.links} onChange={(e) => setNotes({ ...notes, links: e.target.value })} placeholder="https://…" /></div>
                  <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setNotes(null)}>{tx('Cancelar')}</Button><Button onClick={saveNotes}>{tx('Guardar')}</Button></div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tx('Resumo')}</p><p className="whitespace-pre-line text-sm">{player.summary || '—'}</p></div>
                  {player.video_links.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {player.video_links.map((l, i) => <a key={l} href={l} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline"><ExternalLink className="h-3.5 w-3.5" />{tx('Vídeo')}{' '}{i + 1}</a>)}
                    </div>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setNotes({ summary: player.summary ?? '', links: player.video_links.join('\n') })}><Pencil className="mr-1.5 h-4 w-4" />{tx('Resumo e vídeos')}</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-1 p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx('Avaliação média')}</p>
                <p className="font-mono text-2xl font-bold tabular-nums">{num(overall)}<span className="text-sm font-normal text-muted-foreground"> / 5</span></p>
              </div>
              <ScoutRadar values={averages} className="mx-auto w-full max-w-[17rem]" />
              {history.length >= 2 && <><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx('Evolução')}</p><ScoutEvolution history={history} className="w-full" /></>}
              {observations.length === 0 && <p className="text-center text-xs text-muted-foreground">{tx('O radar aparece com a primeira observação.')}</p>}
            </CardContent>
          </Card>
        </div>

        {/* observations */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide">{tx('Observações (')}{observations.length})</h2>
          <Button size="sm" onClick={() => setObs(blankObs())}><Plus className="mr-1.5 h-4 w-4" />{tx('Observação')}</Button>
        </div>
        {observations.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><Eye className="mx-auto mb-2 h-8 w-8 opacity-50" />{tx('Ainda sem observações. Registe o que viu e dê notas de 1 a 5.')}</CardContent></Card>
        ) : observations.map((o) => (
          <Card key={o.id}>
            <CardContent className="space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm tabular-nums">{day(o.observed_on)}</span>
                {o.context && <span className="text-sm font-medium">{o.context}</span>}
                {o.position_played && <Badge variant="outline">{o.position_played}</Badge>}
                {o.minutes_seen != null && <span className="text-xs text-muted-foreground">{o.minutes_seen}{tx('\' vistos')}</span>}
                {recommendationLabel(o.recommendation) && <Badge variant="secondary">{recommendationLabel(o.recommendation)}</Badge>}
                <span className="ml-auto flex items-center gap-1">
                  <span className="mr-1 font-mono text-sm font-bold tabular-nums" title={tx('Nota desta observação')}>{num(observationMark(o))}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editObs(o)} aria-label={tx('Editar observação')}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeObs(o)} aria-label={tx('Apagar observação')}><Trash2 className="h-3.5 w-3.5" /></Button>
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {AREAS.map((a) => <span key={a.key}><span className="text-muted-foreground">{a.label}</span> <span className="font-mono font-bold">{num(o[a.key])}</span></span>)}
              </div>
              {(o.strengths || o.weaknesses) && (
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  {o.strengths && <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tx('Fortes')}</p><p className="whitespace-pre-line">{o.strengths}</p></div>}
                  {o.weaknesses && <div><p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tx('A melhorar')}</p><p className="whitespace-pre-line">{o.weaknesses}</p></div>}
                </div>
              )}
              {o.notes && <p className="whitespace-pre-line text-sm">{o.notes}</p>}
            </CardContent>
          </Card>
        ))}

        {/* contact: apart, with permission */}
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Lock className="h-3.5 w-3.5" />{tx('Contacto')}</p>
            {contactDraft ? (
              <div className="space-y-2">
                <div><Label htmlFor="sc-contact">{minor ? tx('Contacto do encarregado de educação') : tx('Contacto')}</Label><Input id="sc-contact" maxLength={300} value={contactDraft.contact} onChange={(e) => setContactDraft({ ...contactDraft, contact: e.target.value })} placeholder={tx('Nome e telefone ou email')} /></div>
                <div><Label htmlFor="sc-note">{tx('Como foi dado')}</Label><Input id="sc-note" maxLength={300} value={contactDraft.note} onChange={(e) => setContactDraft({ ...contactDraft, note: e.target.value })} placeholder={tx('Ex.: dado pelo pai no fim do jogo de 12/10')} /></div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 h-4 w-4" checked={contactDraft.allowed} onChange={(e) => setContactDraft({ ...contactDraft, allowed: e.target.checked })} />
                  <span>{minor ? tx('O encarregado de educação deu este contacto e sabe que fica guardado para o clube o contactar.') : tx('O jogador (ou o encarregado, se for menor) deu este contacto e sabe que fica guardado.')}</span>
                </label>
                <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setContactDraft(null)}>{tx('Cancelar')}</Button><Button onClick={saveContact} disabled={!contactDraft.allowed || !contactDraft.contact.trim()}>{tx('Guardar contacto')}</Button></div>
              </div>
            ) : contact ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">{contact.contact}</p>
                {contact.permission_note && <p className="text-xs text-muted-foreground">{contact.permission_note}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setContactDraft({ contact: contact.contact, note: contact.permission_note ?? '', allowed: true })}><Pencil className="mr-1.5 h-4 w-4" />{tx('Editar')}</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={removeContact}><Trash2 className="mr-1.5 h-4 w-4" />{tx('Apagar contacto')}</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{tx('Sem contacto visível. Um contacto só se guarda com autorização de quem o deu, e só o vê quem o registou, quem criou a ficha e o administrador do clube.')}</p>
                <Button size="sm" variant="outline" onClick={() => setContactDraft({ contact: '', note: '', allowed: false })}><Plus className="mr-1.5 h-4 w-4" />{tx('Registar contacto')}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ScoutPlayerFormDialog open={editOpen} onOpenChange={setEditOpen} initial={player} onSubmit={saveHeader} />

      <Dialog open={!!obs} onOpenChange={(o) => !o && setObs(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{obs?.id ? tx('Editar observação') : tx('Nova observação')}</DialogTitle></DialogHeader>
          {obs && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div><Label htmlFor="so-date">{tx('Data')}</Label><Input id="so-date" type="date" value={obs.observed_on} onChange={(e) => setObs({ ...obs, observed_on: e.target.value })} /></div>
                <div className="sm:col-span-3"><Label htmlFor="so-ctx">{tx('Jogo ou treino')}</Label><Input id="so-ctx" maxLength={160} value={obs.context} onChange={(e) => setObs({ ...obs, context: e.target.value })} placeholder={tx('Ex.: Rival FC vs Outro, distrital')} /></div>
                <div className="sm:col-span-2"><Label htmlFor="so-pos">{tx('Posição em que jogou')}</Label><Input id="so-pos" maxLength={20} value={obs.position_played} onChange={(e) => setObs({ ...obs, position_played: e.target.value })} /></div>
                <div className="sm:col-span-2"><Label htmlFor="so-min">{tx('Minutos vistos')}</Label><Input id="so-min" inputMode="numeric" maxLength={3} value={obs.minutes_seen} onChange={(e) => setObs({ ...obs, minutes_seen: e.target.value })} /></div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">{tx('Notas de 1 a 5')}{' '}<span className="font-normal text-muted-foreground">{tx('(deixe em branco o que não deu para ver)')}</span></p>
                {AREAS.map((a) => (
                  <div key={a.key} className="flex flex-wrap items-center gap-2">
                    <div className="w-40"><p className="text-sm font-medium">{a.label}</p><p className="text-xs text-muted-foreground">{a.hint}</p></div>
                    <div className="flex gap-1" role="group" aria-label={a.label}>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <Button key={v} type="button" size="sm" variant={obs.marks[a.key] === v ? 'default' : 'outline'} className="h-9 w-9 px-0 font-mono" aria-pressed={obs.marks[a.key] === v} aria-label={`${a.label}: ${v}, ${MARK_LABELS[v]}`} title={MARK_LABELS[v]}
                          onClick={() => setObs({ ...obs, marks: { ...obs.marks, [a.key]: obs.marks[a.key] === v ? null : v } })}>{v}</Button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">{obs.marks[a.key] ? MARK_LABELS[obs.marks[a.key]!] : ''}</span>
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="so-strong">{tx('Pontos fortes')}</Label><Textarea id="so-strong" rows={3} maxLength={2000} value={obs.strengths} onChange={(e) => setObs({ ...obs, strengths: e.target.value })} /></div>
                <div><Label htmlFor="so-weak">{tx('A melhorar')}</Label><Textarea id="so-weak" rows={3} maxLength={2000} value={obs.weaknesses} onChange={(e) => setObs({ ...obs, weaknesses: e.target.value })} /></div>
              </div>
              <div><Label htmlFor="so-notes">{tx('Notas')}</Label><Textarea id="so-notes" rows={3} maxLength={4000} value={obs.notes} onChange={(e) => setObs({ ...obs, notes: e.target.value })} /></div>
              <div className="max-w-xs">
                <Label>{tx('Recomendação')}</Label>
                <Select value={obs.recommendation} onValueChange={(v) => setObs({ ...obs, recommendation: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_REC}>{tx('Sem recomendação')}</SelectItem>
                    {RECOMMENDATIONS.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setObs(null)}>{tx('Cancelar')}</Button><Button onClick={saveObs} disabled={!obs?.observed_on}>{tx('Guardar observação')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
