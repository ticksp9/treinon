import { usePhysioAccess } from '@/hooks/usePhysioAccess';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Shield, Calendar, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

export function MedicalComplianceTab() {
  const { clubId } = usePhysioAccess();

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['medical-compliance-alerts', clubId],
    queryFn: async () => {
      const { data } = await supabase.from('medical_alerts').select('*').eq('club_id', clubId!).eq('status', 'active').order('severity', { ascending: true });
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: complianceItems, isLoading: compLoading } = useQuery({
    queryKey: ['medical-compliance-items', clubId],
    queryFn: async () => {
      const { data } = await supabase.from('medical_compliance_items').select('*').eq('club_id', clubId!).order('required_by_date');
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: equipmentChecks } = useQuery({
    queryKey: ['medical-equipment-checks', clubId],
    queryFn: async () => {
      const { data } = await supabase.from('medical_equipment_checks').select('*').eq('club_id', clubId!).order('check_date', { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: medStaff } = useQuery({
    queryKey: ['medical-staff-registry', clubId],
    queryFn: async () => {
      const { data } = await supabase.from('medical_staff_registry').select('*').eq('club_id', clubId!).eq('is_active', true);
      return data || [];
    },
    enabled: !!clubId,
  });

  const isLoading = alertsLoading || compLoading;

  const severityColors: Record<string, string> = {
    high: 'bg-red-500/20 text-red-700 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-700 border-blue-500/30',
    critical: 'bg-red-700/20 text-red-900 border-red-700/30',
  };

  if (isLoading) {
    return <div className="space-y-6"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  }

  const pendingCompliance = complianceItems?.filter(c => c.status === 'pending') || [];
  const completedCompliance = complianceItems?.filter(c => c.status === 'completed') || [];
  const failedChecks = equipmentChecks?.filter(c => c.check_result === 'fail') || [];

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{alerts?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Alertas Ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{pendingCompliance.length}</p>
            <p className="text-xs text-muted-foreground">Itens Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{completedCompliance.length}</p>
            <p className="text-xs text-muted-foreground">Itens Concluídos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{medStaff?.length || 0}</p>
            <p className="text-xs text-muted-foreground">Staff Médico Ativo</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="w-5 h-5" />Alertas Médicos Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts?.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground"><CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" /><p>Sem alertas ativos</p></div>
          ) : (
            <div className="space-y-3">
              {alerts?.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                    {a.due_date && <p className="text-xs text-muted-foreground mt-1">Vencimento: {format(new Date(a.due_date), 'dd/MM/yyyy')}</p>}
                  </div>
                  <Badge variant="outline" className={severityColors[a.severity] || ''}>
                    {a.severity === 'high' ? 'Alta' : a.severity === 'critical' ? 'Crítica' : a.severity === 'medium' ? 'Média' : 'Baixa'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Equipment Checks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Shield className="w-5 h-5" />Verificações de Equipamento Médico</CardTitle>
          <CardDescription>Últimas inspeções</CardDescription>
        </CardHeader>
        <CardContent>
          {equipmentChecks?.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">Sem verificações registadas</p>
          ) : (
            <div className="space-y-2">
              {equipmentChecks?.slice(0, 10).map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <div>
                    <span className="font-medium">{c.equipment_name}</span>
                    <span className="text-muted-foreground ml-2">{c.equipment_type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{format(new Date(c.check_date), 'dd/MM/yyyy')}</span>
                    <Badge variant={c.check_result === 'pass' ? 'secondary' : 'destructive'}>
                      {c.check_result === 'pass' ? 'OK' : 'Falhou'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Medical Staff */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Staff Médico</CardTitle>
        </CardHeader>
        <CardContent>
          {medStaff?.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">Nenhum staff médico registado</p>
          ) : (
            <div className="space-y-2">
              {medStaff?.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{s.person_name}</p>
                    <p className="text-sm text-muted-foreground">{s.staff_role} {s.specialty ? `• ${s.specialty}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.license_expiry && (
                      <span className="text-xs text-muted-foreground">
                        Licença até {format(new Date(s.license_expiry), 'dd/MM/yyyy')}
                      </span>
                    )}
                    <Badge variant="secondary">Ativo</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
