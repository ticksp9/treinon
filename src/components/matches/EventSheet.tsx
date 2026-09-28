import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Player {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
}

interface EventSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: Player[];
  currentMinute: number;
  defaultEventType?: string;
  defaultPlayerId?: string;
  onSubmit: (event: {
    event_type: string;
    minute: number;
    player_id: string | null;
    assist_player_id: string | null;
    is_opponent: boolean;
    notes: string;
  }) => void;
}

const EVENT_TYPES = [
  { value: 'goal', label: '⚽ Golo', icon: '⚽' },
  { value: 'own_goal', label: '⚽ Auto-golo', icon: '⚽' },
  { value: 'yellow_card', label: '🟨 Cartão amarelo', icon: '🟨' },
  { value: 'red_card', label: '🟥 Cartão vermelho', icon: '🟥' },
  { value: 'substitution_in', label: '↗ Entrada', icon: '↗' },
  { value: 'substitution_out', label: '↘ Saída', icon: '↘' },
];

export function EventSheet({
  open,
  onOpenChange,
  players,
  currentMinute,
  defaultEventType = 'goal',
  defaultPlayerId,
  onSubmit,
}: EventSheetProps) {
  const [eventType, setEventType] = useState(defaultEventType);
  const [minute, setMinute] = useState(currentMinute);
  const [playerId, setPlayerId] = useState(defaultPlayerId || '');
  const [assistPlayerId, setAssistPlayerId] = useState('');
  const [isOpponent, setIsOpponent] = useState(false);
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!eventType) {
      toast.error('Selecione o tipo de evento.');
      return;
    }
    if (minute < 0) {
      toast.error('Minuto inválido.');
      return;
    }

    onSubmit({
      event_type: eventType,
      minute,
      player_id: isOpponent ? null : (playerId || null),
      assist_player_id: assistPlayerId || null,
      is_opponent: isOpponent,
      notes,
    });

    // Reset
    setEventType('goal');
    setMinute(currentMinute);
    setPlayerId('');
    setAssistPlayerId('');
    setIsOpponent(false);
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] rounded-t-2xl">
        <SheetHeader className="pb-2">
          <SheetTitle>Registar evento</SheetTitle>
          <SheetDescription>Adicione um evento ao jogo.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 pb-6">
          {/* Event type - big touch targets */}
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Tipo de evento</Label>
            <div className="grid grid-cols-3 gap-2">
              {EVENT_TYPES.map(et => (
                <button
                  key={et.value}
                  onClick={() => {
                    setEventType(et.value);
                    setIsOpponent(false);
                  }}
                  className={`p-3 rounded-lg border-2 text-center transition-all active:scale-95 ${
                    eventType === et.value
                      ? 'border-primary bg-primary/10 font-medium'
                      : 'border-transparent bg-secondary/30 hover:bg-secondary/50'
                  }`}
                >
                  <span className="text-lg block">{et.icon}</span>
                  <span className="text-[10px] block mt-0.5">{et.label.split(' ').slice(1).join(' ')}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Minute */}
          <div>
            <Label className="text-xs text-muted-foreground">Minuto</Label>
            <Input
              type="number"
              min={0}
              value={minute}
              onChange={e => setMinute(parseInt(e.target.value) || 0)}
              className="text-lg font-mono h-12"
            />
          </div>

          {/* Opponent toggle for goals */}
          {(eventType === 'goal') && (
            <div className="flex gap-2">
              <Button
                variant={!isOpponent ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsOpponent(false)}
                className="flex-1"
              >
                Nossa equipa
              </Button>
              <Button
                variant={isOpponent ? 'default' : 'outline'}
                size="sm"
                onClick={() => setIsOpponent(true)}
                className="flex-1"
              >
                Adversário
              </Button>
            </div>
          )}

          {/* Player */}
          {!isOpponent && (
            <div>
              <Label className="text-xs text-muted-foreground">Jogador</Label>
              <Select value={playerId} onValueChange={setPlayerId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecionar jogador" />
                </SelectTrigger>
                <SelectContent>
                  {players.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.number ? `${p.number} - ` : ''}{p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Assist for goals */}
          {eventType === 'goal' && !isOpponent && (
            <div>
              <Label className="text-xs text-muted-foreground">Assistência (opcional)</Label>
              <Select value={assistPlayerId} onValueChange={setAssistPlayerId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecionar (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {players.filter(p => p.id !== playerId).map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.number ? `${p.number} - ` : ''}{p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-12">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} className="flex-1 h-12">
              Guardar evento
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
