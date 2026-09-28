import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  FileWarning, 
  CreditCard, 
  Calendar,
  User,
  Users
} from "lucide-react";
import { format, differenceInDays, addDays } from "date-fns";
import { pt } from "date-fns/locale";

interface NotificationsTabProps {
  clubId: string;
}

interface PlayerWithIssue {
  id: string;
  name: string;
  team_name?: string;
  issue_type: 'medical_expiring' | 'medical_expired' | 'document_expiring' | 'document_expired' | 'overdue_payment';
  days_until?: number;
  months_overdue?: number;
  details?: string;
}

export function NotificationsTab({ clubId }: NotificationsTabProps) {
  // Fetch players with expiring/expired documents
  const { data: documentAlerts, isLoading: loadingDocs } = useQuery({
    queryKey: ['coordination-document-alerts', clubId],
    queryFn: async () => {
      const today = new Date();
      const alertThreshold = addDays(today, 30);
      
      const { data: players, error } = await supabase
        .from('players')
        .select(`
          id, 
          name, 
          medical_certificate_expiry,
          id_document_expiry,
          team:teams(name)
        `)
        .eq('is_active', true);
      
      if (error) throw error;
      
      const alerts: PlayerWithIssue[] = [];
      
      players?.forEach(player => {
        // Check medical certificate
        if (player.medical_certificate_expiry) {
          const expiryDate = new Date(player.medical_certificate_expiry);
          const daysUntil = differenceInDays(expiryDate, today);
          
          if (daysUntil < 0) {
            alerts.push({
              id: player.id,
              name: player.name,
              team_name: player.team?.name,
              issue_type: 'medical_expired',
              days_until: Math.abs(daysUntil),
              details: `Expirou a ${format(expiryDate, "dd/MM/yyyy")}`
            });
          } else if (daysUntil <= 30) {
            alerts.push({
              id: player.id,
              name: player.name,
              team_name: player.team?.name,
              issue_type: 'medical_expiring',
              days_until: daysUntil,
              details: `Expira a ${format(expiryDate, "dd/MM/yyyy")}`
            });
          }
        }
        
        // Check ID document
        if (player.id_document_expiry) {
          const expiryDate = new Date(player.id_document_expiry);
          const daysUntil = differenceInDays(expiryDate, today);
          
          if (daysUntil < 0) {
            alerts.push({
              id: player.id,
              name: player.name,
              team_name: player.team?.name,
              issue_type: 'document_expired',
              days_until: Math.abs(daysUntil),
              details: `Expirou a ${format(expiryDate, "dd/MM/yyyy")}`
            });
          } else if (daysUntil <= 30) {
            alerts.push({
              id: player.id,
              name: player.name,
              team_name: player.team?.name,
              issue_type: 'document_expiring',
              days_until: daysUntil,
              details: `Expira a ${format(expiryDate, "dd/MM/yyyy")}`
            });
          }
        }
      });
      
      return alerts;
    },
    enabled: !!clubId
  });

  // Fetch players with overdue payments (> 2 months)
  const { data: paymentAlerts, isLoading: loadingPayments } = useQuery({
    queryKey: ['coordination-payment-alerts', clubId],
    queryFn: async () => {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      
      // Get all unpaid fees
      const { data: unpaidFees, error } = await supabase
        .from('player_fees')
        .select(`
          player_id,
          month,
          year,
          amount,
          player:players(id, name, team:teams(name))
        `)
        .eq('club_id', clubId)
        .eq('is_paid', false);
      
      if (error) throw error;
      
      // Group by player and count overdue months
      const playerOverdue: Record<string, { 
        player: { id: string; name: string; team_name?: string };
        overdueMonths: number;
        totalAmount: number;
      }> = {};
      
      unpaidFees?.forEach(fee => {
        // Calculate months overdue
        const feeDate = new Date(fee.year, fee.month - 1);
        const monthsDiff = (currentYear - fee.year) * 12 + (currentMonth - fee.month);
        
        if (monthsDiff >= 2) {
          const playerId = fee.player_id;
          if (!playerOverdue[playerId]) {
            playerOverdue[playerId] = {
              player: { 
                id: fee.player?.id || playerId, 
                name: fee.player?.name || 'Desconhecido',
                team_name: fee.player?.team?.name
              },
              overdueMonths: 0,
              totalAmount: 0
            };
          }
          playerOverdue[playerId].overdueMonths++;
          playerOverdue[playerId].totalAmount += fee.amount;
        }
      });
      
      return Object.values(playerOverdue).map(p => ({
        id: p.player.id,
        name: p.player.name,
        team_name: p.player.team_name,
        issue_type: 'overdue_payment' as const,
        months_overdue: p.overdueMonths,
        details: `${p.overdueMonths} meses em atraso (€${p.totalAmount.toFixed(2)})`
      }));
    },
    enabled: !!clubId
  });

  const isLoading = loadingDocs || loadingPayments;
  
  const expiredMedical = documentAlerts?.filter(a => a.issue_type === 'medical_expired') || [];
  const expiringMedical = documentAlerts?.filter(a => a.issue_type === 'medical_expiring') || [];
  const expiredDocs = documentAlerts?.filter(a => a.issue_type === 'document_expired') || [];
  const expiringDocs = documentAlerts?.filter(a => a.issue_type === 'document_expiring') || [];
  const overduePayments = paymentAlerts || [];

  const totalAlerts = (documentAlerts?.length || 0) + overduePayments.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Notificações e Alertas
            {totalAlerts > 0 && (
              <Badge variant="destructive">{totalAlerts}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">A carregar...</p>
          ) : totalAlerts === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Não há alertas ativos.</p>
              <p className="text-sm text-muted-foreground mt-2">
                Os alertas aparecem quando há documentos a expirar ou pagamentos em atraso.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Expired Medical Certificates */}
              {expiredMedical.length > 0 && (
                <Alert variant="destructive">
                  <FileWarning className="h-4 w-4" />
                  <AlertTitle>Atestados Médicos Expirados ({expiredMedical.length})</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1">
                      {expiredMedical.map(alert => (
                        <div key={`${alert.id}-med-exp`} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            {alert.name}
                            {alert.team_name && (
                              <Badge variant="outline" className="text-xs">{alert.team_name}</Badge>
                            )}
                          </span>
                          <span>{alert.details}</span>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Expiring Medical Certificates */}
              {expiringMedical.length > 0 && (
                <Alert>
                  <Calendar className="h-4 w-4" />
                  <AlertTitle>Atestados Médicos a Expirar ({expiringMedical.length})</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1">
                      {expiringMedical.map(alert => (
                        <div key={`${alert.id}-med-expiring`} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            {alert.name}
                            {alert.team_name && (
                              <Badge variant="outline" className="text-xs">{alert.team_name}</Badge>
                            )}
                          </span>
                          <span>
                            {alert.days_until === 0 ? 'Expira hoje' : 
                             alert.days_until === 1 ? 'Expira amanhã' : 
                             `Expira em ${alert.days_until} dias`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Expired Documents */}
              {expiredDocs.length > 0 && (
                <Alert variant="destructive">
                  <FileWarning className="h-4 w-4" />
                  <AlertTitle>Documentos de Identificação Expirados ({expiredDocs.length})</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1">
                      {expiredDocs.map(alert => (
                        <div key={`${alert.id}-doc-exp`} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            {alert.name}
                            {alert.team_name && (
                              <Badge variant="outline" className="text-xs">{alert.team_name}</Badge>
                            )}
                          </span>
                          <span>{alert.details}</span>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Expiring Documents */}
              {expiringDocs.length > 0 && (
                <Alert>
                  <Calendar className="h-4 w-4" />
                  <AlertTitle>Documentos a Expirar ({expiringDocs.length})</AlertTitle>
                  <AlertDescription>
                    <div className="mt-2 space-y-1">
                      {expiringDocs.map(alert => (
                        <div key={`${alert.id}-doc-expiring`} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            {alert.name}
                            {alert.team_name && (
                              <Badge variant="outline" className="text-xs">{alert.team_name}</Badge>
                            )}
                          </span>
                          <span>
                            {alert.days_until === 0 ? 'Expira hoje' : 
                             alert.days_until === 1 ? 'Expira amanhã' : 
                             `Expira em ${alert.days_until} dias`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Overdue Payments */}
              {overduePayments.length > 0 && (
                <Alert variant="destructive">
                  <CreditCard className="h-4 w-4" />
                  <AlertTitle>
                    Pagamentos em Atraso - Bloqueio de Convocatórias ({overduePayments.length})
                  </AlertTitle>
                  <AlertDescription>
                    <p className="text-sm mb-2">
                      Estes jogadores têm mensalidades em atraso há mais de 2 meses e estão bloqueados para convocatórias.
                    </p>
                    <div className="mt-2 space-y-1">
                      {overduePayments.map(alert => (
                        <div key={`${alert.id}-payment`} className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            {alert.name}
                            {alert.team_name && (
                              <Badge variant="outline" className="text-xs">{alert.team_name}</Badge>
                            )}
                          </span>
                          <Badge variant="destructive">{alert.details}</Badge>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
