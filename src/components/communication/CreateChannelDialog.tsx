import { useEffect, useState } from 'react';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { useCreateChannel } from '@/hooks/useCommunication';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/auth';
import { useAccessContext } from '@/hooks/useAccessContext';
import { getCreatableChannelTypes } from '@/lib/communication-access-service';
import type { CommunicationChannelType } from '@/lib/communication-permissions';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CreateChannelDialogProps {
  clubId: string | null;
  open: boolean;
  onClose: () => void;
  isCoordinator?: boolean;
}

const channelTypeLabels: Record<string, { label: string; desc: string }> = {
  official_club: { label: 'Oficial do Clube', desc: 'Comunicação institucional do clube' },
  official_team: { label: 'Oficial da Equipa', desc: 'Comunicação oficial da equipa' },
  official: { label: 'Oficial', desc: 'Comunicação institucional' },
  team: { label: 'Equipa', desc: 'Canal associado a uma equipa' },
  age_group: { label: 'Escalão', desc: 'Canal por escalão (ex: Sub-13)' },
  parents_team: { label: 'Pais da Equipa', desc: 'Canal para pais/encarregados' },
  players_team: { label: 'Atletas da Equipa', desc: 'Canal para atletas da equipa' },
  coaches_internal: { label: 'Técnicos (Interno)', desc: 'Só treinadores e adjuntos' },
  staff_internal: { label: 'Staff (Interno)', desc: 'Só staff técnico' },
  coordination_internal: { label: 'Coordenação (Interno)', desc: 'Coordenadores e direção' },
  restricted_internal: { label: 'Interno Restrito', desc: 'Staff/treinadores apenas' },
  mixed_controlled: { label: 'Misto Controlado', desc: 'Composição explícita' },
  role_based: { label: 'Por Função', desc: 'Ex: só treinadores, só pais' },
  custom: { label: 'Personalizado', desc: 'Grupo livre' },
};

const visibilityScopes = [
  { value: 'team_based', label: 'Baseado na Equipa' },
  { value: 'age_group_based', label: 'Baseado no Escalão' },
  { value: 'role_based', label: 'Baseado na Função' },
  { value: 'private', label: 'Privado (só convite)' },
  { value: 'official_broadcast', label: 'Difusão Oficial' },
  { value: 'mixed_custom', label: 'Misto Personalizado' },
];

