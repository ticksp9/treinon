/**
 * Age groups by birth year: set the years of each team and place the players that
 * already exist (e.g. everyone born in 2013 or 2014 → Sub-13) in this season.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { teamsForYear, type YearTeam } from '@/lib/player-import';
import { BirthYearRules } from './BirthYearRules';

interface Props { open: boolean; onClose: () => void; teams: YearTeam[]; seasonId: string | null; seasonStartYear: number }

export function BirthYearDialog({ open, onClose, teams: teamsIn, seasonId, seasonStartYear }: Props) {
  const qc = useQueryClient();
  const [teams, setTeams] = useState<YearTeam[]>(teamsIn);
  const [busy, setBusy] = useState(false);

  const distribute = async () => {
    if (!seasonId) return toast.error('Escolha primeiro a época (no topo do ecrã).');
    setBusy(true);
    try {
      const [{ data: players }, { data: enrolled }] = await Promise.all([
        supabase.from('players').select('id, birth_date').not('birth_date', 'is', null).eq('is_active', true),
        supabase.from('season_player_enrollments' as never).select('player_id, team_id, status').eq('season_id', seasonId),
      ]);
      const has = new Set(((enrolled ?? []) as { player_id: string; team_id: string; status: string }[])
        .filter((e) => e.status === 'active').map((e) => `${e.player_id}|${e.team_id}`));
      const rows: { season_id: string; player_id: string; team_id: string; status: string; joined_at: string }[] = [];
      for (const p of (players ?? []) as { id: string; birth_date: string }[]) {
        for (const t of teamsForYear(Number(p.birth_date.slice(0, 4)), teams)) {
          if (!has.has(`${p.id}|${t}`)) rows.push({ season_id: seasonId, player_id: p.id, team_id: t, status: 'active', joined_at: new Date().toISOString().slice(0, 10) });
        }
      }
      if (rows.length === 0) { toast.info('Todos os jogadores com data de nascimento já estão nas equipas certas.'); return; }
      for (const t of [...new Set(rows.map((r) => r.team_id))]) {
        await supabase.from('season_team_memberships' as never).upsert({ season_id: seasonId, team_id: t } as never, { onConflict: 'season_id,team_id' });
      }
      // a previously removed ("left") enrollment is reactivated instead of duplicated
      const { data: left } = await supabase.from('season_player_enrollments' as never).select('id, player_id, team_id').eq('season_id', seasonId).eq('status', 'left');
      const leftMap = new Map(((left ?? []) as { id: string; player_id: string; team_id: string }[]).map((l) => [`${l.player_id}|${l.team_id}`, l.id]));
      const reactivate = rows.filter((r) => leftMap.has(`${r.player_id}|${r.team_id}`)).map((r) => leftMap.get(`${r.player_id}|${r.team_id}`)!);
      const fresh = rows.filter((r) => !leftMap.has(`${r.player_id}|${r.team_id}`));
      if (reactivate.length) await supabase.from('season_player_enrollments' as never).update({ status: 'active', left_at: null } as never).in('id', reactivate);
      if (fresh.length) {
        const { error } = await supabase.from('season_player_enrollments' as never).insert(fresh as never);
        if (error) throw error;
      }
      toast.success(`${rows.length} colocações feitas nas equipas pelo ano de nascimento.`);
      qc.invalidateQueries({ queryKey: ['season-enrollments'] });
      qc.invalidateQueries({ queryKey: ['team-players'] });
      qc.invalidateQueries({ queryKey: ['season-enrollment-counts'] });
      qc.invalidateQueries({ queryKey: ['players'] });
    } catch (e) {
      toast.error('Não foi possível distribuir: ' + (e as Error).message);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Escalões por ano de nascimento</DialogTitle>
          <DialogDescription>Defina os anos de cada equipa. Depois coloque automaticamente nas equipas os jogadores que já existem.</DialogDescription>
        </DialogHeader>
        <BirthYearRules teams={teams} seasonStartYear={seasonStartYear} onChange={setTeams} />
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground">Só junta jogadores às equipas; ninguém é retirado de onde já está.</p>
          <Button onClick={distribute} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}Colocar jogadores nas equipas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
