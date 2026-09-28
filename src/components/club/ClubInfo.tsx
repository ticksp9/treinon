import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit, Save, X, Upload, Building2, History, Target, Mail, Phone, MapPin, Calendar } from 'lucide-react';

interface ClubInfoProps {
  club: any;
  clubId: string;
}

export function ClubInfo({ club, clubId }: ClubInfoProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: club?.name || '',
    email: club?.email || '',
    phone: club?.phone || '',
    address: club?.address || '',
    founded_year: club?.founded_year?.toString() || '',
    history: club?.history || '',
    objectives: club?.objectives || '',
    logo_url: club?.logo_url || '',
  });

  const updateClub = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('clubs')
        .update({
          name: data.name,
          email: data.email || null,
          phone: data.phone || null,
          address: data.address || null,
          founded_year: data.founded_year ? parseInt(data.founded_year) : null,
          history: data.history || null,
          objectives: data.objectives || null,
          logo_url: data.logo_url || null,
        })
        .eq('id', clubId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club', clubId] });
      toast.success('Informação do clube atualizada!');
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast.error('Erro ao atualizar: ' + error.message);
    },
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/club-logo.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('coach-documents')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error('Erro ao carregar logo');
      return;
    }

    const { data: urlData } = supabase.storage
      .from('coach-documents')
      .getPublicUrl(filePath);

    setFormData({ ...formData, logo_url: urlData.publicUrl });
    toast.success('Logo carregado!');
  };

  if (isEditing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Editar Informação</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => updateClub.mutate(formData)}
                disabled={updateClub.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome do Clube</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Ano de Fundação</Label>
              <Input
                type="number"
                value={formData.founded_year}
                onChange={(e) => setFormData({ ...formData, founded_year: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Morada</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Logo do Clube</Label>
              <div className="flex items-center gap-4">
                {formData.logo_url && (
                  <img src={formData.logo_url} alt="Logo" className="w-16 h-16 rounded-lg object-cover" />
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>História do Clube</Label>
            <Textarea
              value={formData.history}
              onChange={(e) => setFormData({ ...formData, history: e.target.value })}
              rows={4}
              placeholder="Conte a história do seu clube..."
            />
          </div>

          <div className="space-y-2">
            <Label>Objetivos</Label>
            <Textarea
              value={formData.objectives}
              onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
              rows={4}
              placeholder="Quais são os objetivos do clube para esta época..."
            />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{club?.email || 'Não definido'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Phone className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium">{club?.phone || 'Não definido'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Morada</p>
                <p className="font-medium">{club?.address || 'Não definida'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Fundado</p>
                <p className="font-medium">{club?.founded_year || 'Não definido'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            <CardTitle>História do Clube</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
        </CardHeader>
        <CardContent>
          {club?.history ? (
            <p className="whitespace-pre-wrap text-muted-foreground">{club.history}</p>
          ) : (
            <p className="text-muted-foreground italic">
              Nenhuma história definida. Clique em editar para adicionar a história do seu clube.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Objectives */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <CardTitle>Objetivos</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {club?.objectives ? (
            <p className="whitespace-pre-wrap text-muted-foreground">{club.objectives}</p>
          ) : (
            <p className="text-muted-foreground italic">
              Nenhum objetivo definido. Clique em editar para adicionar os objetivos do clube.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
