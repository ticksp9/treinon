import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Ticket, Handshake, Receipt, AlertTriangle, DollarSign, Wallet } from 'lucide-react';
import { PlayerFees } from '@/components/finances/PlayerFees';
import { MemberFees } from '@/components/finances/MemberFees';
import { TicketSales } from '@/components/finances/TicketSales';
import { Sponsors } from '@/components/finances/Sponsors';
import { TransactionsList } from '@/components/finances/TransactionsList';
import { OverduePayments } from '@/components/finances/OverduePayments';
import { PageLoading, AccessDenied } from '@/components/ui/page-states';
import { useState } from 'react';

export default function Finances() {
  const { user } = useAuth();
  const { isClubAdmin, clubId, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState('player-fees');

  if (roleLoading) {
    return (
      <AppLayout title="Finanças">
        <PageLoading />
      </AppLayout>
    );
  }

  if (!isClubAdmin || !clubId) {
    return (
      <AppLayout title="Finanças">
        <AccessDenied message="Esta funcionalidade está disponível apenas para administradores de clubes." />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Finanças">
      <div className="space-y-6">
        <PageHeader
          title="Finanças"
          description="Gestão financeira do clube"
          icon={<Wallet className="w-6 h-6 text-primary" />}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="player-fees" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Mensalidades</span>
            </TabsTrigger>
            <TabsTrigger value="overdue" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span className="hidden sm:inline">Em Atraso</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Sócios</span>
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <Ticket className="w-4 h-4" />
              <span className="hidden sm:inline">Bilheteira</span>
            </TabsTrigger>
            <TabsTrigger value="sponsors" className="flex items-center gap-2">
              <Handshake className="w-4 h-4" />
              <span className="hidden sm:inline">Patrocínios</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              <span className="hidden sm:inline">Transações</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="player-fees" className="space-y-6 mt-6">
            <PlayerFees clubId={clubId} />
          </TabsContent>
          <TabsContent value="overdue" className="space-y-6 mt-6">
            <OverduePayments clubId={clubId} />
          </TabsContent>
          <TabsContent value="members" className="space-y-6 mt-6">
            <MemberFees clubId={clubId} />
          </TabsContent>
          <TabsContent value="tickets" className="space-y-6 mt-6">
            <TicketSales clubId={clubId} />
          </TabsContent>
          <TabsContent value="sponsors" className="space-y-6 mt-6">
            <Sponsors clubId={clubId} />
          </TabsContent>
          <TabsContent value="transactions" className="space-y-6 mt-6">
            <TransactionsList clubId={clubId} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
