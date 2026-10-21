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
import { tx } from '@/lib/i18n/ui';

export default function AcademyDashboard() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          title={tx('Formação & Academia')}
          description={tx('Programa de formação, avaliações, desenvolvimento e pathway dos atletas')}
        />

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview">{tx('Visão Geral')}</TabsTrigger>
            <TabsTrigger value="athletes">{tx('Atletas')}</TabsTrigger>
            <TabsTrigger value="assessments">{tx('Avaliações')}</TabsTrigger>
            <TabsTrigger value="development">{tx('Desenvolvimento')}</TabsTrigger>
            <TabsTrigger value="pathway">{tx('Pathway')}</TabsTrigger>
            <TabsTrigger value="staff">{tx('Staff')}</TabsTrigger>
            <TabsTrigger value="compliance">{tx('Compliance')}</TabsTrigger>
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
