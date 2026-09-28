import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AcademyOverviewTab } from '@/components/academy/AcademyOverviewTab';
import { AcademyAthletesTab } from '@/components/academy/AcademyAthletesTab';
import { AcademyAssessmentsTab } from '@/components/academy/AcademyAssessmentsTab';
import { AcademyDevelopmentTab } from '@/components/academy/AcademyDevelopmentTab';
import { AcademyPathwayTab } from '@/components/academy/AcademyPathwayTab';
import { AcademyComplianceTab } from '@/components/academy/AcademyComplianceTab';
import { AcademyStaffTab } from '@/components/academy/AcademyStaffTab';

export default function AcademyDashboard() {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <PageHeader
          title="Formação & Academia"
          description="Programa de formação, avaliações, desenvolvimento e pathway dos atletas"
        />

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="athletes">Atletas</TabsTrigger>
            <TabsTrigger value="assessments">Avaliações</TabsTrigger>
            <TabsTrigger value="development">Desenvolvimento</TabsTrigger>
            <TabsTrigger value="pathway">Pathway</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><AcademyOverviewTab /></TabsContent>
          <TabsContent value="athletes"><AcademyAthletesTab /></TabsContent>
          <TabsContent value="assessments"><AcademyAssessmentsTab /></TabsContent>
          <TabsContent value="development"><AcademyDevelopmentTab /></TabsContent>
          <TabsContent value="pathway"><AcademyPathwayTab /></TabsContent>
          <TabsContent value="staff"><AcademyStaffTab /></TabsContent>
          <TabsContent value="compliance"><AcademyComplianceTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
