import { useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Building2, 
  FileText, 
  History, 
  Save, 
  Upload,
  Plus,
  Trash2,
  AlertCircle,
  Globe,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { pt } from 'date-fns/locale';

import { PublicPageSettings } from '@/components/club/PublicPageSettings';

export default function ClubProfile() {
  const { isClubAdmin, clubId, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState('perfil');
  const queryClient = useQueryClient();

  const { data: club, isLoading: clubLoading } = useQuery({
    queryKey: ['club-profile', clubId],
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

  const { data: documents, isLoading: docsLoading } = useQuery({
    queryKey: ['club-documents', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('club_documents')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  if (roleLoading || clubLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!isClubAdmin || !clubId) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
              <p className="text-muted-foreground">
                Esta funcionalidade está disponível apenas para administradores de clubes.
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
        <div className="flex items-center gap-4">
          {club?.logo_url ? (
            <img 
              src={club.logo_url} 
              alt={club.name} 
              className="w-16 h-16 rounded-lg object-cover border border-border"
            />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-display font-bold">{club?.name || 'Perfil do Clube'}</h1>
            <p className="text-muted-foreground">
              Gerir informações e documentos do clube
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="perfil" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="historia" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              História
            </TabsTrigger>
            <TabsTrigger value="publica" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Página pública
            </TabsTrigger>
            <TabsTrigger value="documentos" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documentos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="perfil" className="space-y-6 mt-6">
            <ClubProfileForm club={club} clubId={clubId} />
          </TabsContent>

          <TabsContent value="historia" className="space-y-6 mt-6">
            <ClubHistoryForm club={club} clubId={clubId} />
          </TabsContent>

          <TabsContent value="publica" className="space-y-6 mt-6">
            <PublicPageSettings club={club} clubId={clubId} />
          </TabsContent>

          <TabsContent value="documentos" className="space-y-6 mt-6">
            <ClubDocuments documents={documents || []} clubId={clubId} isLoading={docsLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function ClubProfileForm({ club, clubId }: { club: any; clubId: string }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: club?.name || '',
    email: club?.email || '',
    phone: club?.phone || '',
    address: club?.address || '',
    nif: club?.nif || '',
    iban: club?.iban || '',
    founded_year: club?.founded_year || '',
    primary_color: club?.primary_color || '#1e40af',
    secondary_color: club?.secondary_color || '#ffffff',
    facebook_url: club?.facebook_url || '',
    instagram_url: club?.instagram_url || '',
    twitter_url: club?.twitter_url || '',
    website_url: club?.website_url || '',
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('clubs')
        .update(data)
        .eq('id', clubId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-profile', clubId] });
      toast.success('Perfil do clube atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar perfil');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações do Clube</CardTitle>
        <CardDescription>Dados gerais e contactos</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(formData); }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Clube</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="founded_year">Ano de Fundação</Label>
              <Input 
                id="founded_year" 
                type="number"
                value={formData.founded_year} 
                onChange={(e) => setFormData(prev => ({ ...prev, founded_year: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email"
                value={formData.email} 
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input 
                id="phone" 
                value={formData.phone} 
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Morada</Label>
              <Input 
                id="address" 
                value={formData.address} 
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nif">NIF</Label>
              <Input 
                id="nif" 
                value={formData.nif} 
                onChange={(e) => setFormData(prev => ({ ...prev, nif: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input 
                id="iban" 
                value={formData.iban} 
                onChange={(e) => setFormData(prev => ({ ...prev, iban: e.target.value }))}
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-4">Cores do Clube</h4>
            <div className="flex gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Cor Principal</Label>
                <div className="flex gap-2">
                  <Input 
                    id="primary_color" 
                    type="color"
                    className="w-12 h-10 p-1"
                    value={formData.primary_color} 
                    onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                  />
                  <Input 
                    value={formData.primary_color} 
                    onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="w-28"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary_color">Cor Secundária</Label>
                <div className="flex gap-2">
                  <Input 
                    id="secondary_color" 
                    type="color"
                    className="w-12 h-10 p-1"
                    value={formData.secondary_color} 
                    onChange={(e) => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                  />
                  <Input 
                    value={formData.secondary_color} 
                    onChange={(e) => setFormData(prev => ({ ...prev, secondary_color: e.target.value }))}
                    className="w-28"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-4">Redes Sociais</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website_url">Website</Label>
                <Input 
                  id="website_url" 
                  placeholder="https://"
                  value={formData.website_url} 
                  onChange={(e) => setFormData(prev => ({ ...prev, website_url: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebook_url">Facebook</Label>
                <Input 
                  id="facebook_url" 
                  placeholder="https://facebook.com/..."
                  value={formData.facebook_url} 
                  onChange={(e) => setFormData(prev => ({ ...prev, facebook_url: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagram_url">Instagram</Label>
                <Input 
                  id="instagram_url" 
                  placeholder="https://instagram.com/..."
                  value={formData.instagram_url} 
                  onChange={(e) => setFormData(prev => ({ ...prev, instagram_url: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitter_url">Twitter/X</Label>
                <Input 
                  id="twitter_url" 
                  placeholder="https://twitter.com/..."
                  value={formData.twitter_url} 
                  onChange={(e) => setFormData(prev => ({ ...prev, twitter_url: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={updateMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ClubHistoryForm({ club, clubId }: { club: any; clubId: string }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    history: club?.history || '',
    objectives: club?.objectives || '',
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('clubs')
        .update(data)
        .eq('id', clubId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-profile', clubId] });
      toast.success('História do clube atualizada');
    },
    onError: () => {
      toast.error('Erro ao atualizar história');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>História e Objetivos</CardTitle>
        <CardDescription>Conte a história do clube e defina os objetivos</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); updateMutation.mutate(formData); }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="history">História do Clube</Label>
            <Textarea 
              id="history" 
              rows={8}
              placeholder="Descreva a história do clube, fundação, conquistas..."
              value={formData.history} 
              onChange={(e) => setFormData(prev => ({ ...prev, history: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="objectives">Objetivos</Label>
            <Textarea 
              id="objectives" 
              rows={4}
              placeholder="Defina os objetivos atuais do clube..."
              value={formData.objectives} 
              onChange={(e) => setFormData(prev => ({ ...prev, objectives: e.target.value }))}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={updateMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ClubDocuments({ documents, clubId, isLoading }: { documents: any[]; clubId: string; isLoading: boolean }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('club_documents')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-documents', clubId] });
      toast.success('Documento eliminado');
    },
    onError: () => {
      toast.error('Erro ao eliminar documento');
    },
  });

  if (isLoading) {
    return <Skeleton className="h-48" />;
  }

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const days = differenceInDays(new Date(expiryDate), new Date());
    if (days < 0) return { color: 'text-red-600 bg-red-50', label: 'Expirado' };
    if (days < 30) return { color: 'text-amber-600 bg-amber-50', label: `Expira em ${days} dias` };
    return { color: 'text-green-600 bg-green-50', label: 'Válido' };
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium">Documentos do Clube</h3>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Documento
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum documento registado</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const status = getExpiryStatus(doc.expiry_date);
            return (
              <Card key={doc.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <FileText className="w-8 h-8 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        <p className="text-sm text-muted-foreground">{doc.document_type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {status && (
                        <span className={`text-xs px-2 py-1 rounded ${status.color}`}>
                          {status.label}
                        </span>
                      )}
                      {doc.expiry_date && (
                        <span className="text-sm text-muted-foreground">
                          Validade: {format(new Date(doc.expiry_date), 'dd/MM/yyyy')}
                        </span>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => deleteMutation.mutate(doc.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
