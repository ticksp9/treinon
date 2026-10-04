/**
 * Coordinators of the club: there can be several, each with an area and the teams
 * they look after (none chosen = all teams). Only the club admin changes this.
 */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Compass, Save, UserMinus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

export interface Coordinator { user_id: string; name: string; area: string | null; team_ids: string[] }

export function useClubCoordinators(clubId: string | null | undefined) {
  return useQuery({
    queryKey: ['club-coordinators', clubId],
    enabled: !!clubId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_club_coordinators' as never, { _club: clubId } as never);
      if (error) throw error;
      return (data ?? []) as unknown as Coordinator[];
    },
  });
}

function CoordinatorRow({ c, clubId, teams }: { c: Coordinator; clubId: string; teams: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [area, setArea] = useState(c.area ?? '');
  const [ids, setIds] = useState<string[]>(c.team_ids ?? []);
  useEffect(() => { setArea(c.area ?? ''); setIds(c.team_ids ?? []); }, [c.area, c.team_ids]);
  const dirty = area !== (c.area ?? '') || ids.slice().sort().join() !== (c.team_ids ?? []).slice().sort().join();

  const save = async () => {
    const { error } = await supabase.rpc('set_coordinator_scope' as never, { _club: clubId, _user: c.user_id, _area: area, _team_ids: ids } as never);
    if (error) return toast.error('Não foi possível guardar: ' + error.message);
    toast.success('Área do coordenador guardada.');
    qc.invalidateQueries({ queryKey: ['club-coordinators'] });
  };
  const remove = async () => {
    if (!window.confirm(`Retirar a coordenação a ${c.name}? Continua no clube.`)) return;
    const { error } = await supabase.rpc('set_staff_role' as never, { _club: clubId, _user: c.user_id, _role: 'staff' } as never);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ['club-coordinators'] });
  };

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{c.name}</span>
        <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Área (ex.: Formação Sub-7 a Sub-13)" className="h-8 max-w-xs flex-1" />
        <Button size="sm" onClick={save} disabled={!dirty}><Save className="mr-1.5 h-4 w-4" />Guardar</Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={remove} aria-label="Retirar coordenação"><UserMinus className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant={ids.length === 0 ? 'default' : 'outline'} className="h-7 px-2 text-xs" onClick={() => setIds([])}>Todas as equipas</Button>
        {teams.map((t) => {
          const on = ids.includes(t.id);
          return (
            <Button key={t.id} size="sm" variant={on ? 'default' : 'outline'} className={cn('h-7 px-2 text-xs')}
              onClick={() => setIds(on ? ids.filter((x) => x !== t.id) : [...ids, t.id])}>
              {t.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

export function CoordinatorsPanel({ clubId, teams }: { clubId: string; teams: { id: string; name: string }[] }) {
  const { data: coordinators = [] } = useClubCoordinators(clubId);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Compass className="h-5 w-5" />Coordenadores</CardTitle>
        <CardDescription>
          Pode ter vários: por exemplo um para a formação e outro para os seniores. Cada um gere o mapa de treinos e jogos,
          os treinadores e os convites das suas equipas. Sem equipas escolhidas, coordena todas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {coordinators.length === 0 && (
          <p className="text-sm text-muted-foreground">Ainda não há coordenadores. Convide com a função "Coordenador", ou use "Tornar coordenador" num treinador da lista abaixo.</p>
        )}
        {coordinators.map((c) => <CoordinatorRow key={c.user_id} c={c} clubId={clubId} teams={teams} />)}
      </CardContent>
    </Card>
  );
}
