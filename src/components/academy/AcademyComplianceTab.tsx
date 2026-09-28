import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAcademy, computeComplianceScore } from '@/hooks/useAcademy';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  compliant: 'Conforme',
  pending: 'Pendente',
  non_compliant: 'Não Conforme',
  waived: 'Dispensado',
  expired: 'Expirado',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  compliant: 'default',
  pending: 'outline',
  non_compliant: 'destructive',
  expired: 'destructive',
  waived: 'secondary',
};

const SEVERITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

export function AcademyComplianceTab() {
  const { complianceItems } = useAcademy();

  const items = complianceItems.data || [];
  const score = computeComplianceScore(items);
  const pendingCount = items.filter(i => i.status === 'pending' || i.status === 'non_compliant').length;
  const criticalCount = items.filter(i => i.severity === 'critical' && i.status !== 'compliant').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Score de Compliance</p>
              <p className={`text-2xl font-bold ${score >= 80 ? 'text-green-600' : score >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {score.toFixed(0)}%
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Itens Pendentes</p>
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">Itens Críticos</p>
              <p className="text-2xl font-bold text-destructive">{criticalCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Itens de Compliance da Academia</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum item de compliance registado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Severidade</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.item_type}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.description}</TableCell>
                    <TableCell>
                      <Badge variant={item.severity === 'critical' ? 'destructive' : 'outline'}>
                        {SEVERITY_LABELS[item.severity || 'medium'] || item.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.due_date || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[item.status] || 'outline'}>
                        {STATUS_LABELS[item.status] || item.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
