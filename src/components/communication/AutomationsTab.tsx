import { useState } from 'react';
import {
  useAutomationRules,
  useCreateAutomationRule,
  useToggleAutomation,
  useDeleteAutomation,
  AutomationRule,
} from '@/hooks/useCommunicationPhase2';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Zap, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AutomationsTabProps {
  clubId: string | null;
  userId?: string | null;
}

const triggerLabels: Record<string, string> = {
  time_before_training: 'Antes do treino',
  time_before_match: 'Antes do jogo',
  training_created: 'Treino criado',
  match_created: 'Jogo criado',
  event_changed: 'Evento alterado',
  event_cancelled: 'Evento cancelado',
  attendance_followup: 'Seguimento de presenças',
};

const audienceLabels: Record<string, string> = {
  full_team: 'Toda a equipa',
  parents: 'Pais',
  athletes: 'Atletas',
  staff: 'Staff técnico',
  custom: 'Personalizado',
};

export function AutomationsTab({ clubId, userId }: AutomationsTabProps) {
  const { data: rules = [], isLoading } = useAutomationRules(clubId, userId);
  const toggle = useToggleAutomation();
  const deleteRule = useDeleteAutomation();
  const [showCreate, setShowCreate] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Automações</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova Automação
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Nenhuma automação configurada</p>
          <p className="text-xs mt-1">Configure lembretes automáticos para treinos e jogos</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh] md:max-h-none">
          <div className="space-y-3">
            {rules.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-4 w-4 text-primary shrink-0" />
                        <h4 className="text-sm font-semibold truncate">{r.name}</h4>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">
                          {triggerLabels[r.trigger_type] || r.trigger_type}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {audienceLabels[r.target_audience] || r.target_audience}
                        </Badge>
                        {r.trigger_config && (r.trigger_config as Record<string, unknown>).hours_before && (
                          <span className="text-[10px] text-muted-foreground">
                            {String((r.trigger_config as Record<string, unknown>).hours_before)}h antes
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={r.is_enabled}
                        onCheckedChange={(checked) =>
                          toggle.mutate({ id: r.id, is_enabled: checked })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() =>
                          deleteRule.mutate(r.id, { onSuccess: () => toast.success('Automação removida') })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      <CreateAutomationDialog clubId={clubId} open={showCreate} onClose={() => setShowCreate(false)} />
    </>
  );
}

function CreateAutomationDialog({
  clubId,
  open,
  onClose,
}: {
  clubId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const create = useCreateAutomationRule(clubId);
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState('time_before_training');
  const [hoursBefore, setHoursBefore] = useState('24');
  const [audience, setAudience] = useState('full_team');

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('Nome é obrigatório'); return; }
    create.mutate(
      {
        name: name.trim(),
        trigger_type: triggerType,
        trigger_config: triggerType.startsWith('time_before_') ? { hours_before: parseInt(hoursBefore) || 24 } : {},
        target_audience: audience,
      },
      {
        onSuccess: () => {
          toast.success('Automação criada');
          setName('');
          onClose();
        },
        onError: () => toast.error('Erro ao criar automação'),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Automação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Lembrete 24h antes do treino" />
          </div>
          <div>
            <Label>Gatilho</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(triggerLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {triggerType.startsWith('time_before_') && (
            <div>
              <Label>Horas antes</Label>
              <Input type="number" min="1" max="168" value={hoursBefore} onChange={(e) => setHoursBefore(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Audiência</Label>
            <Select value={audience} onValueChange={setAudience}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(audienceLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={create.isPending}>
              {create.isPending ? 'A criar...' : 'Criar Automação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
