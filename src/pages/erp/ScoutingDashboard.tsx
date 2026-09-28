import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScoutingOverviewTab } from '@/components/scouting/ScoutingOverviewTab';
import { ProspectsTab } from '@/components/scouting/ProspectsTab';
import { ObservationsTab } from '@/components/scouting/ObservationsTab';
import { WatchlistsTab } from '@/components/scouting/WatchlistsTab';
import { ShortlistsTab } from '@/components/scouting/ShortlistsTab';
import { PipelineTab } from '@/components/scouting/PipelineTab';
import { TrialsTab } from '@/components/scouting/TrialsTab';
import { RecruitmentNeedsTab } from '@/components/scouting/RecruitmentNeedsTab';

export default function ScoutingDashboard() {
  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Scouting & Recrutamento</h1>
          <p className="text-muted-foreground">Gestão de talento, observação e pipeline de recrutamento</p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="prospects">Prospects</TabsTrigger>
            <TabsTrigger value="observations">Observações</TabsTrigger>
            <TabsTrigger value="watchlists">Watchlists</TabsTrigger>
            <TabsTrigger value="shortlists">Shortlists</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="trials">Trials</TabsTrigger>
            <TabsTrigger value="needs">Necessidades</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><ScoutingOverviewTab /></TabsContent>
          <TabsContent value="prospects"><ProspectsTab /></TabsContent>
          <TabsContent value="observations"><ObservationsTab /></TabsContent>
          <TabsContent value="watchlists"><WatchlistsTab /></TabsContent>
          <TabsContent value="shortlists"><ShortlistsTab /></TabsContent>
          <TabsContent value="pipeline"><PipelineTab /></TabsContent>
          <TabsContent value="trials"><TrialsTab /></TabsContent>
          <TabsContent value="needs"><RecruitmentNeedsTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
