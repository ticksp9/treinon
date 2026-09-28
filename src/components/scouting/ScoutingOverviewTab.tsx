import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Users, Eye, Target, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  computeProspectsByPosition,
  computeProspectsByPriority,
  PIPELINE_STAGE_LABELS,
  type ProspectSummary,
} from '@/hooks/useScouting';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

export function ScoutingOverviewTab() {
  const { clubId } = useUserRole();

  const { data: prospects, isLoading: pLoading } = useQuery({
    queryKey: ['scouting-prospects-summary', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('prospect_profiles')
        .select('id, pipeline_status, primary_position, priority, status, birth_quarter, is_late_developer, confidence_score')
        .eq('club_id', clubId)
        .eq('status', 'active');
      if (error) throw error;
      return (data || []) as ProspectSummary[];
    },
    enabled: !!clubId,
  });

  const { data: obsCount } = useQuery({
    queryKey: ['scouting-observations-count', clubId],
    queryFn: async () => {
      if (!clubId) return 0;
      const { count, error } = await supabase
        .from('scouting_observations')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', clubId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!clubId,
  });

  const { data: trialsCount } = useQuery({
    queryKey: ['scouting-trials-count', clubId],
    queryFn: async () => {
      if (!clubId) return 0;
      const { count, error } = await supabase
        .from('prospect_trials')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', clubId);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!clubId,
  });

  const { data: needsCount } = useQuery({
    queryKey: ['scouting-needs-count', clubId],
    queryFn: async () => {
      if (!clubId) return 0;
      const { count, error } = await supabase
        .from('recruitment_needs')
        .select('*', { count: 'exact', head: true })
        .eq('club_id', clubId)
        .eq('status', 'open');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!clubId,
  });

  if (pLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}</div>;
  }

  const total = prospects?.length || 0;
  const highPriority = prospects?.filter(p => p.priority === 'high' || p.priority === 'critical').length || 0;
  const shortlisted = prospects?.filter(p => p.pipeline_status === 'shortlist').length || 0;
  const approved = prospects?.filter(p => p.pipeline_status === 'approved').length || 0;

  const positionData = computeProspectsByPosition(prospects || []);
  const positionChart = Object.entries(positionData).map(([name, value]) => ({ name, value }));

  const priorityData = computeProspectsByPriority(prospects || []);
  const priorityChart = Object.entries(priorityData).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} title="Prospects Ativos" value={total} />
        <KpiCard icon={Eye} title="Observações" value={obsCount || 0} />
        <KpiCard icon={Target} title="Alta Prioridade" value={highPriority} accent />
        <KpiCard icon={TrendingUp} title="Em Shortlist" value={shortlisted} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={CheckCircle} title="Aprovados" value={approved} />
        <KpiCard icon={AlertTriangle} title="Trials" value={trialsCount || 0} />
        <KpiCard icon={Target} title="Necessidades Abertas" value={needsCount || 0} accent />
        <KpiCard icon={Eye} title="Late Developers" value={prospects?.filter(p => p.is_late_developer).length || 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Prospects por Posição</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={positionChart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Prospects por Prioridade</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={priorityChart} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label>
                  {priorityChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, title, value, accent }: { icon: any; title: string; value: number; accent?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${accent ? 'text-destructive' : 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${accent ? 'text-destructive' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
