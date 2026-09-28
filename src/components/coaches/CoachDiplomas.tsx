import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, GraduationCap, FileText, Trash2, Upload, ExternalLink } from 'lucide-react';
import { DIPLOMA_LEVELS } from '@/lib/coach-constants';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Diploma {
  id: string;
  name: string;
  issuing_organization: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  document_url: string | null;
  diploma_level: string | null;
  notes: string | null;
}

export function CoachDiplomas() {
  const { user } = useAuth();
  const [diplomas, setDiplomas] = useState<Diploma[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    issuing_organization: '',
    issue_date: '',
    expiry_date: '',
    document_url: '',
    diploma_level: '',
    notes: '',
  });

  useEffect(() => {
    if (user) fetchDiplomas();
  }, [user]);

  const fetchDiplomas = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('coach_diplomas')
        .select('*')
        .eq('owner_id', user.id)
        .order('issue_date', { ascending: false });

      if (error) throw error;
      setDiplomas(data || []);
    } catch (error) {
      console.error('Error fetching diplomas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !user) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/diplomas/${Date.now()}.${fileExt}`;

    setUploading(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('coach-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: signed, error: signedError } = await supabase.storage
        .from('coach-documents')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

      if (signedError || !signed?.signedUrl) throw signedError ?? new Error('Falha ao assinar URL');

      setForm(prev => ({ ...prev, document_url: signed.signedUrl }));
      toast.success('Documento carregado!');
    } catch (error: any) {
      toast.error('Erro ao carregar documento: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !form.name) {
      toast.error('Preencha o nome do diploma');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('coach_diplomas')
        .insert({
          coach_id: user.id,
          owner_id: user.id,
          name: form.name,
          issuing_organization: form.issuing_organization || null,
          issue_date: form.issue_date || null,
          expiry_date: form.expiry_date || null,
          document_url: form.document_url || null,
          diploma_level: form.diploma_level || null,
          notes: form.notes || null,
        });

      if (error) throw error;
      
      toast.success('Diploma adicionado!');
      setDialogOpen(false);
      setForm({
        name: '',
        issuing_organization: '',
        issue_date: '',
        expiry_date: '',
        document_url: '',
        diploma_level: '',
        notes: '',
      });
      fetchDiplomas();
    } catch (error: any) {
      toast.error('Erro ao guardar diploma: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza que deseja eliminar este diploma?')) return;

    try {
      const { error } = await supabase
        .from('coach_diplomas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Diploma eliminado');
      fetchDiplomas();
    } catch (error: any) {
      toast.error('Erro ao eliminar: ' + error.message);
    }
  };

  const getDiplomaLevelLabel = (level: string | null) => {
    if (!level) return null;
    return DIPLOMA_LEVELS.find(d => d.value === level)?.label || level;
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Diplomas e Formações</h3>
          <p className="text-sm text-muted-foreground">Gerir as suas certificações e qualificações</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Diploma
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Novo Diploma / Formação</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Nome do Diploma *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ex: UEFA B, Treinador Grau II"
                  />
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label>Nível</Label>
                  <Select
                    value={form.diploma_level}
                    onValueChange={(v) => setForm(prev => ({ ...prev, diploma_level: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o nível" />
                    </SelectTrigger>
                    <SelectContent>
                      {DIPLOMA_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label>Entidade Emissora</Label>
                  <Input
                    value={form.issuing_organization}
                    onChange={(e) => setForm(prev => ({ ...prev, issuing_organization: e.target.value }))}
                    placeholder="Ex: FPF, IPDJ, UEFA"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Data de Emissão</Label>
                  <Input
                    type="date"
                    value={form.issue_date}
                    onChange={(e) => setForm(prev => ({ ...prev, issue_date: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Data de Validade</Label>
                  <Input
                    type="date"
                    value={form.expiry_date}
                    onChange={(e) => setForm(prev => ({ ...prev, expiry_date: e.target.value }))}
                  />
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label>Documento (PDF/Imagem)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={form.document_url}
                      onChange={(e) => setForm(prev => ({ ...prev, document_url: e.target.value }))}
                      placeholder="URL do documento"
                      className="flex-1"
                    />
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={uploading}
                      />
                      <Button variant="outline" disabled={uploading}>
                        <Upload className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Observações adicionais..."
                    rows={2}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'A guardar...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {diplomas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sem Diplomas</h3>
            <p className="text-muted-foreground">
              Adicione os seus diplomas e certificações para completar o seu currículo
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {diplomas.map((diploma) => (
            <Card key={diploma.id}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <GraduationCap className="w-5 h-5 text-primary" />
                      <h4 className="font-semibold">{diploma.name}</h4>
                    </div>
                    
                    {diploma.diploma_level && (
                      <Badge variant="secondary" className="mb-2">
                        {getDiplomaLevelLabel(diploma.diploma_level)}
                      </Badge>
                    )}
                    
                    {diploma.issuing_organization && (
                      <p className="text-sm text-muted-foreground">
                        {diploma.issuing_organization}
                      </p>
                    )}
                    
                    <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                      {diploma.issue_date && (
                        <span>
                          Emitido: {format(new Date(diploma.issue_date), 'MMM yyyy', { locale: pt })}
                        </span>
                      )}
                      {diploma.expiry_date && (
                        <span>
                          Validade: {format(new Date(diploma.expiry_date), 'MMM yyyy', { locale: pt })}
                        </span>
                      )}
                    </div>
                    
                    {diploma.notes && (
                      <p className="text-sm text-muted-foreground mt-2">{diploma.notes}</p>
                    )}
                  </div>
                  
                  <div className="flex gap-1">
                    {diploma.document_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(diploma.document_url!, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDelete(diploma.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
