import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Bell, Mail, Phone } from 'lucide-react';

interface OverduePaymentsProps {
  clubId: string;
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function OverduePayments({ clubId }: OverduePaymentsProps) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedTeam, setSelectedTeam] = useState<string>('all');

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

  // Fetch players with overdue payments
  const { data: overdueData, isLoading } = useQuery({
    queryKey: ['overdue-payments', clubId, selectedTeam],
    queryFn: async () => {
      let query = supabase
        .from('players')
        .select(`
          id, name, number, parent_name, parent_phone, parent_email,
          team_id,
          teams!inner(id, name, category)
        `)
        .eq('is_active', true);

      if (selectedTeam !== 'all') {
        query = query.eq('team_id', selectedTeam);
      } else {
        const teamIds = teams?.map(t => t.id) || [];
        if (teamIds.length > 0) {
          query = query.in('team_id', teamIds);
        }
      }

      const { data: players, error } = await query.order('name');
      if (error) throw error;

      // Check overdue for each player
      const playersWithOverdue = await Promise.all(
        (players || []).map(async (player) => {
          const { data: fees } = await supabase
            .from('player_fees')
            .select('month, year, is_paid')
            .eq('player_id', player.id)
            .eq('year', currentYear);

          // Calculate overdue months
          const paidMonths = new Set(
            fees?.filter(f => f.is_paid).map(f => f.month) || []
          );

          const overdueMonths: number[] = [];
          for (let month = 1; month < currentMonth; month++) {
            if (!paidMonths.has(month)) {
              overdueMonths.push(month);
            }
          }

          return {
            ...player,
            overdueMonths,
            overdueCount: overdueMonths.length,
          };
        })
      );

      // Filter only players with overdue
      return playersWithOverdue.filter(p => p.overdueCount > 0).sort((a, b) => b.overdueCount - a.overdueCount);
    },
    enabled: !!clubId && !!teams,
  });

  const sendNotification = (player: any) => {
    // In a real app, this would send an email/SMS
    toast.success(`Notificação enviada para ${player.parent_email || player.parent_phone || 'encarregado'}`);
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  const criticalOverdue = overdueData?.filter(p => p.overdueCount >= 2) || [];
  const warningOverdue = overdueData?.filter(p => p.overdueCount === 1) || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total em Atraso</p>
                <p className="text-2xl font-bold">{overdueData?.length || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">+2 Meses Atraso</p>
                <p className="text-2xl font-bold text-red-600">{criticalOverdue.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">1 Mês Atraso</p>
                <p className="text-2xl font-bold text-amber-600">{warningOverdue.length}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por equipa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Equipas</SelectItem>
            {teams?.map(team => (
              <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Critical (2+ months) */}
      {criticalOverdue.length > 0 && (
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Pagamentos Críticos (+2 meses)
            </CardTitle>
            <CardDescription>Estes jogadores têm mais de 2 meses de mensalidades em atraso</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {criticalOverdue.map(player => (
                <div key={player.id} className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div>
                    <p className="font-medium">{player.name}</p>
                    <p className="text-sm text-muted-foreground">{(player.teams as any)?.name}</p>
                    <div className="flex gap-1 mt-1">
                      {player.overdueMonths.map((month: number) => (
                        <Badge key={month} variant="destructive" className="text-xs">
                          {MONTHS[month - 1].substring(0, 3)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    {player.parent_phone && (
                      <a href={`tel:${player.parent_phone}`} className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {player.parent_phone}
                      </a>
                    )}
                    {player.parent_email && (
                      <a href={`mailto:${player.parent_email}`} className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {player.parent_email}
                      </a>
                    )}
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => sendNotification(player)}
                    >
                      <Bell className="w-3 h-3 mr-1" />
                      Notificar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Warning (1 month) */}
      {warningOverdue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Pagamentos em Atraso (1 mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {warningOverdue.map(player => (
                <div key={player.id} className="flex items-center justify-between p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div>
                    <p className="font-medium">{player.name}</p>
                    <p className="text-sm text-muted-foreground">{(player.teams as any)?.name}</p>
                    <Badge variant="outline" className="mt-1 text-amber-600 border-amber-300">
                      {MONTHS[player.overdueMonths[0] - 1]}
                    </Badge>
                  </div>
                  <div className="flex flex-col gap-1 text-right">
                    {player.parent_phone && (
                      <span className="text-xs text-muted-foreground">{player.parent_phone}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {overdueData?.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Não há pagamentos em atraso</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
