import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Briefcase, Trash2, Trophy } from 'lucide-react';
import { COACHING_ROLES, AGE_GROUPS } from '@/lib/coach-constants';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface HistoryEntry {
  id: string;
  club_name: string;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  age_groups: string[] | null;
  achievements: string | null;
  notes: string | null;
}

export function CoachHistory() {
  const { user } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAgeGroups, setSelectedAgeGroups] = useState<string[]>([]);
  
  const [form, setForm] = useState({
    club_name: '',
    role: '',
    start_date: '',
    end_date: '',
    achievements: '',
    notes: '',
  });

  useEffect(() => {
    if (user) fetchHistory();
  }, [user]);

  const fetchHistory = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('coach_history')
        .select('*')
        .eq('owner_id', user.id)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAgeGroup = (group: string) => {
    setSelectedAgeGroups(prev => 
      prev.includes(group)
        ? prev.filter(g => g !== group)
        : [...prev, group]
    );
  };

  const handleSave = async () => {
    if (!user || !form.club_name) {
      toast.error('Preencha o nome do clube');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('coach_history')
        .insert({
          coach_id: user.id,
          owner_id: user.id,
          club_name: form.club_name,
          role: form.role || null,
          start_date: form.start_date || null,
          end_date: form.end_date || null,
          age_groups: selectedAgeGroups.length > 0 ? selectedAgeGroups : null,
          achievements: form.achievements || null,
          notes: form.notes || null,
        });

      if (error) throw error;
      
      toast.success('Experiência adicionada!');
      setDialogOpen(false);
      setForm({
        club_name: '',
        role: '',
        start_date: '',
        end_date: '',
        achievements: '',
        notes: '',
      });
      setSelectedAgeGroups([]);
      fetchHistory();
    } catch (error: any) {
      toast.error('Erro ao guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem a certeza que deseja eliminar esta entrada?')) return;

    try {
      const { error } = await supabase
        .from('coach_history')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Entrada eliminada');
      fetchHistory();
    } catch (error: any) {
      toast.error('Erro ao eliminar: ' + error.message);
    }
  };

  const getRoleLabel = (role: string | null) => {
    if (!role) return null;
    return COACHING_ROLES.find(r => r.value === role)?.label || role;
  };

  const getAgeGroupLabel = (group: string) => {
    return AGE_GROUPS.find(a => a.value === group)?.label || group;
  };

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start && !end) return null;
    
    const startStr = start 
      ? format(new Date(start), 'MMM yyyy', { locale: pt })
      : '?';
    const endStr = end 
      ? format(new Date(end), 'MMM yyyy', { locale: pt })
      : 'Presente';
    
    return `${startStr} - ${endStr}`;
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
          <h3 className="text-lg font-semibold">Histórico Profissional</h3>
          <p className="text-sm text-muted-foreground">A sua experiência como treinador</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Experiência
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova Experiência</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label>Clube / Organização *</Label>
                  <Input
                    value={form.club_name}
                    onChange={(e) => setForm(prev => ({ ...prev, club_name: e.target.value }))}
                    placeholder="Nome do clube"
                  />
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label>Função</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm(prev => ({ ...prev, role: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a função" />
                    </SelectTrigger>
                    <SelectContent>
                      {COACHING_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Data de Início</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Data de Fim</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label>Escalões</Label>
                  <div className="flex flex-wrap gap-2">
                    {AGE_GROUPS.map((group) => (
                      <Badge
                        key={group.value}
                        variant={selectedAgeGroups.includes(group.value) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleAgeGroup(group.value)}
                      >
                        {group.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="col-span-2 space-y-2">
                  <Label>Conquistas</Label>
                  <Textarea
                    value={form.achievements}
                    onChange={(e) => setForm(prev => ({ ...prev, achievements: e.target.value }))}
                    placeholder="Títulos, promoções, resultados importantes..."
                    rows={2}
                  />
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

      {history.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sem Histórico</h3>
            <p className="text-muted-foreground">
              Adicione a sua experiência profissional como treinador
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-lg">{entry.club_name}</h4>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 mb-2">
                      {entry.role && (
                        <Badge variant="secondary">
                          {getRoleLabel(entry.role)}
                        </Badge>
                      )}
                      {formatDateRange(entry.start_date, entry.end_date) && (
                        <Badge variant="outline">
                          {formatDateRange(entry.start_date, entry.end_date)}
                        </Badge>
                      )}
                    </div>
                    
                    {entry.age_groups && entry.age_groups.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {entry.age_groups.map((group) => (
                          <Badge key={group} variant="outline" className="text-xs">
                            {getAgeGroupLabel(group)}
                          </Badge>
                        ))}
                      </div>
                    )}
                    
                    {entry.achievements && (
                      <div className="flex items-start gap-2 mt-3 p-2 bg-primary/5 rounded">
                        <Trophy className="w-4 h-4 text-primary mt-0.5" />
                        <p className="text-sm">{entry.achievements}</p>
                      </div>
                    )}
                    
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground mt-2">{entry.notes}</p>
                    )}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(entry.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
