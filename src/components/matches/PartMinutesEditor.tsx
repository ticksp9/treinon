/**
 * Match format with parts of different length (e.g. Sub-12 F7: 15 + 15 + 30).
 * Number of parts and the minutes of each part.
 */
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export const formatParts = (parts: number[]) =>
  parts.length > 1 && parts.every((m) => m === parts[0]) ? `${parts.length}×${parts[0]}'` : parts.map((m) => `${m}'`).join(' + ');

interface Props {
  value: number[];
  onChange: (parts: number[]) => void;
  maxParts?: number;
  /** the team's own format (Equipa → Formato de jogo), offered as a one-tap choice */
  teamFormat?: number[] | null;
  disabled?: boolean;
}

const PRESETS: number[][] = [[15, 15, 30], [25, 25], [30, 30], [20, 20, 20], [12, 12, 12, 12], [20]];

export function PartMinutesEditor({ value, onChange, maxParts = 6, teamFormat, disabled }: Props) {
  const setCount = (n: number) => onChange(Array.from({ length: n }, (_, i) => value[i] ?? value[value.length - 1] ?? 25));
  const setPart = (i: number, m: number) => onChange(value.map((x, k) => (k === i ? Math.min(90, Math.max(1, Math.round(m) || 1)) : x)));
  const total = value.reduce((s, m) => s + m, 0);
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((m, i) => m === b[i]);
  const presets = teamFormat?.length && !PRESETS.some((p) => same(p, teamFormat)) ? [teamFormat, ...PRESETS] : PRESETS;

  return (
    <div className={cn('space-y-3', disabled && 'pointer-events-none opacity-60')}>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Button key={p.join('-')} type="button" size="sm" variant={same(p, value) ? 'default' : 'outline'} className="h-7 px-2 text-xs" onClick={() => onChange([...p])}>
            {teamFormat && same(p, teamFormat) ? `Equipa: ${formatParts(p)}` : formatParts(p)}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="mr-1 text-sm">Partes</span>
          <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setCount(Math.max(1, value.length - 1))} aria-label="Menos partes"><Minus className="h-3.5 w-3.5" /></Button>
          <span className="w-6 text-center font-mono font-semibold">{value.length}</span>
          <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setCount(Math.min(maxParts, value.length + 1))} aria-label="Mais partes"><Plus className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {value.map((m, i) => (
            <label key={i} className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm">
              <span className="text-xs text-muted-foreground">{i + 1}.ª</span>
              <input
                type="number" inputMode="numeric" min={1} max={90} value={m}
                onChange={(e) => setPart(i, Number(e.target.value))}
                className="w-12 bg-transparent text-center font-mono outline-none"
                aria-label={`Minutos da ${i + 1}.ª parte`}
              />
              <span className="text-xs text-muted-foreground">min</span>
            </label>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">Total <b className="font-mono text-foreground">{total}'</b></span>
      </div>
    </div>
  );
}
