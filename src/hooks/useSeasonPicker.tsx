import { useState } from 'react';
import { useSeasonsList } from '@/hooks/useSeasonContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { tx } from '@/lib/i18n/ui';

export function useSeasonPicker(initial?: string | null) {
  const { data: seasons = [] } = useSeasonsList();
  const [seasonId, setSeasonId] = useState<string | null>(initial ?? null);
  const effective = seasonId ?? seasons.find((s) => s.is_active)?.id ?? null;
  return { seasons, seasonId: effective, setSeasonId };
}

export function SeasonPicker({
  value,
  onChange,
  label = 'Época',
}: {
  value: string | null;
  onChange: (id: string) => void;
  label?: string;
}) {
  const { data: seasons = [] } = useSeasonsList();
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-[200px]">
          <SelectValue placeholder={tx('Selecionar época')} />
        </SelectTrigger>
        <SelectContent>
          {seasons.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name} {s.is_active ? tx('(ativa)') : s.status === 'archived' ? tx('(arquivada)') : s.status === 'closed' ? tx('(fechada)') : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
