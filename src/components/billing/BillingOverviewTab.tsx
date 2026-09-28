import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useChargesSummary, useGenerateCharges, useMarkOverdue } from '@/hooks/useBilling';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, RefreshCw, Zap } from 'lucide-react';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props { clubId: string; }

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function BillingOverviewTab({ clubId }: Props) {
  const { data: summary, isLoading } = useChargesSummary(clubId);
  const generateCharges = useGenerateCharges(clubId);
  const markOverdue = useMarkOverdue(clubId);
  const now = new Date();
  const [genMonth, setGenMonth] = useState((now.getMonth() + 1).toString());
  const [genYear, setGenYear] = useState(now.getFullYear().toString());

  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Faturado</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmt(summary?.total_billed || 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Recebido</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600 flex items-center gap-1"><TrendingUp className="h-4 w-4" />{fmt(summary?.total_paid || 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Em Aberto</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600 flex items-center gap-1"><TrendingDown className="h-4 w-4" />{fmt(summary?.total_pending || 0)}</div><p className="text-xs text-muted-foreground mt-1">{summary?.count_pending || 0} cobranças pendentes</p></CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Vencido</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{fmt(summary?.total_overdue || 0)}</div><p className="text-xs text-muted-foreground mt-1">{summary?.count_overdue || 0} cobranças vencidas</p></CardContent>
        </Card>
      </div>

      {/* Actions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Ações Rápidas</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Mês</label>
              <Select value={genMonth} onValueChange={setGenMonth}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={(i+1).toString()}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ano</label>
              <Select value={genYear} onValueChange={setGenYear}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{[2025,2026,2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={() => generateCharges.mutate({ month: parseInt(genMonth), year: parseInt(genYear) })} disabled={generateCharges.isPending}>
              <Zap className="w-4 h-4 mr-1" /> Gerar Mensalidades
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => markOverdue.mutate()} disabled={markOverdue.isPending}>
              <RefreshCw className="w-4 h-4 mr-1" /> Atualizar Vencidos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-primary">{summary?.count_paid || 0}</div><p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-1"><CheckCircle2 className="h-3 w-3" /> Pagas</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-amber-600">{summary?.count_pending || 0}</div><p className="text-xs text-muted-foreground mt-1">Pendentes</p></CardContent></Card>
        <Card><CardContent className="pt-6 text-center"><div className="text-3xl font-bold text-destructive">{summary?.count_overdue || 0}</div><p className="text-xs text-muted-foreground mt-1">Vencidas</p></CardContent></Card>
      </div>
    </div>
  );
}
