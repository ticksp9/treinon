import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, X, FileDown } from 'lucide-react';

interface PlayerFeesProps {
  clubId: string;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function PlayerFees({ clubId }: PlayerFeesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedTeam, setSelectedTeam] = useState<string>('all');

  const years = Array.from({ length: 3 }, (_, i) => (currentYear - i).toString());

  // Fetch teams
  const { data: teams } = useQuery({
    queryKey: ['club-teams', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, category')
        .eq('club_id', clubId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  // Fetch players with their fees
  const { data: playersWithFees, isLoading } = useQuery({
    queryKey: ['player-fees', clubId, selectedYear, selectedTeam],
    queryFn: async () => {
      let query = supabase
        .from('players')
        .select(`
          id, name, number,
          team_id,
          teams!inner(id, name, category)
        `)
        .eq('is_active', true);

      if (selectedTeam !== 'all') {
        query = query.eq('team_id', selectedTeam);
      } else {
        // Filter by club teams
        const teamIds = teams?.map(t => t.id) || [];
        if (teamIds.length > 0) {
          query = query.in('team_id', teamIds);
        }
      }

      const { data: players, error } = await query.order('name');
      if (error) throw error;

      // Fetch fees for each player
      const playersData = await Promise.all(
        (players || []).map(async (player) => {
          const { data: fees } = await supabase
            .from('player_fees')
            .select('*')
            .eq('player_id', player.id)
            .eq('year', parseInt(selectedYear));

          const feesByMonth: Record<number, boolean> = {};
          fees?.forEach(fee => {
            feesByMonth[fee.month] = fee.is_paid;
          });

          return {
            ...player,
            fees: feesByMonth,
          };
        })
      );

      return playersData;
    },
    enabled: !!clubId && !!teams,
  });

  const togglePayment = useMutation({
    mutationFn: async ({ playerId, month, isPaid }: { playerId: string; month: number; isPaid: boolean }) => {
      if (!user) throw new Error('Not authenticated');

      // Check if fee record exists
      const { data: existing } = await supabase
        .from('player_fees')
        .select('id')
        .eq('player_id', playerId)
        .eq('month', month)
        .eq('year', parseInt(selectedYear))
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('player_fees')
          .update({
            is_paid: isPaid,
            paid_at: isPaid ? new Date().toISOString() : null,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('player_fees')
          .insert({
            player_id: playerId,
            club_id: clubId,
            month: month,
            year: parseInt(selectedYear),
            is_paid: isPaid,
            paid_at: isPaid ? new Date().toISOString() : null,
            owner_id: user.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-fees'] });
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar pagamento: ' + error.message);
    },
  });

  const exportToPDF = () => {
    // Simple text export for now
    let content = `Mensalidades ${selectedYear}\n\n`;
    
    playersWithFees?.forEach(player => {
      content += `${player.name} (${(player.teams as any)?.name || 'N/A'}):\n`;
      MONTHS.forEach((month, idx) => {
        const isPaid = player.fees[idx + 1];
        content += `  ${month}: ${isPaid ? '✓ Pago' : '✗ Não pago'}\n`;
      });
      content += '\n';
    });

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mensalidades-${selectedYear}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Ficheiro exportado!');
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Mensalidades dos Jogadores</CardTitle>
            <CardDescription>Controle de pagamentos por escalão</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Equipa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {teams?.map(team => (
                  <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={exportToPDF}>
              <FileDown className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">Jogador</th>
                <th className="text-left p-2 font-medium">Equipa</th>
                {MONTHS.map((month, idx) => (
                  <th key={month} className="text-center p-2 font-medium text-xs">
                    {month.substring(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {playersWithFees?.map(player => (
                <tr key={player.id} className="border-b hover:bg-muted/50">
                  <td className="p-2 font-medium">{player.name}</td>
                  <td className="p-2 text-muted-foreground text-xs">
                    {(player.teams as any)?.name}
                  </td>
                  {MONTHS.map((_, idx) => {
                    const month = idx + 1;
                    const isPaid = player.fees[month];
                    return (
                      <td key={month} className="text-center p-1">
                        <button
                          onClick={() => togglePayment.mutate({ 
                            playerId: player.id, 
                            month, 
                            isPaid: !isPaid 
                          })}
                          className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                            isPaid 
                              ? 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' 
                              : 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {isPaid ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          
          {(!playersWithFees || playersWithFees.length === 0) && (
            <p className="text-center text-muted-foreground py-8">
              Nenhum jogador encontrado
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
