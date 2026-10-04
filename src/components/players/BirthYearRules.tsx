/**
 * Birth years per team (e.g. Sub-13 = 2013, 2014). Used by the import and by
 * "distribute existing players". Saved on teams.birth_years.
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Wand2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { suggestBirthYears, type YearTeam } from '@/lib/player-import';

export const yearsToText = (y: number[] | null | undefined) => (y ?? []).slice().sort((a, b) => a - b).join(', ');
export const textToYears = (s: string) =>
  [...new Set(s.split(/[^0-9]+/).map(Number).filter((n) => n >= 1940 && n <= new Date().getFullYear()))].sort((a, b) => a - b);

interface Props {
  teams: YearTeam[];
  seasonStartYear: number;
  onChange: (teams: YearTeam[]) => void;
  /** save to the database right away (otherwise the parent saves) */
  persist?: boolean;
}

export function BirthYearRules({ teams, seasonStartYear, onChange, persist = true }: Props) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => { setDraft(Object.fromEntries(teams.map((t) => [t.id, yearsToText(t.birth_years)]))); }, [teams]);

  const commit = async (id: string, value: string) => {
    const years = textToYears(value);
    setDraft((d) => ({ ...d, [id]: yearsToText(years) }));
    const next = teams.map((t) => (t.id === id ? { ...t, birth_years: years } : t));
    onChange(next);
    if (persist) {
      const { error } = await supabase.from('teams').update({ birth_years: years } as never).eq('id', id);
      if (error) toast.error('Não foi possível guardar os anos: ' + error.message);
    }
  };
  const suggestAll = () => teams.forEach((t) => {
    if ((t.birth_years ?? []).length === 0) {
      const s = suggestBirthYears(t.category, seasonStartYear);
      if (s.length) commit(t.id, s.join(', '));
    }
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Anos de nascimento de cada equipa. Um ano pode estar em duas equipas (o jogador entra nas duas).</p>
        <Button size="sm" variant="outline" onClick={suggestAll} title="Preenche as equipas vazias pelo escalão"><Wand2 className="mr-1.5 h-4 w-4" />Sugerir</Button>
      </div>
      <div className="divide-y rounded-md border">
        {teams.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{t.name}</span>
              {t.category && <span className="text-xs text-muted-foreground">{t.category}</span>}
            </span>
            <Input
              className="h-8 w-40"
              placeholder="ex.: 2013, 2014"
              value={draft[t.id] ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [t.id]: e.target.value }))}
              onBlur={(e) => { if (e.target.value !== yearsToText(t.birth_years)) commit(t.id, e.target.value); }}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              aria-label={`Anos de nascimento de ${t.name}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
