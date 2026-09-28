import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { Building2, TrendingUp, Settings } from 'lucide-react';
import { ClubInfo } from '@/components/club/ClubInfo';
import { ClubFinanceChart } from '@/components/club/ClubFinanceChart';
import { ClubSettings } from '@/components/club/ClubSettings';
import { SecurityPinSettings } from '@/components/security/SecurityPinSettings';
import { PageLoading, AccessDenied } from '@/components/ui/page-states';

export default function Club() {
  const { user } = useAuth();
  const { isClubAdmin, clubId, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: club, isLoading: clubLoading } = useQuery({
    queryKey: ['club', clubId],
    queryFn: async () => {
      if (!clubId) return null;
      const { data, error } = await supabase
        .from('clubs')
        .select('*')
        .eq('id', clubId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  if (roleLoading || clubLoading) {
    return (
      <AppLayout title="Clube">
        <PageLoading />
      </AppLayout>
    );
  }

  if (!isClubAdmin) {
    return (
      <AppLayout title="Clube">
        <AccessDenied message="Esta funcionalidade está disponível apenas para administradores de clubes." />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Clube">
      <div className="space-y-6">
        <PageHeader
          title={club?.name || 'Clube'}
          description={club?.founded_year ? `Fundado em ${club.founded_year}` : 'Gestão do clube'}
          icon={
            club?.logo_url ? (
              <img src={club.logo_url} alt={club.name} className="w-12 h-12 rounded-xl object-cover border border-border" />
            ) : (
              <Building2 className="w-6 h-6 text-primary" />
            )
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Informação</span>
            </TabsTrigger>
            <TabsTrigger value="finances" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Finanças</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Definições</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 mt-6">
            <ClubInfo club={club} clubId={clubId!} />
          </TabsContent>
          <TabsContent value="finances" className="space-y-6 mt-6">
            <ClubFinanceChart clubId={clubId!} />
          </TabsContent>
          <TabsContent value="settings" className="space-y-6 mt-6">
            <SecurityPinSettings />
            <ClubSettings clubId={clubId!} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
