import { usePhysioAccess } from '@/hooks/usePhysioAccess';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Heart } from 'lucide-react';
import { MedicalOverviewTab } from '@/components/medical/MedicalOverviewTab';
import { ExamsTab } from '@/components/medical/ExamsTab';
import { ClearancesTab } from '@/components/medical/ClearancesTab';
import { InjuryCasesTab } from '@/components/medical/InjuryCasesTab';
import { PhysioSessionsTab } from '@/components/medical/PhysioSessionsTab';
import { ReturnToPlayTab } from '@/components/medical/ReturnToPlayTab';
import { MedicalComplianceTab } from '@/components/medical/MedicalComplianceTab';

export default function MedicalDashboard() {
  const { hasPhysioAccess, loading } = usePhysioAccess();

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  if (!hasPhysioAccess) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
              <p className="text-muted-foreground">
                Módulo disponível apenas para staff médico e administradores.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Heart className="w-6 h-6 text-primary" />
            Saúde & Medicina Desportiva
          </h1>
          <p className="text-muted-foreground">
            Gestão de saúde, exames, aptidão, lesões, fisioterapia e compliance médico
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="exams">Exames</TabsTrigger>
            <TabsTrigger value="clearances">Aptidão</TabsTrigger>
            <TabsTrigger value="injuries">Lesões</TabsTrigger>
            <TabsTrigger value="physio">Fisioterapia</TabsTrigger>
            <TabsTrigger value="rtp">Retorno</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><MedicalOverviewTab /></TabsContent>
          <TabsContent value="exams"><ExamsTab /></TabsContent>
          <TabsContent value="clearances"><ClearancesTab /></TabsContent>
          <TabsContent value="injuries"><InjuryCasesTab /></TabsContent>
          <TabsContent value="physio"><PhysioSessionsTab /></TabsContent>
          <TabsContent value="rtp"><ReturnToPlayTab /></TabsContent>
          <TabsContent value="compliance"><MedicalComplianceTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
