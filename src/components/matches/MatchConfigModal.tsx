import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Play, Lock, Settings } from 'lucide-react';

interface MatchConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchType: 'friendly' | 'tournament' | 'championship';
  defaultPartDuration: number;
  /** Pre-configured duration from match record (if already set) */
  savedPartDuration?: number | null;
  /** Pre-configured parts count from match record */
  savedPartsCount?: number | null;
  onConfirm: (config: { partsCount: number; partDurationMinutes: number }) => void;
}

// Tournament preset profiles
const TOURNAMENT_PROFILES = [
  { label: '1 parte × 15 min', parts: 1, duration: 15 },
  { label: '1 parte × 20 min', parts: 1, duration: 20 },
  { label: '1 parte × 25 min', parts: 1, duration: 25 },
  { label: '2 partes × 10 min', parts: 2, duration: 10 },
  { label: '2 partes × 12 min', parts: 2, duration: 12 },
  { label: '2 partes × 15 min', parts: 2, duration: 15 },
];

export function MatchConfigModal({
  open,
  onOpenChange,
  matchType,
  defaultPartDuration,
  savedPartDuration,
  savedPartsCount,
  onConfirm,
}: MatchConfigModalProps) {
  const effectiveDuration = savedPartDuration || defaultPartDuration || 45;
  const effectiveParts = savedPartsCount || (matchType === 'tournament' ? 1 : 2);
  const [partsCount, setPartsCount] = useState(effectiveParts);
  const [partDurationMinutes, setPartDurationMinutes] = useState(effectiveDuration);
  const [selectedProfile, setSelectedProfile] = useState('0'); // Index as string

  const handleConfirm = () => {
    if (matchType === 'tournament') {
      const profile = TOURNAMENT_PROFILES[parseInt(selectedProfile)];
      onConfirm({ partsCount: profile.parts, partDurationMinutes: profile.duration });
    } else {
      onConfirm({ partsCount, partDurationMinutes });
    }
    onOpenChange(false);
  };

  const getTitle = () => {
    if (matchType === 'friendly') return 'Configurar Partida Amigável';
    if (matchType === 'tournament') return 'Configurar Partida de Torneio';
    return 'Iniciar Partida';
  };

  const getDescription = () => {
    if (matchType === 'friendly') {
      return 'Escolha o número de partes e a duração de cada parte. Pode ajustar livremente.';
    }
    if (matchType === 'tournament') {
      return 'Escolha um perfil de torneio. Após iniciar, a configuração ficará bloqueada.';
    }
    return 'Pronto para iniciar a partida com a configuração padrão do campeonato.';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Friendly Match - Full config */}
          {matchType === 'friendly' && (
            <>
              <div className="space-y-3">
                <Label>Número de Partes</Label>
                <div className="grid grid-cols-6 gap-2">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={partsCount === n ? 'default' : 'outline'}
                      className="h-12 text-lg"
                      onClick={() => setPartsCount(n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Minutos por Parte</Label>
                <Select
                  value={String(partDurationMinutes)}
                  onValueChange={(v) => setPartDurationMinutes(parseInt(v))}
                >
                  <SelectTrigger className="h-12 text-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 8, 10, 12, 15, 18, 20, 22, 25, 28, 30, 35, 40, 45, 50, 55, 60].map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m} minutos
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold">
                  {partsCount} × {partDurationMinutes}'
                </div>
                <div className="text-sm text-muted-foreground">
                  Total: {partsCount * partDurationMinutes} minutos
                </div>
              </div>
            </>
          )}

          {/* Tournament Match - Preset profiles */}
          {matchType === 'tournament' && (
            <>
              <RadioGroup
                value={selectedProfile}
                onValueChange={setSelectedProfile}
                className="space-y-2"
              >
                {TOURNAMENT_PROFILES.map((profile, index) => (
                  <div
                    key={index}
                    className={`flex items-center space-x-3 border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedProfile === String(index) 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => setSelectedProfile(String(index))}
                  >
                    <RadioGroupItem value={String(index)} id={`profile-${index}`} />
                    <Label htmlFor={`profile-${index}`} className="cursor-pointer flex-1">
                      <span className="font-medium text-base">{profile.label}</span>
                      <span className="text-sm text-muted-foreground ml-2">
                        ({profile.parts * profile.duration} min total)
                      </span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-sm text-amber-800 dark:text-amber-200">
                <Lock className="w-4 h-4 flex-shrink-0" />
                <span>Após iniciar, a configuração ficará bloqueada durante todo o jogo.</span>
              </div>
            </>
          )}

          {/* Championship - Editable with defaults from category */}
          {matchType === 'championship' && (
            <>
              <div className="space-y-3">
                <Label>Minutos por Parte</Label>
                <Select
                  value={String(partDurationMinutes)}
                  onValueChange={(v) => setPartDurationMinutes(parseInt(v))}
                >
                  <SelectTrigger className="h-12 text-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[15, 20, 25, 28, 30, 35, 40, 45, 50, 55, 60].map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m} minutos {m === defaultPartDuration ? '(padrão do escalão)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 bg-muted rounded-lg text-center">
                <div className="text-2xl font-bold">
                  2 × {partDurationMinutes}'
                </div>
                <div className="text-sm text-muted-foreground">
                  Total: {2 * partDurationMinutes} minutos
                  {partDurationMinutes !== defaultPartDuration && (
                    <span className="ml-1 text-amber-600">(alterado do padrão {defaultPartDuration}')</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={handleConfirm}>
            <Play className="w-4 h-4 mr-2" />
            Iniciar Partida
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
