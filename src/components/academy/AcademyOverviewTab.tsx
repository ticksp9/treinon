import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAcademy, computeRetentionRate, computePromotionRate, computeComplianceScore, computeAssessmentCompletion, computePathwayDistribution } from '@/hooks/useAcademy';
import { Users, Target, TrendingUp, ShieldCheck, ClipboardCheck, Star, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const PATHWAY_COLORS: Record<string, string> = {
  active: 'hsl(var(--primary))',
  high_potential: 'hsl(142 76% 36%)',
  under_observation: 'hsl(38 92% 50%)',
  promoted: 'hsl(221 83% 53%)',
  retained: 'hsl(var(--muted-foreground))',
  released: 'hsl(0 84% 60%)',
  archived: 'hsl(var(--muted-foreground))',
};

const PATHWAY_LABELS: Record<string, string> = {
  active: 'Ativo',
  under_observation: 'Em Observação',
  high_potential: 'Alto Potencial',
  accelerated: 'Acelerado',
  eligible_promotion: 'Elegível Promoção',
  promoted: 'Promovido',
  retained: 'Retido',
  in_transition: 'Em Transição',
  unavailable: 'Indisponível',
  released: 'Desligado',
  archived: 'Arquivado',
};

export function AcademyOverviewTab() {
  const { playerProfiles, assessments, complianceItems, staffAssignments, ageGroups, programs } = useAcademy();

  const profiles = playerProfiles.data || [];
  const allAssessments = assessments.data || [];
  const compliance = complianceItems.data || [];
  const staff = staffAssignments.data || [];
  const groups = ageGroups.data || [];
  const activeProgram = (programs.data || []).find(p => p.status === 'active');

  const retentionRate = computeRetentionRate(profiles);
  const promotionRate = computePromotionRate(profiles);
  const complianceScore = computeComplianceScore(compliance);
  const assessmentCompletion = computeAssessmentCompletion(allAssessments);
  const pathwayDist = computePathwayDistribution(profiles);

  const highPotential = profiles.filter(p => p.pathway_status === 'high_potential').length;
  const atRisk = profiles.filter(p => ['under_observation', 'unavailable'].includes(p.pathway_status)).length;

  const pathwayChartData = Object.entries(pathwayDist).map(([key, value]) => ({
    name: PATHWAY_LABELS[key] || key,
    value,
    fill: PATHWAY_COLORS[key] || 'hsl(var(--muted-foreground))',
  }));

  const groupDistribution = groups.map(g => ({
    name: g.name,
    count: profiles.filter(p => p.age_group_id === g.id).length,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <KpiCard icon={Users} label="Total Atletas" value={profiles.length} />
        <KpiCard icon={Star} label="Alto Potencial" value={highPotential} variant="success" />
        <KpiCard icon={AlertTriangle} label="Em Risco" value={atRisk} variant="warning" />
        <KpiCard icon={TrendingUp} label="Taxa Retenção" value={`${retentionRate.toFixed(0)}%`} />
        <KpiCard icon={Target} label="Taxa Promoção" value={`${promotionRate.toFixed(0)}%`} />
        <KpiCard icon={ShieldCheck} label="Compliance" value={`${complianceScore.toFixed(0)}%`} variant={complianceScore >= 80 ? 'success' : 'warning'} />
      </div>

      {/* Program status + Assessment completion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Programa de Formação</CardTitle></CardHeader>
          <CardContent>
            {activeProgram ? (
              <div className="space-y-2">
                <p className="font-medium">{activeProgram.name}</p>
                <Badge variant="secondary">{activeProgram.status}</Badge>
                <p className="text-sm text-muted-foreground">Versão {activeProgram.version_no} · Época {activeProgram.season || '—'}</p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nenhum programa ativo</p>
            )}
            <div className="mt-4 space-y-1">
              <p className="text-sm text-muted-foreground">Escalões: <span className="font-medium text-foreground">{groups.length}</span></p>
              <p className="text-sm text-muted-foreground">Staff ativo: <span className="font-medium text-foreground">{staff.length}</span></p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Avaliações</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{assessmentCompletion.submitted}/{assessmentCompletion.total}</div>
            <p className="text-sm text-muted-foreground">Completude: {assessmentCompletion.rate.toFixed(0)}%</p>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${assessmentCompletion.rate}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Distribuição por Escalão</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={groupDistribution}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Distribuição Pathway</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pathwayChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {pathwayChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
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

function KpiCard({ icon: Icon, label, value, variant }: { icon: any; label: string; value: string | number; variant?: 'success' | 'warning' }) {
  const colorClass = variant === 'success' ? 'text-green-600' : variant === 'warning' ? 'text-amber-600' : 'text-foreground';
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
