/**
 * Objectives with indicator, target, deadline and evaluation (FPF dossier: "objetivos formativos e
 * respetivo controlo"). The same list for the team (Treinos → Planeamento) and for one player
 * (Plano Individual). Only the team's coaching staff sees it.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Loader2, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { tx } from '@/lib/i18n/ui';
import {
  cleanObjective, emptyObjective, OBJECTIVE_STATUS, objectiveOverdue, objectiveStats,
  type DossierObjective, type ObjectiveDraft,
} from '@/lib/objectives';

const db = supabase as any; // newer than the generated types

/** The team's objectives (playerId null) or one player's, in the season. */
export function useObjectives(teamId: string | null, seasonId: string | null, playerId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dossier-objectives', teamId, seasonId, playerId],
    enabled: !!user && !!teamId,
    queryFn: async (): Promise<DossierObjective[]> => {
      let q = db.from('dossier_objectives').select('*').eq('team_id', teamId);
      q = playerId ? q.eq('player_id', playerId) : q.is('player_id', null);
      if (seasonId) q = q.or(`season_id.eq.${seasonId},season_id.is.null`);
      const { data, error } = await q.order('sort_order').order('created_at');
      if (error) throw error;
      return (data ?? []) as DossierObjective[];
    },
  });
}

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

