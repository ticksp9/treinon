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
import { tx } from '@/lib/i18n/ui';

export default function MedicalDashboard() {
  const { hasPhysioAccess, loading } = usePhysioAccess();

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
        </div>
      </AppLayout>
    );
  }

  if (!hasPhysioAccess) {
    return (
      <AppLayout>
        <div>
          <Card>
            <CardContent className="py-12 text-center">
              <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{tx('Acesso Restrito')}</h3>
              <p className="text-muted-foreground">
                {tx('Módulo disponível apenas para staff médico e administradores.')}
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Heart className="w-6 h-6 text-primary" />
            {tx('Saúde & Medicina Desportiva')}
          </h1>
          <p className="text-muted-foreground">
            {tx('Gestão de saúde, exames, aptidão, lesões, fisioterapia e compliance médico')}
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">{tx('Visão Geral')}</TabsTrigger>
            <TabsTrigger value="exams">{tx('Exames')}</TabsTrigger>
            <TabsTrigger value="clearances">{tx('Aptidão')}</TabsTrigger>
            <TabsTrigger value="injuries">{tx('Lesões')}</TabsTrigger>
            <TabsTrigger value="physio">{tx('Fisioterapia')}</TabsTrigger>
            <TabsTrigger value="rtp">{tx('Retorno')}</TabsTrigger>
            <TabsTrigger value="compliance">{tx('Compliance')}</TabsTrigger>
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
