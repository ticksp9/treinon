import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { User, GraduationCap, Briefcase } from 'lucide-react';
import { CoachProfileForm } from '@/components/coaches/CoachProfileForm';
import { CoachDiplomas } from '@/components/coaches/CoachDiplomas';
import { CoachHistory } from '@/components/coaches/CoachHistory';
import { tx } from '@/lib/i18n/ui';

export default function CoachProfile() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  if (loading) {
    return (
      <AppLayout>
        <div>
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user) {
    return (
      <AppLayout>
        <div>
          <Card>
            <CardContent className="py-12 text-center">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">{tx('Sessão Necessária')}</h3>
              <p className="text-muted-foreground">
                {tx('Faça login para aceder ao seu perfil de treinador.')}
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
          <h1 className="text-2xl font-display font-bold">{tx('Perfil do Treinador')}</h1>
          <p className="text-muted-foreground">
            {tx('Gerir o seu currículo e formações')}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{tx('Perfil')}</span>
            </TabsTrigger>
            <TabsTrigger value="diplomas" className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4" />
              <span>{tx('Diplomas')}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              <span>{tx('Histórico')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <CoachProfileForm />
          </TabsContent>

          <TabsContent value="diplomas">
            <CoachDiplomas />
          </TabsContent>

          <TabsContent value="history">
            <CoachHistory />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
