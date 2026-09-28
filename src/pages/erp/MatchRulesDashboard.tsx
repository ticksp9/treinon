import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useMatchRuleProfiles, useMatchRuleProfileMutations, useMatchRuleAuditLogs } from '@/hooks/useMatchRules';
import { useUserRole } from '@/hooks/useUserRole';
import { Settings, Plus, Edit, Trash2, History, Shield, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import type { MatchRuleProfile } from '@/lib/match-rules-service';

const MODALITY_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'football_11', label: 'Futebol 11' },
  { value: 'football_9', label: 'Futebol 9' },
  { value: 'football_7', label: 'Futebol 7' },
  { value: 'football_5', label: 'Futebol 5' },
  { value: 'futsal', label: 'Futsal' },
];

const MODALITY_LABELS: Record<string, string> = {
  football_11: 'Futebol 11',
  football_9: 'Futebol 9',
  football_7: 'Futebol 7',
  football_5: 'Futebol 5',
  futsal: 'Futsal',
};

const AGE_GROUP_LABELS: Record<string, string> = {
  petizes: 'Petizes',
  traquinas: 'Traquinas',
  benjamins: 'Benjamins',
  infantis: 'Infantis',
  iniciados: 'Iniciados',
  juvenis: 'Juvenis',
  juniores: 'Juniores',
  seniores: 'Seniores',
};

