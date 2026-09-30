/**
 * Before kick-off, Football Manager style: automatic selection, captain and
 * set-piece takers, and the assistant's short report.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Scale, ClipboardList, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { Candidate, AssistantNote, PickMode } from '@/lib/team-selection';
import type { SetPieceRoles } from '@/lib/live-tactics';
import { cn } from '@/lib/utils';

const ROLES: { key: keyof SetPieceRoles; label: string }[] = [
  { key: 'captain', label: 'Capitão' },
  { key: 'penalties', label: 'Penáltis' },
  { key: 'corners', label: 'Cantos' },
  { key: 'free_kicks', label: 'Livres' },
];

const NONE = '__none__';

interface Props {
  squad: Candidate[];
  roles: SetPieceRoles;
  notes: AssistantNote[];
  onAutoPick: (mode: PickMode) => Promise<void>;
  onRolesChange: (roles: SetPieceRoles) => void;
}

export function PreMatchPanel({ squad, roles, notes, onAutoPick, onRolesChange }: Props) {
  const [busy, setBusy] = useState<PickMode | null>(null);
  const pick = async (mode: PickMode) => {
    setBusy(mode);
    try { await onAutoPick(mode); } finally { setBusy(null); }
  };
  const sorted = [...squad].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="mt-4 space-y-4 border-t pt-4">
      {/* Automatic selection */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Seleção automática</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => pick('best')} disabled={!!busy}>
            {busy === 'best' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Melhor onze
          </Button>
          <Button variant="outline" onClick={() => pick('fair')} disabled={!!busy}>
            {busy === 'fair' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Scale className="mr-2 h-4 w-4" />}
            Minutos justos
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Melhor onze: nota, forma e posição. Minutos justos: começa quem jogou menos esta época.
        </p>
      </div>

      {/* Captain and set pieces */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capitão e bolas paradas</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ROLES.map((r) => (
            <div key={r.key} className="space-y-1">
              <span className="text-xs text-muted-foreground">{r.label}</span>
              <Select
                value={roles[r.key] ?? NONE}
                onValueChange={(v) => onRolesChange({ ...roles, [r.key]: v === NONE ? null : v })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {sorted.map((c) => <SelectItem key={c.player_id} value={c.player_id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      {/* Assistant report */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <ClipboardList className="h-3.5 w-3.5" /> Relatório do adjunto
        </p>
        <ul className="space-y-1">
          {notes.map((n, i) => (
            <li
              key={i}
              className={cn(
                'flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm',
                n.tone === 'warn' && 'border-amber-500/40 bg-amber-500/5',
                n.tone === 'good' && 'border-green-600/30 bg-green-600/5',
              )}
            >
              {n.tone === 'warn' ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                : n.tone === 'good' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  : <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
              {n.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
