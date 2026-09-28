import { useProcurement } from '@/hooks/useProcurement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users, FileText, Receipt, AlertTriangle, CreditCard,
  TrendingDown, CheckSquare, Clock,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

export function ProcurementOverviewTab({ clubId }: { clubId: string }) {
  const {
    vendors, vendorsLoading, invoices, invoicesLoading,
    purchaseRequests, expenseClaims, supplierPayments,
    agingBuckets,
  } = useProcurement(clubId);

  const activeVendors = vendors.filter(v => v.vendor_status === 'active').length;
  const totalInvoiced = invoices.reduce((s, i) => s + i.gross_total, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.outstanding_amount, 0);
  const totalPaid = supplierPayments.reduce((s, p) => s + p.gross_amount, 0);
  const overdueInvoices = invoices.filter(i => i.payment_status !== 'paid' && i.payment_status !== 'cancelled' && new Date(i.due_date) < new Date());
  const totalOverdue = overdueInvoices.reduce((s, i) => s + i.outstanding_amount, 0);
  const pendingApprovals = purchaseRequests.filter(pr => pr.status === 'submitted' || pr.status === 'under_review').length;
  const pendingExpenses = expenseClaims.filter(ec => ec.status === 'submitted').length;

  const agingData = [
    { name: 'Corrente', value: agingBuckets.current },
    { name: '1-30d', value: agingBuckets.days_1_30 },
    { name: '31-60d', value: agingBuckets.days_31_60 },
    { name: '61-90d', value: agingBuckets.days_61_90 },
    { name: '>90d', value: agingBuckets.over_90 },
  ];

  if (vendorsLoading || invoicesLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fornecedores Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeVendors}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Faturado</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(totalInvoiced)}</div>
            <p className="text-xs text-muted-foreground mt-1">Pago: {fmt(totalPaid)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em Aberto</CardTitle>
            <TrendingDown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{fmt(totalOutstanding)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vencido</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{fmt(totalOverdue)}</div>
            <p className="text-xs text-muted-foreground mt-1">{overdueInvoices.length} faturas</p>
          </CardContent>
        </Card>
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aprovações Pendentes</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingApprovals}</div>
            <p className="text-xs text-muted-foreground mt-1">requisições por aprovar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas Pendentes</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingExpenses}</div>
            <p className="text-xs text-muted-foreground mt-1">expense claims por aprovar</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Requisições Abertas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{purchaseRequests.filter(pr => !['cancelled', 'converted'].includes(pr.status)).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Aging Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aging de Contas a Pagar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agingData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} className="text-xs" />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
