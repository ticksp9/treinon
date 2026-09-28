import { useProcurement } from '@/hooks/useProcurement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

export function PayablesOverviewTab({ clubId }: { clubId: string }) {
  const { invoices, invoicesLoading, agingBuckets } = useProcurement(clubId);

  const now = new Date();
  const openInvoices = invoices.filter(i => i.payment_status !== 'paid' && i.payment_status !== 'cancelled');
  const overdueInvoices = openInvoices.filter(i => new Date(i.due_date) < now).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const upcomingInvoices = openInvoices.filter(i => new Date(i.due_date) >= now).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  if (invoicesLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      {/* Aging Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Corrente', value: agingBuckets.current, color: 'text-green-600' },
          { label: '1-30 dias', value: agingBuckets.days_1_30, color: 'text-amber-600' },
          { label: '31-60 dias', value: agingBuckets.days_31_60, color: 'text-orange-600' },
          { label: '61-90 dias', value: agingBuckets.days_61_90, color: 'text-red-500' },
          { label: '>90 dias', value: agingBuckets.over_90, color: 'text-destructive' },
        ].map(b => (
          <Card key={b.label}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">{b.label}</p>
              <p className={`text-lg font-bold ${b.color}`}>{fmt(b.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Overdue */}
      {overdueInvoices.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Faturas Vencidas ({overdueInvoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Nº Fatura</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Dias Atraso</TableHead>
                  <TableHead>Em Aberto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overdueInvoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{(inv as any).vendors?.legal_name || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell className="text-xs">{format(new Date(inv.due_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell><Badge variant="destructive">{differenceInDays(now, new Date(inv.due_date))}d</Badge></TableCell>
                    <TableCell className="font-semibold text-destructive">{fmt(inv.outstanding_amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Upcoming */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Próximos Vencimentos ({upcomingInvoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Nº Fatura</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Dias até vencimento</TableHead>
                <TableHead>Em Aberto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingInvoices.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8 flex items-center justify-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Sem faturas por vencer
                </TableCell></TableRow>
              ) : upcomingInvoices.map(inv => {
                const daysUntil = differenceInDays(new Date(inv.due_date), now);
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{(inv as any).vendors?.legal_name || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                    <TableCell className="text-xs">{format(new Date(inv.due_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={daysUntil <= 7 ? 'destructive' : 'outline'}>
                        {daysUntil}d
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{fmt(inv.outstanding_amount)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