export function CreateChannelDialog({ clubId, open, onClose }: CreateChannelDialogProps) {
  const { user } = useAuth();
  const { ctx } = useAccessContext();
  const createChannel = useCreateChannel(clubId);

  // Derive available channel types from centralized permissions
  const availableTypes: CommunicationChannelType[] = ctx ? getCreatableChannelTypes(ctx) : [];
  const defaultType = availableTypes.includes('team') ? 'team' : availableTypes[0] || 'custom';

  const [name, setName] = useState('');
  const [channelType, setChannelType] = useState<string>(defaultType);
  const [description, setDescription] = useState('');
  const [ageGroup, setAgeGroup] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [visibilityScope, setVisibilityScope] = useState('team_based');
  const [allowGuardians, setAllowGuardians] = useState(defaultType === 'team');
  const [allowPlayers, setAllowPlayers] = useState(false);
  const [allowCoaches, setAllowCoaches] = useState(true);
  const [allowStaff, setAllowStaff] = useState(false);
  const [allowCoordinators, setAllowCoordinators] = useState(false);

  const { data: teams = [] } = useQuery({
    queryKey: ['create-channel-teams', clubId, user?.id],
    queryFn: async () => {
      if (clubId) {
        const { data } = await supabase.from('teams').select('id, name, category').eq('club_id', clubId).order('name');
        return data || [];
      }
      if (user?.id) {
        const { data } = await supabase.from('teams').select('id, name, category').eq('owner_id', user.id).is('club_id', null).order('name');
        return data || [];
      }
      return [];
    },
    enabled: open && !!user,
  });

  // a coach with one team should not have to pick it; with several, the active one comes first
  const { activeTeamId } = useActiveTeam();
  useEffect(() => {
    if (!open || selectedTeamId || teams.length === 0 || !['team', 'official_team'].includes(channelType)) return;
    setSelectedTeamId((teams.find((t) => t.id === activeTeamId) ?? teams[0]).id);
  }, [open, teams, channelType, selectedTeamId, activeTeamId]);

  const handleTypeChange = (type: string) => {
    setChannelType(type);
    switch (type) {
      case 'restricted_internal':
      case 'coaches_internal':
      case 'staff_internal':
      case 'coordination_internal':
        setAllowGuardians(false);
        setAllowPlayers(false);
        setAllowCoaches(true);
        setAllowStaff(true);
        setAllowCoordinators(true);
        setVisibilityScope('private');
        break;
      case 'parents_team':
        setAllowGuardians(true);
        setAllowPlayers(false);
        setAllowCoaches(true);
        setAllowStaff(false);
        setAllowCoordinators(false);
        setVisibilityScope('team_based');
        break;
      case 'players_team':
        setAllowGuardians(false);
        setAllowPlayers(true);
        setAllowCoaches(true);
        setAllowStaff(false);
        setAllowCoordinators(false);
        setVisibilityScope('team_based');
        break;
      case 'official_club':
      case 'official':
        setVisibilityScope('official_broadcast');
        setAllowGuardians(true);
        setAllowPlayers(true);
        setAllowCoaches(true);
        setAllowStaff(true);
        setAllowCoordinators(true);
        break;
      case 'team':
      case 'official_team':
        setVisibilityScope('team_based');
        setAllowCoaches(true);
        // a team group is mostly to talk to the parents
        setAllowGuardians(true);
        break;
      case 'age_group':
        setVisibilityScope('age_group_based');
        break;
      case 'role_based':
        setVisibilityScope('role_based');
        break;
      default:
        setVisibilityScope('mixed_custom');
        break;
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Nome do grupo é obrigatório');
      return;
    }
    createChannel.mutate(
      {
        name: name.trim(),
        channel_type: channelType,
        description: description.trim() || undefined,
        team_id: selectedTeamId || undefined,
        age_group: ageGroup || undefined,
        target_role: targetRole || undefined,
      },
      {
        onSuccess: (channel: any) => {
          if (channel?.id) {
            supabase
              .from('communication_channels')
              .update({
                visibility_scope: visibilityScope,
                allow_guardians: allowGuardians,
                allow_players: allowPlayers,
                allow_coaches: allowCoaches,
                allow_staff: allowStaff,
                allow_coordinators: allowCoordinators,
              })
              .eq('id', channel.id)
              .then(() => {});
          }
          toast.success('Grupo criado com sucesso');
          resetForm();
          onClose();
        },
        onError: () => toast.error('Erro ao criar grupo'),
      }
    );
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setAgeGroup('');
    setTargetRole('');
    setSelectedTeamId('');
    setChannelType(defaultType);
    setVisibilityScope('team_based');
    setAllowGuardians(defaultType === 'team');
    setAllowPlayers(false);
    setAllowCoaches(true);
    setAllowStaff(false);
    setAllowCoordinators(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetForm(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Grupo de Comunicação</DialogTitle>
          <DialogDescription>
            Configure o tipo, visibilidade e permissões do novo grupo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pais Sub-13" />
          </div>

          <div>
            <Label>Tipo de Canal</Label>
            <Select value={channelType} onValueChange={handleTypeChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableTypes.map((t) => {
                  const info = channelTypeLabels[t] || { label: t, desc: '' };
                  return (
                    <SelectItem key={t} value={t}>
                      <div>
                        <span>{info.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">— {info.desc}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {['team', 'official_team', 'parents_team', 'players_team', 'age_group', 'mixed_controlled'].includes(channelType) && teams.length > 0 && (
            <div>
              <Label>Equipa</Label>
              <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                <SelectTrigger><SelectValue placeholder="Selecionar equipa (opcional)" /></SelectTrigger>
                <SelectContent>
                  {teams.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} {t.category ? `(${t.category})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {channelType === 'age_group' && (
            <div>
              <Label>Escalão</Label>
              <Input value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)} placeholder="Ex: Sub-13" />
            </div>
          )}

          {channelType === 'role_based' && (
            <div>
              <Label>Função alvo</Label>
              <Select value={targetRole} onValueChange={setTargetRole}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="coach">Treinadores</SelectItem>
                  <SelectItem value="assistant_coach">Treinadores Adjuntos</SelectItem>
                  <SelectItem value="guardian">Encarregados</SelectItem>
                  <SelectItem value="player">Atletas</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="coordinator">Coordenadores</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição opcional..." rows={2} />
          </div>

          <Separator />

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Visibilidade</Label>
            <Select value={visibilityScope} onValueChange={setVisibilityScope}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {visibilityScopes.map((v) => (
                  <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quem entra no grupo</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              {selectedTeamId
                ? 'As pessoas da equipa escolhida entram sozinhas, agora e sempre que alguém novo se juntar (convite aceite, pai associado a um jogador).'
                : 'Escolha uma equipa para as pessoas entrarem sozinhas; sem equipa, o grupo fica só consigo.'}
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Treinadores</Label>
                <Switch checked={allowCoaches} onCheckedChange={setAllowCoaches} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Staff Técnico</Label>
                <Switch checked={allowStaff} onCheckedChange={setAllowStaff} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Coordenadores</Label>
                <Switch checked={allowCoordinators} onCheckedChange={setAllowCoordinators} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Encarregados de Educação</Label>
                <Switch checked={allowGuardians} onCheckedChange={setAllowGuardians} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-normal">Atletas</Label>
                <Switch checked={allowPlayers} onCheckedChange={setAllowPlayers} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createChannel.isPending}>
              {createChannel.isPending ? 'A criar...' : 'Criar Grupo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
