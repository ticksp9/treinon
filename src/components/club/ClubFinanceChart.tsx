import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';
import { pt } from 'date-fns/locale';

interface ClubFinanceChartProps {
  clubId: string;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function ClubFinanceChart({ clubId }: ClubFinanceChartProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [compareYear, setCompareYear] = useState((currentYear - 1).toString());

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['club-transactions', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('club_id', clubId)
        .order('date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  const processData = () => {
    if (!transactions) return [];

    return MONTHS.map((month, index) => {
      const monthNum = index + 1;

      const currentYearTransactions = transactions.filter(t => {
        const date = new Date(t.date);
        return date.getFullYear() === parseInt(selectedYear) && date.getMonth() + 1 === monthNum;
      });

      const compareYearTransactions = transactions.filter(t => {
        const date = new Date(t.date);
        return date.getFullYear() === parseInt(compareYear) && date.getMonth() + 1 === monthNum;
      });

      const currentIncome = currentYearTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const currentExpense = currentYearTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const compareIncome = compareYearTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      
      const compareExpense = compareYearTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      return {
        month: month.substring(0, 3),
        [`Receitas ${selectedYear}`]: currentIncome,
        [`Despesas ${selectedYear}`]: currentExpense,
        [`Receitas ${compareYear}`]: compareIncome,
        [`Despesas ${compareYear}`]: compareExpense,
        [`Balanço ${selectedYear}`]: currentIncome - currentExpense,
        [`Balanço ${compareYear}`]: compareIncome - compareExpense,
      };
    });
  };

  const chartData = processData();

  const totals = {
    income: transactions?.filter(t => {
      const date = new Date(t.date);
      return date.getFullYear() === parseInt(selectedYear) && t.type === 'income';
    }).reduce((sum, t) => sum + Number(t.amount), 0) || 0,
    expense: transactions?.filter(t => {
      const date = new Date(t.date);
      return date.getFullYear() === parseInt(selectedYear) && t.type === 'expense';
    }).reduce((sum, t) => sum + Number(t.amount), 0) || 0,
  };

  const balance = totals.income - totals.expense;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Receitas {selectedYear}</p>
                <p className="text-2xl font-bold text-green-600">
                  {totals.income.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/30">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Despesas {selectedYear}</p>
                <p className="text-2xl font-bold text-red-600">
                  {totals.expense.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900/30">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Balanço {selectedYear}</p>
                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {balance.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>
              <div className={`p-3 rounded-full ${balance >= 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                <DollarSign className={`w-6 h-6 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Evolução Financeira</CardTitle>
              <CardDescription>Comparação mensal entre anos</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="self-center text-muted-foreground">vs</span>
              <Select value={compareYear} onValueChange={setCompareYear}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis 
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k€`}
                  className="text-xs"
                />
                <Tooltip 
                  formatter={(value: number) => value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey={`Receitas ${selectedYear}`} fill="hsl(145, 63%, 42%)" />
                <Bar dataKey={`Despesas ${selectedYear}`} fill="hsl(0, 84%, 60%)" />
                <Bar dataKey={`Receitas ${compareYear}`} fill="hsl(145, 63%, 42%)" fillOpacity={0.4} />
                <Bar dataKey={`Despesas ${compareYear}`} fill="hsl(0, 84%, 60%)" fillOpacity={0.4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Balance Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Balanço Mensal</CardTitle>
          <CardDescription>Receitas - Despesas por mês</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis 
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k€`}
                  className="text-xs"
                />
                <Tooltip 
                  formatter={(value: number) => value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey={`Balanço ${selectedYear}`} 
                  stroke="hsl(145, 63%, 42%)" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(145, 63%, 42%)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey={`Balanço ${compareYear}`} 
                  stroke="hsl(38, 92%, 50%)" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: 'hsl(38, 92%, 50%)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
