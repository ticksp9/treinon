import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Save, Upload, User, X } from 'lucide-react';
import { FORMATIONS, SPECIALIZATIONS } from '@/lib/coach-constants';

interface CoachDetails {
  id?: string;
  user_id: string;
  phone: string;
  address: string;
  birth_date: string;
  nationality: string;
  photo_url: string;
  bio: string;
  coaching_philosophy: string;
  preferred_formations: string[];
  specializations: string[];
  years_experience: number;
}

export function CoachProfileForm() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<Partial<CoachDetails>>({
    phone: '',
    address: '',
    birth_date: '',
    nationality: '',
    photo_url: '',
    bio: '',
    coaching_philosophy: '',
    preferred_formations: [],
    specializations: [],
    years_experience: 0,
  });
  const [userProfile, setUserProfile] = useState<{ full_name: string; email: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();
      
      setUserProfile(profileData);

      // Fetch coach details
      const { data: coachData } = await supabase
        .from('coach_details')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (coachData) {
        setProfile({
          ...coachData,
          birth_date: coachData.birth_date || '',
          preferred_formations: coachData.preferred_formations || [],
          specializations: coachData.specializations || [],
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/photo.${fileExt}`;

    setUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('coach-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: signed, error: signedError } = await supabase.storage
        .from('coach-documents')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

      if (signedError || !signed?.signedUrl) throw signedError ?? new Error('Falha ao assinar URL');

      setProfile(prev => ({ ...prev, photo_url: signed.signedUrl }));
      toast.success('Foto atualizada!');
    } catch (error: any) {
      toast.error('Erro ao carregar foto: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const toggleFormation = (formation: string) => {
    setProfile(prev => ({
      ...prev,
      preferred_formations: prev.preferred_formations?.includes(formation)
        ? prev.preferred_formations.filter(f => f !== formation)
        : [...(prev.preferred_formations || []), formation],
    }));
  };

  const toggleSpecialization = (spec: string) => {
    setProfile(prev => ({
      ...prev,
      specializations: prev.specializations?.includes(spec)
        ? prev.specializations.filter(s => s !== spec)
        : [...(prev.specializations || []), spec],
    }));
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const data = {
        user_id: user.id,
        phone: profile.phone || null,
        address: profile.address || null,
        birth_date: profile.birth_date || null,
        nationality: profile.nationality || null,
        photo_url: profile.photo_url || null,
        bio: profile.bio || null,
        coaching_philosophy: profile.coaching_philosophy || null,
        preferred_formations: profile.preferred_formations || [],
        specializations: profile.specializations || [],
        years_experience: profile.years_experience || null,
      };

      const { error } = await supabase
        .from('coach_details')
        .upsert(data, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success('Perfil guardado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao guardar perfil: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-pulse">A carregar...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with photo */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex flex-col items-center gap-3">
              <Avatar className="w-32 h-32">
                <AvatarImage src={profile.photo_url || ''} />
                <AvatarFallback className="text-3xl">
                  <User className="w-12 h-12" />
                </AvatarFallback>
              </Avatar>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <Button variant="outline" size="sm" disabled={uploading}>
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? 'A carregar...' : 'Alterar Foto'}
                </Button>
              </div>
            </div>
            
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-2xl font-bold">{userProfile?.full_name || 'Sem nome'}</h2>
                <p className="text-muted-foreground">{userProfile?.email}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={profile.phone || ''}
                    onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+351 912 345 678"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nacionalidade</Label>
                  <Input
                    value={profile.nationality || ''}
                    onChange={(e) => setProfile(prev => ({ ...prev, nationality: e.target.value }))}
                    placeholder="Portuguesa"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data de Nascimento</Label>
                  <Input
                    type="date"
                    value={profile.birth_date || ''}
                    onChange={(e) => setProfile(prev => ({ ...prev, birth_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Anos de Experiência</Label>
                  <Input
                    type="number"
                    min="0"
                    value={profile.years_experience || ''}
                    onChange={(e) => setProfile(prev => ({ ...prev, years_experience: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Morada</Label>
                <Input
                  value={profile.address || ''}
                  onChange={(e) => setProfile(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Rua, Cidade, Código Postal"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bio & Philosophy */}
      <Card>
        <CardHeader>
          <CardTitle>Sobre Mim</CardTitle>
          <CardDescription>Apresente-se e descreva a sua filosofia de treino</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Biografia</Label>
            <Textarea
              value={profile.bio || ''}
              onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
              placeholder="Escreva uma breve biografia sobre a sua carreira..."
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label>Filosofia de Treino</Label>
            <Textarea
              value={profile.coaching_philosophy || ''}
              onChange={(e) => setProfile(prev => ({ ...prev, coaching_philosophy: e.target.value }))}
              placeholder="Descreva a sua abordagem ao treino, valores e métodos..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Formations & Specializations */}
      <Card>
        <CardHeader>
          <CardTitle>Preferências Táticas</CardTitle>
          <CardDescription>Selecione as formações e áreas de especialização</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Formações Preferidas</Label>
            <div className="flex flex-wrap gap-2">
              {FORMATIONS.map((f) => (
                <Badge
                  key={f.value}
                  variant={profile.preferred_formations?.includes(f.value) ? 'default' : 'outline'}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleFormation(f.value)}
                >
                  {f.label}
                  {profile.preferred_formations?.includes(f.value) && (
                    <X className="w-3 h-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>
          </div>
          
          <div className="space-y-3">
            <Label>Especializações</Label>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATIONS.map((s) => (
                <Badge
                  key={s.value}
                  variant={profile.specializations?.includes(s.value) ? 'default' : 'outline'}
                  className="cursor-pointer transition-colors"
                  onClick={() => toggleSpecialization(s.value)}
                >
                  {s.label}
                  {profile.specializations?.includes(s.value) && (
                    <X className="w-3 h-3 ml-1" />
                  )}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'A guardar...' : 'Guardar Perfil'}
        </Button>
      </div>
    </div>
  );
}
