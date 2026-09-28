import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CreditCard, Users } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface PaymentsTabProps {
  clubId: string;
}

interface OverduePlayer {
  player_id: string;
  player_name: string;
  team_name: string;
  age_group: string;
  months_overdue: number;
  total_amount: number;
}

export function PaymentsTab({ clubId }: PaymentsTabProps) {
  // Fetch players with overdue payments (2+ months)
  const { data: overduePayments, isLoading } = useQuery({
    queryKey: ['overdue-payments-by-team', clubId],
    queryFn: async () => {
      // Get all unpaid fees
      const { data: fees, error } = await supabase
        .from('player_fees')
        .select(`
          id,
          player_id,
          month,
          year,
          amount,
          players (
            id,
            name,
            team_id,
            teams (id, name, category)
          )
        `)
        .eq('club_id', clubId)
        .eq('is_paid', false)
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      
      if (error) throw error;

      // Group by player and count months
      const playerMap = new Map<string, {
        player_id: string;
        player_name: string;
        team_name: string;
        age_group: string;
        months: { month: number; year: number; amount: number }[];
      }>();

      fees?.forEach((fee: any) => {
        const key = fee.player_id;
        if (!playerMap.has(key)) {
          playerMap.set(key, {
            player_id: fee.player_id,
            player_name: fee.players?.name || 'Desconhecido',
            team_name: fee.players?.teams?.name || 'Sem equipa',
            age_group: fee.players?.teams?.category || 'Sem escalão',
            months: []
          });
        }
        playerMap.get(key)!.months.push({
          month: fee.month,
          year: fee.year,
          amount: fee.amount
        });
      });

      // Filter players with 2+ months overdue
      const overdueList: OverduePlayer[] = [];
      playerMap.forEach((player) => {
        if (player.months.length >= 2) {
          overdueList.push({
            player_id: player.player_id,
            player_name: player.player_name,
            team_name: player.team_name,
            age_group: player.age_group,
            months_overdue: player.months.length,
            total_amount: player.months.reduce((sum, m) => sum + m.amount, 0)
          });
        }
      });

      // Group by age_group
      const groupedByAgeGroup = overdueList.reduce((acc, player) => {
        if (!acc[player.age_group]) {
          acc[player.age_group] = [];
        }
        acc[player.age_group].push(player);
        return acc;
      }, {} as Record<string, OverduePlayer[]>);

      return {
        total: overdueList.length,
        byAgeGroup: groupedByAgeGroup,
        list: overdueList
      };
    },
    enabled: !!clubId
  });

  // Fetch payment summary by age group
  const { data: paymentSummary } = useQuery({
    queryKey: ['payment-summary-by-agegroup', clubId],
    queryFn: async () => {
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth() + 1;

      const { data, error } = await supabase
        .from('player_fees')
        .select(`
          is_paid,
          amount,
          players (
            teams (category)
          )
        `)
        .eq('club_id', clubId)
        .eq('year', currentYear);

      if (error) throw error;

      // Group by category
      const summary: Record<string, { paid: number; pending: number; total: number }> = {};
      
      data?.forEach((fee: any) => {
        const category = fee.players?.teams?.category || 'Sem escalão';
        if (!summary[category]) {
          summary[category] = { paid: 0, pending: 0, total: 0 };
        }
        summary[category].total += fee.amount;
        if (fee.is_paid) {
          summary[category].paid += fee.amount;
        } else {
          summary[category].pending += fee.amount;
        }
      });

      return summary;
    },
    enabled: !!clubId
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-PT', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Overdue Payments Alert */}
      {overduePayments && overduePayments.total > 0 && (
        <Card className="border-destructive">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Atletas com Pagamentos em Falta (+2 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Estes atletas <strong>NÃO podem ser convocados</strong> até regularizarem os pagamentos.
            </p>
            
            <Accordion type="multiple" className="w-full">
              {Object.entries(overduePayments.byAgeGroup).map(([ageGroup, players]) => (
                <AccordionItem key={ageGroup} value={ageGroup}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <span>{ageGroup}</span>
                      <Badge variant="destructive">{players.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Atleta</TableHead>
                          <TableHead>Equipa</TableHead>
                          <TableHead>Meses em Falta</TableHead>
                          <TableHead className="text-right">Valor Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {players.map((player) => (
                          <TableRow key={player.player_id}>
                            <TableCell className="font-medium">{player.player_name}</TableCell>
                            <TableCell>{player.team_name}</TableCell>
                            <TableCell>
                              <Badge variant="destructive">
                                {player.months_overdue} meses
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium text-destructive">
                              {formatCurrency(player.total_amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Payment Summary by Age Group */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Resumo de Pagamentos por Escalão
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">A carregar...</p>
          ) : paymentSummary && Object.keys(paymentSummary).length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Escalão</TableHead>
                  <TableHead className="text-right">Pago</TableHead>
                  <TableHead className="text-right">Pendente</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Taxa Cobrança</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(paymentSummary).map(([category, data]) => {
                  const rate = data.total > 0 ? (data.paid / data.total) * 100 : 0;
                  return (
                    <TableRow key={category}>
                      <TableCell className="font-medium">{category}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(data.paid)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(data.pending)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(data.total)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={rate >= 80 ? "default" : rate >= 50 ? "secondary" : "destructive"}>
                          {rate.toFixed(0)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                Não há dados de pagamentos registados.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button variant="outline" disabled>
              <Users className="h-4 w-4 mr-2" />
              Ver Todos os Atletas em Falta
            </Button>
            <Button variant="outline" disabled>
              Exportar Relatório
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Funcionalidades adicionais em desenvolvimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
