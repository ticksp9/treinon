import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Clock, Pencil } from 'lucide-react';
import { type ReportEntryMode, ENTRY_MODE_LABELS, ENTRY_MODE_DESCRIPTIONS } from '@/lib/match-report-service';

interface ReportEntryModeSelectorProps {
  value: ReportEntryMode;
  onChange: (mode: ReportEntryMode) => void;
  disabled?: boolean;
}

const MODE_ICONS: Record<ReportEntryMode, React.ReactNode> = {
  live: <Play className="w-4 h-4" />,
  post_game: <Clock className="w-4 h-4" />,
  hybrid: <Pencil className="w-4 h-4" />,
};

export function ReportEntryModeSelector({ value, onChange, disabled }: ReportEntryModeSelectorProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Modo de Registo</Label>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as ReportEntryMode)} disabled={disabled}>
        {(['live', 'post_game', 'hybrid'] as ReportEntryMode[]).map(mode => (
          <Card key={mode} className={`cursor-pointer transition-colors ${value === mode ? 'border-primary bg-primary/5' : 'hover:bg-secondary/30'}`} onClick={() => !disabled && onChange(mode)}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start gap-3">
                <RadioGroupItem value={mode} id={`mode-${mode}`} className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {MODE_ICONS[mode]}
                    <Label htmlFor={`mode-${mode}`} className="font-medium cursor-pointer">
                      {ENTRY_MODE_LABELS[mode]}
                    </Label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ENTRY_MODE_DESCRIPTIONS[mode]}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </RadioGroup>
    </div>
  );
}
