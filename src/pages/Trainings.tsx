import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardList, Users, FileText, Calendar, Activity, LayoutDashboard } from 'lucide-react';
import { TrainingBuilder } from '@/components/coaches/TrainingBuilder';
import { TrainingAttendance } from '@/components/trainings/TrainingAttendance';
import { MatchCallup } from '@/components/trainings/MatchCallup';
import { TrainingWeeklyCalendar } from '@/components/trainings/TrainingWeeklyCalendar';
import { TrainingLoadView } from '@/components/trainings/TrainingLoadView';
import { TrainingDashboard } from '@/components/trainings/TrainingDashboard';
import { PageLoading } from '@/components/ui/page-states';

export default function Trainings() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <AppLayout title="Treinos">
        <PageLoading />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Treinos">
      <div className="space-y-6">
        <PageHeader
          title="Gestão de Treinos"
          description="Planear, registar presenças, monitorizar carga e gerar convocatórias"
          icon={<Calendar className="w-6 h-6 text-primary" />}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" className="flex items-center gap-1.5">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Painel</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Calendário</span>
            </TabsTrigger>
            <TabsTrigger value="builder" className="flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4" />
              <span className="hidden sm:inline">Criar Treinos</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Presenças</span>
            </TabsTrigger>
            <TabsTrigger value="load" className="flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Carga</span>
            </TabsTrigger>
            <TabsTrigger value="callup" className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Convocatória</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <TrainingDashboard onNavigate={setActiveTab} />
          </TabsContent>

          <TabsContent value="calendar" className="mt-6">
            <TrainingWeeklyCalendar />
          </TabsContent>

          <TabsContent value="builder" className="mt-6">
            <TrainingBuilder />
          </TabsContent>

          <TabsContent value="attendance" className="mt-6">
            <TrainingAttendance />
          </TabsContent>

          <TabsContent value="load" className="mt-6">
            <TrainingLoadView />
          </TabsContent>

          <TabsContent value="callup" className="mt-6">
            <MatchCallup />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
