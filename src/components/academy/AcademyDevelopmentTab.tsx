import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useAcademy } from '@/hooks/useAcademy';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { computeGoalSummary } from '@/hooks/useAcademy';

const PLAN_STATUS: Record<string, string> = {
  draft: 'Rascunho',
  active: 'Ativo',
  under_review: 'Em Revisão',
  completed: 'Concluído',
  archived: 'Arquivado',
};

export function AcademyDevelopmentTab() {
  const { developmentPlans, clubId } = useAcademy();

  const plans = developmentPlans.data || [];

  const goals = useQuery({
    queryKey: ['academy-dev-goals', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const planIds = plans.map(p => p.id);
      if (planIds.length === 0) return [];
      const { data, error } = await supabase
        .from('academy_development_goals')
        .select('*')
        .in('plan_id', planIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId && plans.length > 0,
  });

  const allGoals = goals.data || [];
  const summary = computeGoalSummary(allGoals);

  return (
    <div className="space-y-4">
      {/* Goal Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard label="Total Objetivos" value={summary.total} />
        <SummaryCard label="Abertos" value={summary.open} />
        <SummaryCard label="Em Progresso" value={summary.in_progress} />
        <SummaryCard label="Atingidos" value={summary.achieved} />
        <SummaryCard label="Progresso Médio" value={`${summary.avgProgress.toFixed(0)}%`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planos de Desenvolvimento Individual</CardTitle>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum PDI criado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jogador ID</TableHead>
                  <TableHead>Época</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Objetivos</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map(p => {
                  const planGoals = allGoals.filter(g => g.plan_id === p.id);
                  const avgProgress = planGoals.length > 0
                    ? planGoals.reduce((s, g) => s + (g.progress_pct || 0), 0) / planGoals.length
                    : 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.player_id?.slice(0, 8)}…</TableCell>
                      <TableCell>{p.season || '—'}</TableCell>
                      <TableCell>v{p.version_no}</TableCell>
                      <TableCell>{planGoals.length}</TableCell>
                      <TableCell className="w-32">
                        <Progress value={avgProgress} className="h-2" />
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'active' ? 'default' : 'outline'}>
                          {PLAN_STATUS[p.status] || p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
