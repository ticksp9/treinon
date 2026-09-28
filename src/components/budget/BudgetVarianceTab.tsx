import { useBudget } from '@/hooks/useBudget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const formatCurrency = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

export function BudgetVarianceTab({ clubId }: { clubId: string }) {
  const { cycles, categories, useVersions, useLines, computeVariances } = useBudget(clubId);

  const activeCycle = cycles.data?.find(c => c.status === 'approved') || cycles.data?.[0];
  const versions = useVersions(activeCycle?.id || null);
  const activeVersion = versions.data?.[0];
  const lines = useLines(activeVersion?.id || null);
  const allCats = categories.data || [];
  const variances = computeVariances(lines.data || [], allCats);

  const sorted = [...variances].sort((a, b) => Math.abs(b.variance_abs) - Math.abs(a.variance_abs));

  const chartData = sorted.slice(0, 10).map(v => ({
    name: v.category_name.length > 15 ? v.category_name.slice(0, 15) + '…' : v.category_name,
    variance: v.variance_pct,
    status: v.status,
  }));

  if (!activeCycle) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">Sem orçamento ativo.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Real vs Budget — {activeCycle.name}</h3>

      {/* Variance Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Desvios por Categoria (%)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" width={120} className="text-xs" />
                <Tooltip formatter={(v: number) => `${v}%`} />
                <Bar dataKey="variance" name="Desvio %">
                  {chartData.map((entry, i) => (
                    <Cell key={i} fill={entry.status === 'favorable' ? 'hsl(142, 71%, 45%)' : entry.status === 'unfavorable' ? 'hsl(0, 84%, 60%)' : 'hsl(var(--muted-foreground))'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Variance Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Orçamento</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Forecast</TableHead>
                <TableHead className="text-right">Desvio</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead>Execução</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((v, i) => {
                const execPct = v.budget !== 0 ? Math.min(100, Math.round((v.actual / Math.abs(v.budget)) * 100)) : 0;
                return (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{v.category_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{v.category_type === 'revenue' ? 'Receita' : v.category_type === 'investment' ? 'Invest.' : 'Custo'}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(v.budget)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(v.actual)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(v.forecast)}</TableCell>
                    <TableCell className="text-right">
                      <span className={v.status === 'unfavorable' ? 'text-destructive font-medium' : v.status === 'favorable' ? 'text-green-600 font-medium' : ''}>
                        {formatCurrency(v.variance_abs)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={v.status === 'unfavorable' ? 'text-destructive' : v.status === 'favorable' ? 'text-green-600' : ''}>
                        {v.variance_pct > 0 ? '+' : ''}{v.variance_pct}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Progress value={execPct} className="h-2 w-20" />
                    </TableCell>
                    <TableCell>
                      <Badge variant={v.status === 'favorable' ? 'default' : v.status === 'unfavorable' ? 'destructive' : 'secondary'} className="text-xs">
                        {v.status === 'favorable' ? 'Favorável' : v.status === 'unfavorable' ? 'Desfavorável' : 'Neutro'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Sem dados de variância. Adicione linhas orçamentais primeiro.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
