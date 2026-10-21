import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Play, Settings, Minus, Plus } from 'lucide-react';
import { tx } from '@/lib/i18n/ui';

export interface MatchFormatConfig {
  partsCount: number;
  /** Kept for older code paths: minutes of the first part */
  partDurationMinutes: number;
  /** Minutes of each part, e.g. [15, 15, 30] */
  partMinutes: number[];
  /** Remember this format as the team's default */
  saveAsTeamFormat: boolean;
}

interface MatchConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchType: 'friendly' | 'tournament' | 'championship';
  defaultPartDuration: number;
  /** Pre-configured duration from match record (if already set) */
  savedPartDuration?: number | null;
  /** Pre-configured parts count from match record */
  savedPartsCount?: number | null;
  /** Format the coach set for this team at the start of the season */
  teamFormat?: number[] | null;
  /** Parts already chosen for this match (when it was created) */
  savedPartMinutes?: number[] | null;
  onConfirm: (config: MatchFormatConfig) => void;
  /** 'team' = editing the team's default format (no match is started) */
  mode?: 'match' | 'team';
}

const PRESETS: { label: string; parts: number[] }[] = [
  { get label() { return tx('3 partes · 15+15+30'); }, parts: [15, 15, 30] },
  { get label() { return tx('2 × 25'); }, parts: [25, 25] },
  { get label() { return tx('2 × 30'); }, parts: [30, 30] },
  { get label() { return tx('2 × 35'); }, parts: [35, 35] },
  { get label() { return tx('3 × 20'); }, parts: [20, 20, 20] },
  { get label() { return tx('4 × 12'); }, parts: [12, 12, 12, 12] },
  { get label() { return tx('1 × 20 (torneio)'); }, parts: [20] },
];

const sameFormat = (a?: number[] | null, b?: number[] | null) =>
  !!a && !!b && a.length === b.length && a.every((m, i) => m === b[i]);

export function MatchConfigModal({
  open,
  onOpenChange,
  matchType,
  defaultPartDuration,
  savedPartDuration,
  savedPartsCount,
  teamFormat,
  savedPartMinutes,
  onConfirm,
  mode = 'match',
}: MatchConfigModalProps) {
  const teamMode = mode === 'team';
  const initial = (): number[] => {
    if (savedPartMinutes && savedPartMinutes.length > 0) return savedPartMinutes;
    if (teamFormat && teamFormat.length > 0) return teamFormat;
    const d = savedPartDuration || defaultPartDuration || 45;
    const n = savedPartsCount || (matchType === 'tournament' ? 1 : 2);
    return Array(n).fill(d);
  };
  const [parts, setParts] = useState<number[]>(initial);
  const [saveAsTeamFormat, setSaveAsTeamFormat] = useState(!teamFormat);

  useEffect(() => {
    if (open) {
      setParts(initial());
      setSaveAsTeamFormat(!teamFormat);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setCount = (n: number) =>
    setParts((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? prev[prev.length - 1] ?? 25));
  const setPart = (i: number, m: number) =>
    setParts((prev) => prev.map((x, k) => (k === i ? Math.min(90, Math.max(1, m || 1)) : x)));

  const total = parts.reduce((s, m) => s + m, 0);
  const changedFromTeam = teamFormat ? !sameFormat(teamFormat, parts) : true;

  const handleConfirm = () => {
    onConfirm({
      partsCount: parts.length,
      partDurationMinutes: parts[0],
      partMinutes: parts,
      saveAsTeamFormat: teamMode || (saveAsTeamFormat && changedFromTeam),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {tx('Formato do jogo')}
          </DialogTitle>
          <DialogDescription>
            {teamMode
              ? tx('Defina os tempos de jogo do escalão (cada Associação tem os seus). Todos os jogos desta equipa começam com este formato.')
              : teamFormat
                ? tx('Formato definido para esta equipa. Pode ajustar só para este jogo.')
                : tx('Cada Associação define os tempos do escalão. Escolha o formato — fica guardado para a equipa.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Presets */}
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                type="button"
                size="sm"
                variant={sameFormat(p.parts, parts) ? 'default' : 'outline'}
                onClick={() => setParts(p.parts)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {/* Number of parts */}
          <div className="space-y-2">
            <Label>{tx('Número de partes')}</Label>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((n) => (
                <Button key={n} type="button" variant={parts.length === n ? 'default' : 'outline'} className="h-11 text-base" onClick={() => setCount(n)}>
                  {n}
                </Button>
              ))}
            </div>
          </div>

          {/* Minutes of each part */}
          <div className="space-y-2">
            <Label>{tx('Minutos de cada parte')}</Label>
            <div className="space-y-2">
              {parts.map((m, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-16 text-sm text-muted-foreground">{i + 1}{tx('.ª parte')}</span>
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => setPart(i, m - 1)} aria-label={tx('Menos um minuto')}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={90}
                    value={m}
                    onChange={(e) => setPart(i, parseInt(e.target.value, 10))}
                    className="h-10 w-16 rounded-md border bg-background text-center font-mono text-lg"
                    aria-label={tx('Minutos da {{v0}}.ª parte', { v0: i + 1 })}
                  />
                  <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={() => setPart(i, m + 1)} aria-label={tx('Mais um minuto')}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-muted/50 p-3 text-center">
            <div className="font-mono text-xl font-semibold">{parts.map((m) => `${m}'`).join(' + ')}</div>
            <div className="text-sm text-muted-foreground">{tx('Total: {{n}} minutos', { n: total })}</div>
          </div>

          {!teamMode && changedFromTeam && (
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={saveAsTeamFormat} onCheckedChange={(v) => setSaveAsTeamFormat(v === true)} className="mt-0.5" />
              <span>
                {tx('Usar sempre este formato nesta equipa')}
                <span className="block text-xs text-muted-foreground">{tx('Pode mudar em qualquer jogo.')}</span>
              </span>
            </label>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            {tx('Cancelar')}
          </Button>
          <Button className="flex-1" onClick={handleConfirm}>
            {teamMode ? tx('Guardar formato') : <><Play className="w-4 h-4 mr-2" />{tx('Iniciar jogo')}</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
