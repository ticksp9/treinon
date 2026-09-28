/**
 * Compact formation picker (dropdown only). Reads catalog from tactical-formations.ts.
 * The "apply/cancel" preview is owned by FormationEditor.
 */
import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { listAvailableFormations, expectedPlayersForSport, type SportType } from '@/lib/tactical-formations';

interface Props {
  sportType: SportType | string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

export function FormationPicker({ sportType, value, onChange, disabled }: Props) {
  const available = useMemo(() => listAvailableFormations(sportType as SportType), [sportType]);
  const expected = useMemo(() => expectedPlayersForSport(sportType), [sportType]);

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline">{expected} jog.</Badge>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-8 w-36">
          <SelectValue placeholder="Formação" />
        </SelectTrigger>
        <SelectContent>
          {available.map((f) => (
            <SelectItem key={f.code} value={f.code}>
              {f.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
