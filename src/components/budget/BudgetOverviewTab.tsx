import { useBudget } from '@/hooks/useBudget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Target, AlertTriangle, BarChart3, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

export function BudgetOverviewTab({ clubId }: { clubId: string }) {
  const { cycles, categories, alerts, useVersions, useLines, computeVariances } = useBudget(clubId);

  const activeCycle = cycles.data?.find(c => c.status === 'approved') || cycles.data?.[0];
  const versions = useVersions(activeCycle?.id || null);
  const activeVersion = versions.data?.[0];
  const lines = useLines(activeVersion?.id || null);

  const allLines = lines.data || [];
  const allCats = categories.data || [];
  const variances = computeVariances(allLines, allCats);

  const totalBudget = allLines.reduce((s, l) => s + Number(l.budget_amount || 0), 0);
  const totalActual = allLines.reduce((s, l) => s + Number(l.actual_amount || 0), 0);
  const totalForecast = allLines.reduce((s, l) => s + Number(l.forecast_amount || 0), 0);
  const totalVariance = totalActual - totalBudget;
  const executionPct = totalBudget ? Math.round((totalActual / totalBudget) * 100) : 0;

  const revenueBudget = allLines.filter(l => l.line_type === 'revenue').reduce((s, l) => s + Number(l.budget_amount || 0), 0);
  const revenueActual = allLines.filter(l => l.line_type === 'revenue').reduce((s, l) => s + Number(l.actual_amount || 0), 0);
  const expenseBudget = allLines.filter(l => l.line_type !== 'revenue').reduce((s, l) => s + Number(l.budget_amount || 0), 0);
  const expenseActual = allLines.filter(l => l.line_type !== 'revenue').reduce((s, l) => s + Number(l.actual_amount || 0), 0);

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const monthLines = allLines.filter(l => l.month === m);
    return {
      month: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][i],
      budget: monthLines.reduce((s, l) => s + Number(l.budget_amount || 0), 0),
      actual: monthLines.reduce((s, l) => s + Number(l.actual_amount || 0), 0),
      forecast: monthLines.reduce((s, l) => s + Number(l.forecast_amount || 0), 0),
    };
  });

  const criticalAlerts = (alerts.data || []).filter(a => a.severity === 'critical').length;

  if (cycles.isLoading) return <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}</div>;

  if (!activeCycle) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sem orçamento ativo</h3>
          <p className="text-muted-foreground">Crie um ciclo orçamental no separador "Ciclos" para começar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Orçamento Total</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBudget)}</div>
            <p className="text-xs text-muted-foreground mt-1">{activeCycle.name} — {activeCycle.season}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Realizado</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalActual)}</div>
            <p className="text-xs text-muted-foreground mt-1">Execução: {executionPct}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Desvio</CardTitle>
            {totalVariance >= 0 ? <TrendingUp className="h-4 w-4 text-destructive" /> : <TrendingDown className="h-4 w-4 text-primary" />}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalVariance > 0 ? 'text-destructive' : totalVariance < 0 ? 'text-primary' : ''}`}>
              {formatCurrency(totalVariance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalBudget ? `${Math.round((totalVariance / totalBudget) * 100)}%` : '0%'} vs orçamento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Alertas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-accent-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent-foreground">{criticalAlerts}</div>
            <p className="text-xs text-muted-foreground mt-1">{(alerts.data || []).length} alertas ativos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Receitas</CardTitle></CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Orçamento</span>
              <span className="font-medium">{formatCurrency(revenueBudget)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Realizado</span>
              <span className="font-medium">{formatCurrency(revenueActual)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Desvio</span>
              <Badge variant={revenueActual >= revenueBudget ? 'default' : 'destructive'} className="text-xs">
                {formatCurrency(revenueActual - revenueBudget)}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Custos + Investimentos</CardTitle></CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Orçamento</span>
              <span className="font-medium">{formatCurrency(expenseBudget)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Realizado</span>
              <span className="font-medium">{formatCurrency(expenseActual)}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Desvio</span>
              <Badge variant={expenseActual <= expenseBudget ? 'default' : 'destructive'} className="text-xs">
                {formatCurrency(expenseActual - expenseBudget)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Budget vs Realizado Mensal</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="budget" name="Orçamento" fill="hsl(var(--primary))" opacity={0.5} />
              <Bar dataKey="actual" name="Realizado" fill="hsl(var(--primary))" />
              <Bar dataKey="forecast" name="Forecast" fill="hsl(var(--muted-foreground))" opacity={0.3} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {variances.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Top Desvios por Categoria</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {variances
                .sort((a, b) => Math.abs(b.variance_abs) - Math.abs(a.variance_abs))
                .slice(0, 8)
                .map((v, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{v.category_type === 'revenue' ? 'Rec' : 'Cst'}</Badge>
                      <span>{v.category_name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">{formatCurrency(v.budget)}</span>
                      <span className="font-medium">{formatCurrency(v.actual)}</span>
                      <Badge variant={v.status === 'favorable' ? 'default' : v.status === 'unfavorable' ? 'destructive' : 'secondary'} className="text-xs min-w-[80px] justify-center">
                        {v.variance_pct > 0 ? '+' : ''}{v.variance_pct}%
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
