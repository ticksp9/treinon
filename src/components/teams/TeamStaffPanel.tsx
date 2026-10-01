/**
 * Technical staff of a team and what each one may do. Club admins/coordinators (and
 * the team owner) change anyone's permissions; a head coach changes their
 * assistants'. Enforced by the database (set_team_coach_permissions + RLS).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export const TEAM_PERMS = [
  { key: 'matches', label: 'Jogos e jogo ao vivo', help: 'Convocados, onze, jogo ao vivo, relatório' },
  { key: 'trainings', label: 'Treinos e exercícios', help: 'Criar e editar treinos' },
  { key: 'attendance', label: 'Presenças', help: 'Marcar presenças nos treinos' },
  { key: 'players_edit', label: 'Fichas dos jogadores', help: 'Criar e editar dados dos jogadores' },
  { key: 'evaluations', label: 'Avaliações e notas', help: 'Ver e fazer avaliações' },
  { key: 'medical', label: 'Saúde e lesões', help: 'Dados médicos (sensíveis)' },
  { key: 'invites', label: 'Convites', help: 'Convidar pais e atletas' },
] as const;
export type TeamPermKey = (typeof TEAM_PERMS)[number]['key'];

const defaultPerm = (role: string | null, key: TeamPermKey) =>
  (role ?? 'head_coach') === 'head_coach' ? true : ['matches', 'trainings', 'attendance'].includes(key);

interface Row { coach_id: string; role: string | null; permissions: Record<string, boolean> | null; name: string }

/** My effective permissions in a team (for hiding what I can't do). */
export function useTeamPermissions(teamId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['team-perms', teamId, user?.id],
    enabled: !!teamId && !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc('team_perms_for' as never, { _user: user!.id, _team: teamId } as never);
      return (data ?? {}) as Record<TeamPermKey, boolean>;
    },
  });
}

export function TeamStaffPanel({ teamId, canManageAll }: { teamId: string; canManageAll: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: staff = [] } = useQuery({
    queryKey: ['team-staff', teamId],
    queryFn: async () => {
      const { data } = await supabase.from('team_coaches').select('coach_id, role, permissions').eq('team_id', teamId);
      const rows = (data ?? []) as unknown as Omit<Row, 'name'>[];
      if (rows.length === 0) return [] as Row[];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, display_name, username').in('id', rows.map((r) => r.coach_id));
      return rows.map((r) => {
        const p = profiles?.find((x) => x.id === r.coach_id);
        return { ...r, name: p?.display_name || p?.full_name || p?.username || 'Treinador' };
      });
    },
  });

  if (staff.length === 0) return null;
  const myRole = staff.find((s) => s.coach_id === user?.id)?.role;
  const canEdit = (r: Row) => r.coach_id !== user?.id && (canManageAll || (myRole === 'head_coach' && r.role === 'assistant_coach'));

  const toggle = async (r: Row, key: TeamPermKey, value: boolean) => {
    const perms = { ...(r.permissions ?? {}), [key]: value };
    const { error } = await supabase.rpc('set_team_coach_permissions' as never, { _team: teamId, _coach: r.coach_id, _perms: perms } as never);
    if (error) return toast.error('Não foi possível alterar: ' + error.message);
    qc.invalidateQueries({ queryKey: ['team-staff', teamId] });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" />Equipa técnica e permissões</CardTitle>
        <CardDescription>
          {canManageAll ? 'Defina o que cada treinador pode ver e fazer nesta equipa.' : myRole === 'head_coach' ? 'Defina o que os seus adjuntos podem fazer.' : 'As permissões de cada membro da equipa técnica.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {staff.map((r) => (
          <div key={r.coach_id} className="rounded-md border p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="font-medium">{r.name}</span>
              <Badge variant={r.role === 'assistant_coach' ? 'outline' : 'secondary'}>{r.role === 'assistant_coach' ? 'Adjunto' : 'Principal'}</Badge>
              {r.coach_id === user?.id && <span className="text-xs text-muted-foreground">(eu)</span>}
            </div>
            <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {TEAM_PERMS.map((p) => {
                const value = r.permissions?.[p.key] ?? defaultPerm(r.role, p.key);
                return (
                  <label key={p.key} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      {p.label}
                      <span className="block text-xs text-muted-foreground">{p.help}</span>
                    </span>
                    <Switch checked={value} disabled={!canEdit(r)} onCheckedChange={(v) => toggle(r, p.key, v)} />
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