export default function MatchRulesDashboard() {
  const { isClubAdmin } = useUserRole();
  const [modalityFilter, setModalityFilter] = useState('');
  const [editDialog, setEditDialog] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Partial<MatchRuleProfile> | null>(null);

  const { data: profiles, isLoading } = useMatchRuleProfiles(modalityFilter || undefined);
  const { data: auditLogs, isLoading: auditLoading } = useMatchRuleAuditLogs();
  const { createProfile, updateProfile, deleteProfile } = useMatchRuleProfileMutations();

  const handleSave = () => {
    if (!editingProfile?.name || !editingProfile?.modality_code || !editingProfile?.max_players_on_field) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    if (editingProfile.id) {
      updateProfile.mutate(editingProfile as MatchRuleProfile & { id: string });
    } else {
      createProfile.mutate(editingProfile as any);
    }
    setEditDialog(false);
    setEditingProfile(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja eliminar este perfil?')) {
      deleteProfile.mutate(id);
    }
  };

  const openCreate = () => {
    setEditingProfile({
      modality_code: 'football_11',
      age_group_code: 'iniciados',
      name: '',
      period_count: 2,
      period_1_minutes: 35,
      period_2_minutes: 35,
      halftime_minutes: 10,
      max_players_on_field: 11,
      reentry_allowed: false,
      rolling_substitutions: false,
    });
    setEditDialog(true);
  };

  const openEdit = (profile: MatchRuleProfile) => {
    setEditingProfile({ ...profile });
    setEditDialog(true);
  };

  // Stats
  const systemProfiles = profiles?.filter(p => p.is_system_default) || [];
  const clubProfiles = profiles?.filter(p => !p.is_system_default) || [];

  return (
    <AppLayout>
      <PageHeader
        title="Regras de Jogo"
        description="Configuração central de regras por modalidade e escalão"
        icon={<Settings className="h-6 w-6" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{systemProfiles.length}</p>
                <p className="text-xs text-muted-foreground">Perfis do sistema</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{clubProfiles.length}</p>
                <p className="text-xs text-muted-foreground">Perfis personalizados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{new Set(profiles?.map(p => p.modality_code)).size}</p>
                <p className="text-xs text-muted-foreground">Modalidades</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{new Set(profiles?.map(p => p.age_group_code)).size}</p>
                <p className="text-xs text-muted-foreground">Escalões</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="profiles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profiles">Perfis de Regras</TabsTrigger>
          <TabsTrigger value="audit">Histórico de Alterações</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Perfis de Regras</CardTitle>
                  <CardDescription>Regras de jogo por modalidade e escalão</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={modalityFilter} onValueChange={setModalityFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filtrar modalidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODALITY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isClubAdmin && (
                    <Button onClick={openCreate} size="sm">
                      <Plus className="h-4 w-4 mr-1" /> Novo Perfil
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Modalidade</TableHead>
                      <TableHead>Escalão</TableHead>
                      <TableHead>Tempos</TableHead>
                      <TableHead>Máx. Campo</TableHead>
                      <TableHead>Reentrada</TableHead>
                      <TableHead>Tipo</TableHead>
                      {isClubAdmin && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles?.map(profile => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {MODALITY_LABELS[profile.modality_code] || profile.modality_code}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {AGE_GROUP_LABELS[profile.age_group_code || ''] || profile.age_group_code || '—'}
                        </TableCell>
                        <TableCell>
                          {profile.period_count}×{profile.period_1_minutes}min
                        </TableCell>
                        <TableCell>{profile.max_players_on_field}</TableCell>
                        <TableCell>
                          <Badge variant={profile.reentry_allowed ? 'default' : 'secondary'}>
                            {profile.reentry_allowed ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={profile.is_system_default ? 'outline' : 'default'}>
                            {profile.is_system_default ? 'Sistema' : 'Clube'}
                          </Badge>
                        </TableCell>
                        {isClubAdmin && (
                          <TableCell className="text-right">
                            {!profile.is_system_default && (
                              <div className="flex gap-1 justify-end">
                                <Button size="icon" variant="ghost" onClick={() => openEdit(profile)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDelete(profile.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {(!profiles || profiles.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Nenhum perfil encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Alterações
              </CardTitle>
              <CardDescription>Registo de todas as alterações a perfis de regras</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <div className="space-y-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : auditLogs && auditLogs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Entidade</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.map((log: any) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: pt })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.entity_type}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.reason || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">Sem alterações registadas</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProfile?.id ? 'Editar' : 'Novo'} Perfil de Regras</DialogTitle>
            <DialogDescription>Configure as regras para uma modalidade e escalão</DialogDescription>
          </DialogHeader>
          {editingProfile && (
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <Input
                  value={editingProfile.name || ''}
                  onChange={e => setEditingProfile({ ...editingProfile, name: e.target.value })}
                  placeholder="Ex: Futebol 7 - Infantis (Competição X)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Modalidade</Label>
                  <Select
                    value={editingProfile.modality_code || 'football_11'}
                    onValueChange={v => setEditingProfile({ ...editingProfile, modality_code: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODALITY_OPTIONS.filter(o => o.value).map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Escalão</Label>
                  <Select
                    value={editingProfile.age_group_code || ''}
                    onValueChange={v => setEditingProfile({ ...editingProfile, age_group_code: v })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(AGE_GROUP_LABELS).map(([code, label]) => (
                        <SelectItem key={code} value={code}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Competição (opcional)</Label>
                <Input
                  value={editingProfile.competition_name || ''}
                  onChange={e => setEditingProfile({ ...editingProfile, competition_name: e.target.value })}
                  placeholder="Ex: Campeonato Distrital"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Nº Partes</Label>
                  <Input
                    type="number"
                    min={1}
                    max={4}
                    value={editingProfile.period_count || 2}
                    onChange={e => setEditingProfile({ ...editingProfile, period_count: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>1ª Parte (min)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={60}
                    value={editingProfile.period_1_minutes || 45}
                    onChange={e => setEditingProfile({ ...editingProfile, period_1_minutes: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>2ª Parte (min)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={60}
                    value={editingProfile.period_2_minutes || 45}
                    onChange={e => setEditingProfile({ ...editingProfile, period_2_minutes: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Máx. jogadores em campo</Label>
                  <Input
                    type="number"
                    min={3}
                    max={11}
                    value={editingProfile.max_players_on_field || 11}
                    onChange={e => setEditingProfile({ ...editingProfile, max_players_on_field: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Intervalo (min)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={20}
                    value={editingProfile.halftime_minutes || 10}
                    onChange={e => setEditingProfile({ ...editingProfile, halftime_minutes: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingProfile.reentry_allowed || false}
                    onCheckedChange={v => setEditingProfile({ ...editingProfile, reentry_allowed: v })}
                  />
                  <Label>Reentrada permitida</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingProfile.rolling_substitutions || false}
                    onCheckedChange={v => setEditingProfile({ ...editingProfile, rolling_substitutions: v })}
                  />
                  <Label>Substituições rotativas</Label>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditDialog(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={createProfile.isPending || updateProfile.isPending}>
                  {editingProfile.id ? 'Guardar' : 'Criar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
