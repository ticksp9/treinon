import { useBudget } from '@/hooks/useBudget';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const severityConfig = {
  info: { icon: Info, color: 'text-blue-500', variant: 'secondary' as const },
  warning: { icon: AlertTriangle, color: 'text-amber-500', variant: 'outline' as const },
  critical: { icon: AlertCircle, color: 'text-destructive', variant: 'destructive' as const },
};

const formatCurrency = (v: number | null) => v != null ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v) : '—';

export function BudgetAlertsTab({ clubId }: { clubId: string }) {
  const { alerts } = useBudget(clubId);

  const data = alerts.data || [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Alertas de Controlo Orçamental</h3>

      {data.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Sem alertas ativos. O orçamento está sob controlo.
          </CardContent>
        </Card>
      )}

      {data.map(alert => {
        const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;
        const Icon = config.icon;

        return (
          <Card key={alert.id}>
            <CardContent className="flex items-start gap-4 py-4">
              <Icon className={`w-5 h-5 mt-0.5 ${config.color}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={config.variant} className="text-xs">{alert.severity}</Badge>
                  <Badge variant="outline" className="text-xs">{alert.alert_type}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(alert.created_at), 'dd/MM/yyyy HH:mm')}
                  </span>
                </div>
                <p className="text-sm">{alert.message}</p>
                {(alert.threshold_value || alert.current_value) && (
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    {alert.threshold_value && <span>Limite: {formatCurrency(alert.threshold_value)}</span>}
                    {alert.current_value && <span>Atual: {formatCurrency(alert.current_value)}</span>}
                  </div>
                )}
              </div>
              <Badge variant="secondary" className="text-xs">{alert.status}</Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
