import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Calendar, 
  FileText, 
  CreditCard, 
  Settings,
  Plus,
  AlertTriangle,
  BarChart3,
  ArrowRightLeft,
  Bell,
  History
} from "lucide-react";
import { AgeGroupsTab } from "@/components/coordination/AgeGroupsTab";
import { TeamsTab } from "@/components/coordination/TeamsTab";
import { ScheduleTab } from "@/components/coordination/ScheduleTab";
import { DocumentsTab } from "@/components/coordination/DocumentsTab";
import { PaymentsTab } from "@/components/coordination/PaymentsTab";
import { ReportsTab } from "@/components/coordination/ReportsTab";
import { SeasonTransitionTab } from "@/components/coordination/SeasonTransitionTab";
import { NotificationsTab } from "@/components/coordination/NotificationsTab";
import { HistoryTab } from "@/components/coordination/HistoryTab";

export default function YouthCoordinationDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("teams");

  // Get user's club
  const { data: club } = useQuery({
    queryKey: ['user-club', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Check if user owns a club
      const { data: ownedClub } = await supabase
        .from('clubs')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();
      
      if (ownedClub) return ownedClub;
      
      // Check if user is staff of a club
      const { data: staffRecord } = await supabase
        .from('club_staff')
        .select('club_id, clubs(*)')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();
      
      return staffRecord?.clubs || null;
    },
    enabled: !!user?.id
  });

  // Get stats
  const { data: stats } = useQuery({
    queryKey: ['youth-coordination-stats', club?.id],
    queryFn: async () => {
      if (!club?.id) return null;
      
      const [ageGroups, teams, schedules, overduePayments] = await Promise.all([
        supabase.from('youth_age_groups').select('id', { count: 'exact' }).eq('club_id', club.id).eq('is_active', true),
        supabase.from('youth_teams').select('id', { count: 'exact' }).eq('club_id', club.id).eq('is_active', true),
        supabase.from('youth_training_schedules').select('id', { count: 'exact' }).eq('club_id', club.id).eq('is_active', true),
        supabase.from('player_fees').select('id', { count: 'exact' }).eq('club_id', club.id).eq('is_paid', false)
      ]);
      
      return {
        ageGroups: ageGroups.count || 0,
        teams: teams.count || 0,
        schedules: schedules.count || 0,
        overduePayments: overduePayments.count || 0
      };
    },
    enabled: !!club?.id
  });

  if (!club) {
    return (
      <AppLayout>
        <div className="container py-8">
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                Não foi possível carregar informações do clube.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Coordenação das Camadas Jovens</h1>
            <p className="text-muted-foreground">
              Gestão centralizada de escalões, equipas, horários e pagamentos
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Escalões</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.ageGroups || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Equipas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.teams || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Horários</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.schedules || 0}</div>
            </CardContent>
          </Card>
          
          <Card className={stats?.overduePayments && stats.overduePayments > 0 ? "border-destructive" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pagamentos em Falta</CardTitle>
              {stats?.overduePayments && stats.overduePayments > 0 ? (
                <AlertTriangle className="h-4 w-4 text-destructive" />
              ) : (
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stats?.overduePayments && stats.overduePayments > 0 ? 'text-destructive' : ''}`}>
                {stats?.overduePayments || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="teams" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Equipas</span>
            </TabsTrigger>
            <TabsTrigger value="age-groups" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Escalões</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Horários</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Documentos</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Pagamentos</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alertas</span>
            </TabsTrigger>
            <TabsTrigger value="transition" className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Transição</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="teams">
            <TeamsTab clubId={club.id} />
          </TabsContent>

          <TabsContent value="age-groups">
            <AgeGroupsTab clubId={club.id} />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleTab clubId={club.id} />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentsTab clubId={club.id} />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentsTab clubId={club.id} />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsTab clubId={club.id} />
          </TabsContent>

          <TabsContent value="transition">
            <SeasonTransitionTab clubId={club.id} />
          </TabsContent>

          <TabsContent value="reports">
            <ReportsTab clubId={club.id} />
          </TabsContent>

          <TabsContent value="history">
            <HistoryTab clubId={club.id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
