import { usePhysioAccess } from '@/hooks/usePhysioAccess';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import {
  Heart, AlertTriangle, Activity, Calendar, ClipboardList, Users, Shield, Stethoscope
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  computeSquadFitness, computeExamCompliance, computeInjuryStats,
  CLEARANCE_STATUSES, INJURY_CASE_STATUSES
} from '@/hooks/useMedical';

export function MedicalOverviewTab() {
  const { clubId } = usePhysioAccess();

  const { data: clearances, isLoading: clLoading } = useQuery({
    queryKey: ['medical-clearances-overview', clubId],
    queryFn: async () => {
      const { data } = await supabase
        .from('medical_clearances')
        .select('person_id, clearance_type, clearance_status, valid_to')
        .eq('club_id', clubId!)
        .in('clearance_status', ['fit', 'fit_restricted', 'unfit', 'unfit_training', 'unfit_match', 'pending']);
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: injuryCases, isLoading: injLoading } = useQuery({
    queryKey: ['medical-injury-cases-overview', clubId],
    queryFn: async () => {
      const { data } = await supabase
        .from('injury_cases')
        .select('id, person_id, severity, case_status, event_date, expected_days_out, actual_days_out, body_area')
        .eq('club_id', clubId!);
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: exams, isLoading: exLoading } = useQuery({
    queryKey: ['medical-exams-overview', clubId],
    queryFn: async () => {
      const { data } = await supabase
        .from('medical_exams')
        .select('person_id, exam_type_code, status, expiry_date')
        .eq('club_id', clubId!);
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: alerts } = useQuery({
    queryKey: ['medical-alerts-overview', clubId],
    queryFn: async () => {
      const { data } = await supabase
        .from('medical_alerts')
        .select('id, alert_type, severity, status')
        .eq('club_id', clubId!)
        .eq('status', 'active');
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: sessions } = useQuery({
    queryKey: ['medical-sessions-overview', clubId],
    queryFn: async () => {
      const { data } = await supabase
        .from('physio_sessions')
        .select('id')
        .eq('club_id', clubId!);
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: rehabPrograms } = useQuery({
    queryKey: ['medical-rehab-overview', clubId],
    queryFn: async () => {
      const { data } = await supabase
        .from('rehab_programs')
        .select('id, program_status')
        .eq('club_id', clubId!)
        .eq('program_status', 'active');
      return data || [];
    },
    enabled: !!clubId,
  });

  const isLoading = clLoading || injLoading || exLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const fitness = computeSquadFitness(clearances || []);
  const examCompliance = computeExamCompliance(exams || []);
  const injuryStats = computeInjuryStats(injuryCases || []);

  const fitnessChartData = [
    { name: 'Aptos', value: fitness.fit, fill: 'hsl(var(--chart-2))' },
    { name: 'C/ Restrições', value: fitness.fitRestricted, fill: 'hsl(var(--chart-4))' },
    { name: 'Inaptos', value: fitness.unfit, fill: 'hsl(var(--chart-1))' },
    { name: 'Pendentes', value: fitness.pending, fill: 'hsl(var(--chart-3))' },
  ].filter(d => d.value > 0);

  const severityData = Object.entries(injuryStats.bySeverity).map(([key, val]) => ({
    name: key === 'mild' ? 'Leve' : key === 'moderate' ? 'Moderada' : key === 'severe' ? 'Grave' : 'Crítica',
    value: val,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Heart className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fitness.fit}</p>
                <p className="text-xs text-muted-foreground">Atletas Aptos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{injuryStats.activeCases}</p>
                <p className="text-xs text-muted-foreground">Lesões Ativas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Calendar className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{examCompliance.expired + examCompliance.expiringSoon}</p>
                <p className="text-xs text-muted-foreground">Exames Vencidos/A Vencer</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Stethoscope className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sessions?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Sessões Fisioterapia</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Users className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{fitness.unfit}</p>
                <p className="text-xs text-muted-foreground">Inaptos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <ClipboardList className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rehabPrograms?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Rehab Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{injuryStats.totalDaysLost}</p>
                <p className="text-xs text-muted-foreground">Dias Perdidos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <Shield className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{alerts?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Alertas Ativos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Aptidão do Plantel</CardTitle>
            <CardDescription>Estado de clearance global</CardDescription>
          </CardHeader>
          <CardContent>
            {fitnessChartData.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Sem dados de aptidão</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={fitnessChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {fitnessChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Lesões por Gravidade</CardTitle>
            <CardDescription>Distribuição de casos</CardDescription>
          </CardHeader>
          <CardContent>
            {severityData.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Sem dados de lesões</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={severityData}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compliance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Compliance de Exames</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">{examCompliance.valid}</p>
              <p className="text-xs text-muted-foreground">Válidos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">{examCompliance.expiringSoon}</p>
              <p className="text-xs text-muted-foreground">A Vencer (30d)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{examCompliance.expired}</p>
              <p className="text-xs text-muted-foreground">Vencidos</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{examCompliance.missing}</p>
              <p className="text-xs text-muted-foreground">Em Falta</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{examCompliance.complianceRate}%</p>
              <p className="text-xs text-muted-foreground">Taxa Conformidade</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