export function ObjectivesEditor({ teamId, seasonId, playerId = null, compact = false }: {
  teamId: string; seasonId: string | null; playerId?: string | null; compact?: boolean;
}) {
  const qc = useQueryClient();
  const { data: list = [], isLoading } = useObjectives(teamId, seasonId, playerId);
  const [editing, setEditing] = useState<DossierObjective | 'new' | null>(null);
  const stats = objectiveStats(list);

  const remove = async (o: DossierObjective) => {
    if (!window.confirm(tx('Apagar "{{v0}}"?', { v0: o.objective }))) return;
    const { error } = await db.from('dossier_objectives').delete().eq('id', o.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ['dossier-objectives'] });
    qc.invalidateQueries({ queryKey: ['dossier'] });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">{tx('A carregar…')}</p>;
  return (
    <div className="space-y-2">
      {list.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {playerId ? tx('Ainda sem objetivos para este jogador.') : tx('Ainda sem objetivos com meta. Ex.: «Sair a jogar desde o guarda-redes» · indicador «saídas curtas com sucesso» · meta «6 em 10» · até dezembro.')}
        </p>
      )}
      {list.length > 0 && !compact && (
        <p className="text-xs text-muted-foreground">
          {tx('{{a}} de {{b}} avaliados · {{c}} atingidos', { a: stats.evaluated, b: stats.total, c: stats.achieved })}
        </p>
      )}
      {list.map((o) => {
        const st = OBJECTIVE_STATUS.find((s) => s.value === o.status) ?? OBJECTIVE_STATUS[0];
        const late = objectiveOverdue(o);
        return (
          <div key={o.id} className="flex items-start gap-2 rounded-md border p-2.5">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-semibold">{o.objective}</p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {o.indicator && <span>{tx('Indicador')}: {o.indicator}</span>}
                {o.target && <span>{tx('Meta')}: <b className="text-foreground">{o.target}</b></span>}
                {o.deadline && <span className={cn('flex items-center gap-1', late && 'font-medium text-amber-600')}><CalendarClock className="h-3 w-3" />{fmt(o.deadline)}</span>}
                {o.evaluation && <span>{tx('Avaliação')}: {o.evaluation}</span>}
              </p>
              {o.result && <p className="text-xs">{tx('Resultado')}: {o.result}</p>}
              <div className="flex flex-wrap gap-1 pt-0.5">
                <Badge variant="outline" className={cn('text-[10px]', st.tone)}>{st.label}</Badge>
                {late && <Badge variant="outline" className="border-amber-500 text-[10px] text-amber-700">{tx('Prazo passou: avaliar')}</Badge>}
              </div>
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditing(o)} aria-label={tx('Editar')}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => remove(o)} aria-label={tx('Apagar')}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        );
      })}
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing('new')}><Plus className="mr-1 h-4 w-4" />{tx('Novo objetivo')}</Button>
      {editing && (
        <ObjectiveDialog teamId={teamId} seasonId={seasonId} playerId={playerId} editing={editing === 'new' ? null : editing}
          nextOrder={list.length} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function ObjectiveDialog({ teamId, seasonId, playerId, editing, nextOrder, onClose }: {
  teamId: string; seasonId: string | null; playerId: string | null; editing: DossierObjective | null; nextOrder: number; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [d, setD] = useState<ObjectiveDraft>(() => editing
    ? { objective: editing.objective, indicator: editing.indicator ?? '', target: editing.target ?? '', deadline: editing.deadline ?? '', evaluation: editing.evaluation ?? '', status: editing.status, result: editing.result ?? '' }
    : emptyObjective());
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<ObjectiveDraft>) => setD((x) => ({ ...x, ...patch }));

  const save = async () => {
    const row = cleanObjective(d);
    if (!row.objective) { toast.error(tx('Escreva o objetivo.')); return; }
    setSaving(true);
    try {
      const { error } = editing
        ? await db.from('dossier_objectives').update(row).eq('id', editing.id)
        : await db.from('dossier_objectives').insert({ ...row, team_id: teamId, season_id: seasonId, player_id: playerId, sort_order: nextOrder });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['dossier-objectives'] });
      qc.invalidateQueries({ queryKey: ['dossier'] });
      toast.success(tx('Objetivo guardado.'));
      onClose();
    } catch (e) {
      toast.error(tx('Não foi possível guardar: {{msg}}', { msg: (e as Error).message }));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? tx('Editar objetivo') : tx('Novo objetivo')}</DialogTitle>
          <DialogDescription>{tx('O que se quer, como se vê, a meta e até quando. No fim, a avaliação.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="obj-text">{tx('Objetivo')}</Label>
            <Textarea id="obj-text" rows={2} maxLength={500} value={d.objective} onChange={(e) => set({ objective: e.target.value })}
              placeholder={playerId ? tx('Ex.: Receção orientada com o pé esquerdo') : tx('Ex.: Sair a jogar desde o guarda-redes')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="obj-indicator">{tx('Indicador (como se vê)')}</Label>
              <Input id="obj-indicator" maxLength={500} value={d.indicator ?? ''} onChange={(e) => set({ indicator: e.target.value })} placeholder={tx('Ex.: receções bem orientadas')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obj-target">{tx('Meta')}</Label>
              <Input id="obj-target" maxLength={300} value={d.target ?? ''} onChange={(e) => set({ target: e.target.value })} placeholder={tx('Ex.: 7 em 10')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obj-deadline">{tx('Prazo')}</Label>
              <Input id="obj-deadline" type="date" value={d.deadline ?? ''} onChange={(e) => set({ deadline: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obj-eval">{tx('Como se avalia')}</Label>
              <Input id="obj-eval" maxLength={500} value={d.evaluation ?? ''} onChange={(e) => set({ evaluation: e.target.value })} placeholder={tx('Ex.: observação em 3 treinos')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{tx('Estado')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {OBJECTIVE_STATUS.map((s) => (
                <Button key={s.value} type="button" size="sm" variant={d.status === s.value ? 'default' : 'outline'} className="h-8" onClick={() => set({ status: s.value })}>
                  {s.label}
                </Button>
              ))}
            </div>
          </div>
          {d.status !== 'open' && (
            <div className="space-y-1.5">
              <Label htmlFor="obj-result">{tx('Resultado da avaliação')}</Label>
              <Textarea id="obj-result" rows={2} maxLength={2000} value={d.result ?? ''} onChange={(e) => set({ result: e.target.value })} placeholder={tx('Ex.: 6 em 10 em dezembro; continua no 2.º período')} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tx('Cancelar')}</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tx('Guardar')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** On the player's «Plano Individual»: the player's objectives in the season (coaching staff only). */
export function PlayerObjectivesCard({ playerId, teamId, seasonId }: { playerId: string; teamId: string | null; seasonId: string | null }) {
  const { user } = useAuth();
  const { data: isStaff } = useQuery({
    queryKey: ['can-coach-team', user?.id, teamId],
    enabled: !!user && !!teamId,
    queryFn: async () => (await db.rpc('can_coach_team', { _user: user!.id, _team: teamId })).data === true,
  });
  if (!teamId || !isStaff) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4" />{tx('Objetivos individuais da época')}</CardTitle>
        <CardDescription>{tx('Com indicador, meta e prazo, para a ficha individual do dossier. Só a equipa técnica vê.')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ObjectivesEditor teamId={teamId} seasonId={seasonId} playerId={playerId} />
      </CardContent>
    </Card>
  );
}
