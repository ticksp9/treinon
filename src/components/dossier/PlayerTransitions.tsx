/**
 * A player's transition history (FPF certification, criterion 4.3): the times they trained or played
 * with another team (usually the age group above), trials and promotions, with how it went.
 * On the player's «Plano Individual»; only the coaching staff of both teams sees it.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { tx } from '@/lib/i18n/ui';
import { nextAgeTeam } from '@/lib/guidelines';
import { TRANSITION_KINDS, transitionKindLabel, transitionTarget, type PlayerTransition, type TransitionKind } from '@/lib/transitions';

const db = supabase as any; // newer than the generated types
const OTHER = 'other';
const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** The teams of a club (or the coach's own teams, without a club). */
export function useClubTeams(clubId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['club-teams-list', clubId, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<{ id: string; name: string; category: string | null }[]> => {
      if (clubId) return ((await db.rpc('get_club_teams', { _club: clubId })).data ?? []) as { id: string; name: string; category: string | null }[];
      return ((await supabase.from('teams').select('id, name, category').order('name')).data ?? []) as { id: string; name: string; category: string | null }[];
    },
  });
}

export function usePlayerTransitions(playerId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['player-transitions', playerId],
    enabled: !!user && !!playerId,
    queryFn: async (): Promise<PlayerTransition[]> =>
      ((await db.from('player_transitions').select('*').eq('player_id', playerId).order('event_date', { ascending: false })).data ?? []) as PlayerTransition[],
  });
}

export function PlayerTransitionsCard({ playerId, teamId, clubId }: { playerId: string; teamId: string | null; clubId: string | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: isStaff } = useQuery({
    queryKey: ['can-coach-team', user?.id, teamId],
    enabled: !!user && !!teamId,
    queryFn: async () => (await db.rpc('can_coach_team', { _user: user!.id, _team: teamId })).data === true,
  });
  const { data: list = [] } = usePlayerTransitions(playerId);
  const { data: teams = [] } = useClubTeams(clubId);
  const [editing, setEditing] = useState<PlayerTransition | 'new' | null>(null);
  if (!teamId || !isStaff) return null;
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name;

  const remove = async (t: PlayerTransition) => {
    if (!window.confirm(tx('Apagar este registo?'))) return;
    const { error } = await db.from('player_transitions').delete().eq('id', t.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ['player-transitions'] });
    qc.invalidateQueries({ queryKey: ['dossier'] });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><ArrowUpRight className="h-4 w-4" />{tx('Transição: treinos e jogos noutro escalão')}</CardTitle>
        <CardDescription>{tx('Quando o jogador treina ou joga com outra equipa (normalmente o escalão acima) e como correu. É o histórico do plano de transição que a FPF pede.')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {list.length === 0 && <p className="text-sm text-muted-foreground">{tx('Sem registos.')}</p>}
        {list.map((t) => (
          <div key={t.id} className="flex items-start gap-2 rounded-md border p-2.5">
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                {transitionTarget(t, teamName)}
                <Badge variant="outline" className="text-[10px]">{transitionKindLabel(t.kind)}</Badge>
                <span className="font-mono text-xs font-normal text-muted-foreground">{fmt(t.event_date)}</span>
              </p>
              {t.note && <p className="text-xs text-muted-foreground">{t.note}</p>}
              {t.evaluation
                ? <p className="text-xs">{tx('Como correu')}: {t.evaluation}</p>
                : <Badge variant="outline" className="border-amber-500 text-[10px] text-amber-700">{tx('Falta dizer como correu')}</Badge>}
            </div>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setEditing(t)} aria-label={tx('Editar')}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive" onClick={() => remove(t)} aria-label={tx('Apagar')}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => setEditing('new')}><Plus className="mr-1 h-4 w-4" />{tx('Registar')}</Button>
      </CardContent>
      {editing && (
        <TransitionDialog playerId={playerId} teamId={teamId} teams={teams.filter((t) => t.id !== teamId)}
          suggested={nextAgeTeam(teams.filter((t) => t.id !== teamId), teams.find((t) => t.id === teamId)?.category ?? null)?.id ?? null}
          editing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
    </Card>
  );
}

function TransitionDialog({ playerId, teamId, teams, suggested, editing, onClose }: {
  playerId: string; teamId: string; teams: { id: string; name: string; category: string | null }[]; suggested: string | null; editing: PlayerTransition | null; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<TransitionKind>(editing?.kind ?? 'training');
  const [target, setTarget] = useState<string>(editing ? (editing.to_team_id ?? OTHER) : (suggested ?? teams[0]?.id ?? OTHER));
  const [otherName, setOtherName] = useState(editing?.to_team_name ?? '');
  const [date, setDate] = useState(editing?.event_date ?? new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(editing?.note ?? '');
  const [evaluation, setEvaluation] = useState(editing?.evaluation ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const toTeam = target === OTHER ? null : target;
    const name = target === OTHER ? otherName.trim().slice(0, 120) : null;
    if (!toTeam && !name) { toast.error(tx('Escolha a equipa ou escreva o nome.')); return; }
    if (!date) { toast.error(tx('Escolha a data.')); return; }
    setSaving(true);
    try {
      const row = { kind, to_team_id: toTeam, to_team_name: name, event_date: date, note: note.trim().slice(0, 2000) || null, evaluation: evaluation.trim().slice(0, 2000) || null };
      const { error } = editing
        ? await db.from('player_transitions').update(row).eq('id', editing.id)
        : await db.from('player_transitions').insert({ ...row, player_id: playerId, team_id: teamId });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['player-transitions'] });
      qc.invalidateQueries({ queryKey: ['club-transitions'] });
      qc.invalidateQueries({ queryKey: ['dossier'] });
      toast.success(tx('Registo guardado.'));
      onClose();
    } catch (e) {
      toast.error(tx('Não foi possível guardar: {{msg}}', { msg: (e as Error).message }));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tx('Treino ou jogo noutro escalão')}</DialogTitle>
          <DialogDescription>{tx('Fica no histórico do jogador e no dossier das duas equipas.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{tx('O que foi')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {TRANSITION_KINDS.map((k) => (
                <Button key={k.value} type="button" size="sm" variant={kind === k.value ? 'default' : 'outline'} className="h-8" onClick={() => setKind(k.value)}>{k.label}</Button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{tx('Com que equipa')}</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger aria-label={tx('Com que equipa')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {teams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  <SelectItem value={OTHER}>{tx('Outra (escrever)')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tr-date">{tx('Data')}</Label>
              <Input id="tr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          {target === OTHER && (
            <div className="space-y-1.5">
              <Label htmlFor="tr-other">{tx('Nome da equipa')}</Label>
              <Input id="tr-other" maxLength={120} value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder={tx('Ex.: Sub-15 B')} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="tr-note">{tx('Porquê / o que fez')}</Label>
            <Textarea id="tr-note" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tx('Ex.: destaque no escalão; treinou 2 vezes com os Sub-15')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tr-eval">{tx('Como correu')}</Label>
            <Textarea id="tr-eval" rows={2} maxLength={2000} value={evaluation} onChange={(e) => setEvaluation(e.target.value)} placeholder={tx('Ex.: acompanhou bem o ritmo; precisa de ganhar força nos duelos')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tx('Cancelar')}</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tx('Guardar')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
