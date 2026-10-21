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
import { tx } from '@/lib/i18n/ui';

export default function ScoutingDashboard() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">{tx('Scouting & Recrutamento')}</h1>
          <p className="text-muted-foreground">{tx('Gestão de talento, observação e pipeline de recrutamento')}</p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">{tx('Visão Geral')}</TabsTrigger>
            <TabsTrigger value="prospects">{tx('Prospects')}</TabsTrigger>
            <TabsTrigger value="observations">{tx('Observações')}</TabsTrigger>
            <TabsTrigger value="watchlists">{tx('Watchlists')}</TabsTrigger>
            <TabsTrigger value="shortlists">{tx('Shortlists')}</TabsTrigger>
            <TabsTrigger value="pipeline">{tx('Pipeline')}</TabsTrigger>
            <TabsTrigger value="trials">{tx('Trials')}</TabsTrigger>
            <TabsTrigger value="needs">{tx('Necessidades')}</TabsTrigger>
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
