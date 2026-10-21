/**
 * The game plan of one match: a few key ideas, the opponent's key players and the schemes
 * worth showing the players. Read in the match preparation and at half-time; written here
 * or from the opponent's sheet.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ClipboardList, FileText, Pencil, Plus, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { BoardPreview } from '@/components/board/BoardPreview';
import { normalizeBoard } from '@/lib/tactic-board';
import {
  MAX_KEY_POINTS, cleanKeyPoints, momentLabel, plannedSchemes, sheetForMatch, sortSquad,
  type MatchPlan, type Opponent, type OpponentPlayer, type OpponentScheme,
} from '@/lib/opponent-scouting';
import { tx } from '@/lib/i18n/ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types

interface Props {
  matchId: string;
  opponentName: string;
  sportType?: string | null;
  /** shown above the card (e.g. "Próximo jogo · 14/10") */
  heading?: string;
  /** at half-time an empty plan is just noise */
  hideWhenEmpty?: boolean;
  className?: string;
}

export function MatchPlanCard({ matchId, opponentName, sportType, heading, hideWhenEmpty, className }: Props) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<{ points: string[]; notes: string; schemeIds: string[] } | null>(null);
  const [shown, setShown] = useState<{ scheme: OpponentScheme; step: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: plan = null } = useQuery({
    queryKey: ['match-plan', matchId],
    queryFn: async () => ((await db.from('match_plans').select('*').eq('match_id', matchId).maybeSingle()).data ?? null) as MatchPlan | null,
  });
  const { data: sheets = [] } = useQuery({
    queryKey: ['scout-sheets-brief'],
    staleTime: 60_000,
    queryFn: async () => ((await db.from('scout_opponents').select('id, name, sport_type, usual_formation, strengths, weaknesses').order('name')).data ?? []) as Pick<Opponent, 'id' | 'name' | 'sport_type' | 'usual_formation' | 'strengths' | 'weaknesses'>[],
  });
  const sheet = useMemo(() => sheetForMatch(sheets, opponentName, plan?.opponent_id, sportType), [sheets, opponentName, plan?.opponent_id, sportType]);
  const { data: schemes = [] } = useQuery({
    queryKey: ['scout-schemes', sheet?.id],
    enabled: !!sheet,
    queryFn: async () => ((await db.from('scout_opponent_schemes').select('*').eq('opponent_id', sheet!.id).order('created_at')).data ?? []) as OpponentScheme[],
  });
  const { data: players = [] } = useQuery({
    queryKey: ['scout-players', sheet?.id],
    enabled: !!sheet,
    queryFn: async () => ((await db.from('scout_opponent_players').select('*').eq('opponent_id', sheet!.id)).data ?? []) as OpponentPlayer[],
  });

  const keyPlayers = useMemo(() => sortSquad(players).filter((p) => p.is_key), [players]);
  const picked = useMemo(() => plannedSchemes(schemes, plan?.scheme_ids ?? []), [schemes, plan?.scheme_ids]);
  const points = plan?.key_points ?? [];
  const empty = points.length === 0 && !plan?.notes && picked.length === 0;

  const openEdit = () => setEdit({ points: points.length ? [...points] : [''], notes: plan?.notes ?? '', schemeIds: picked.map((s) => s.id) });
  const save = async () => {
    if (!edit) return;
    setBusy(true);
    const row = { match_id: matchId, opponent_id: sheet?.id ?? null, key_points: cleanKeyPoints(edit.points), notes: edit.notes.trim() || null, scheme_ids: edit.schemeIds };
    const { error } = await db.from('match_plans').upsert(row, { onConflict: 'match_id' });
    setBusy(false);
    if (error) return toast.error(tx('Não foi possível guardar o plano: ') + error.message);
    setEdit(null);
    qc.invalidateQueries({ queryKey: ['match-plan', matchId] });
    toast.success(tx('Plano de jogo guardado.'));
  };
  const toggleScheme = (id: string) => setEdit((e) => e && { ...e, schemeIds: e.schemeIds.includes(id) ? e.schemeIds.filter((x) => x !== id) : [...e.schemeIds, id] });

  if (hideWhenEmpty && empty && keyPlayers.length === 0 && !edit) return null;

  const shownBoard = shown ? normalizeBoard(shown.scheme.board_data, sheet?.sport_type ?? sportType ?? 'football_11') : null;

  return (
    <Card className={className}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{tx('Plano de jogo')}{heading ? ` · ${heading}` : ''}</p>
            <p className="truncate text-xs text-muted-foreground">vs {opponentName}{sheet?.usual_formation ? tx(' · costumam jogar em {{v0}}', { v0: sheet.usual_formation }) : ''}</p>
          </div>
          {sheet && <Button size="sm" variant="ghost" className="h-8" asChild><Link to={`/scouting/adversarios/${sheet.id}`}>{tx('Ficha')}</Link></Button>}
          {sheet && <Button size="sm" variant="ghost" className="h-8" asChild><Link to={`/scouting/adversarios/${sheet.id}/relatorio?jogo=${matchId}`} target="_blank"><FileText className="mr-1 h-3.5 w-3.5" />{tx('Relatório')}</Link></Button>}
          <Button size="sm" variant="outline" className="h-8" onClick={openEdit}><Pencil className="mr-1 h-3.5 w-3.5" />{empty ? tx('Escrever plano') : tx('Editar')}</Button>
        </div>

        {empty && (
          <p className="text-sm text-muted-foreground">
            {sheet ? tx('Ainda sem plano. Escreva três ou quatro ideias-chave e escolha os esquemas a mostrar aos jogadores.')
              : <>{tx('Ainda não há ficha de «')}{opponentName}{tx('». Pode escrever o plano já, ou')}{' '}<Link className="font-medium text-primary underline-offset-2 hover:underline" to="/scouting">{tx('criar a ficha no Scouting')}</Link> {tx('para juntar esquemas e jogadores-chave.')}</>}
          </p>
        )}

        {points.length > 0 && (
          <ol className="space-y-1.5">
            {points.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{i + 1}</span>
                <span className="font-medium leading-snug">{p}</span>
              </li>
            ))}
          </ol>
        )}
        {plan?.notes && <p className="whitespace-pre-line text-sm text-muted-foreground">{plan.notes}</p>}

        {keyPlayers.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx('Jogadores-chave deles')}</p>
            <div className="flex flex-wrap gap-1.5">
              {keyPlayers.map((p) => (
                <span key={p.id} className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs" title={p.notes ?? undefined}>
                  <Star className="h-3 w-3 shrink-0 fill-accent text-accent" />
                  <span className="font-mono font-bold">{p.shirt_number || '–'}</span>
                  <span className="font-medium">{p.name}</span>
                  {p.notes && <span className="truncate text-muted-foreground">— {p.notes}</span>}
                </span>
              ))}
            </div>
          </div>
        )}

        {sheet && (sheet.strengths || sheet.weaknesses) && (
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            {sheet.strengths && <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx('Fortes')}</p><p className="whitespace-pre-line">{sheet.strengths}</p></div>}
            {sheet.weaknesses && <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx('Fracos')}</p><p className="whitespace-pre-line">{sheet.weaknesses}</p></div>}
          </div>
        )}

        {picked.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {picked.map((s) => (
              <button key={s.id} type="button" className="overflow-hidden rounded-md border text-left transition-colors hover:border-primary" onClick={() => setShown({ scheme: s, step: 0 })}>
                <BoardPreview state={normalizeBoard(s.board_data, sheet?.sport_type ?? 'football_11')} className="rounded-none" />
                <span className="block px-2 py-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{momentLabel(s.moment)}</span>
                  <span className="block truncate text-xs font-medium">{s.title}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </CardContent>

      {/* one scheme, big, for the team talk */}
      <Dialog open={!!shown} onOpenChange={(o) => !o && setShown(null)}>
        <DialogContent className="max-w-4xl">
          {shown && shownBoard && (
            <>
              <DialogHeader><DialogTitle>{momentLabel(shown.scheme.moment)} · {shown.scheme.title}</DialogTitle></DialogHeader>
              <BoardPreview state={shownBoard} step={shown.step} />
              {shownBoard.steps.length > 0 && (
                <div className="flex items-center justify-center gap-2">
                  <Button size="sm" variant="outline" disabled={shown.step === 0} onClick={() => setShown({ ...shown, step: shown.step - 1 })} aria-label={tx('Passo anterior')}><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="font-mono text-sm tabular-nums">{tx('Passo')}{' '}{shown.step + 1} de {shownBoard.steps.length + 1}</span>
                  <Button size="sm" variant="outline" disabled={shown.step >= shownBoard.steps.length} onClick={() => setShown({ ...shown, step: shown.step + 1 })} aria-label={tx('Passo seguinte')}><ChevronRight className="h-4 w-4" /></Button>
                </div>
              )}
              {shown.scheme.notes && <p className="whitespace-pre-line text-sm">{shown.scheme.notes}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{tx('Plano de jogo · vs')}{' '}{opponentName}</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{tx('Ideias-chave (as que os jogadores têm de levar para o campo)')}</Label>
                {edit.points.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 text-center font-mono text-sm text-muted-foreground">{i + 1}</span>
                    <Input maxLength={200} value={p} placeholder={i === 0 ? tx('Ex.: Pressionar o central esquerdo na saída de bola') : ''} onChange={(e) => setEdit({ ...edit, points: edit.points.map((x, k) => (k === i ? e.target.value : x)) })} aria-label={tx('Ideia {{v0}}', { v0: i + 1 })} />
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEdit({ ...edit, points: edit.points.filter((_, k) => k !== i) })} aria-label={tx('Tirar a ideia {{v0}}', { v0: i + 1 })}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                {edit.points.length < MAX_KEY_POINTS && <Button size="sm" variant="outline" onClick={() => setEdit({ ...edit, points: [...edit.points, ''] })}><Plus className="mr-1 h-3.5 w-3.5" />{tx('Ideia')}</Button>}
              </div>
              <div>
                <Label htmlFor="plan-notes">{tx('Notas')}</Label>
                <Textarea id="plan-notes" rows={3} maxLength={4000} value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} placeholder={tx('Marcações nas bolas paradas, quem bate, o que muda se estivermos a perder…')} />
              </div>
              <div className="space-y-2">
                <Label>{tx('Esquemas a mostrar aos jogadores')}</Label>
                {!sheet ? (
                  <p className="text-sm text-muted-foreground">{tx('Sem ficha deste adversário, não há esquemas para escolher.')}</p>
                ) : schemes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{tx('A ficha ainda não tem esquemas. Desenhe-os em Scouting →')}{' '}{sheet.name}.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {schemes.map((s) => {
                      const on = edit.schemeIds.includes(s.id);
                      return (
                        <button key={s.id} type="button" aria-pressed={on} onClick={() => toggleScheme(s.id)} className={cn('overflow-hidden rounded-md border-2 text-left', on ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100')}>
                          <BoardPreview state={normalizeBoard(s.board_data, sheet.sport_type)} className="rounded-none" />
                          <span className="block px-2 py-1">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{momentLabel(s.moment)}</span>
                            <span className="block truncate text-xs font-medium">{on ? '✓ ' : ''}{s.title}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>{tx('Cancelar')}</Button><Button onClick={save} disabled={busy}>{tx('Guardar plano')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
