/**
 * Match preparation, Football Manager style: the squad list next to the pitch.
 * Who is called up (starter / substitute) and who is not, with position, foot,
 * rating, form and minutes this season. Call up or leave out right here.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSquadProfiles } from '@/hooks/useSquadProfiles';
import { ratingBg, ratingTone } from '@/lib/player-card';
import { cn } from '@/lib/utils';

interface SquadRow { player_id: string; lineupId: string | null; name: string; number: number | null; position: string | null; foot: string | null; starter: boolean }

interface Props {
  teamId: string;
  called: { id: string; player_id: string; is_starter: boolean; player?: { name?: string; number?: number | null; position?: string | null; foot?: string | null } | null }[];
  maxStarters: number;
  onCallUp: (playerId: string) => void;
  /** the player did not come: take him out of this match (asks the reason) */
  onAbsent: (playerId: string) => void;
  /** player id → reason, for those already taken out */
  absences?: Record<string, string>;
}

const FOOT: Record<string, string> = { right: 'D', left: 'E', both: 'A', direito: 'D', esquerdo: 'E', ambos: 'A' };
export const footLabel = (f: string | null | undefined) => (f ? FOOT[f.toLowerCase()] ?? f.slice(0, 1).toUpperCase() : '–');
const trend = (t?: string) => (t === 'up' ? '▲' : t === 'down' ? '▼' : '');

export function PrepSquadPanel({ teamId, called, maxStarters, onCallUp, onAbsent, absences = {} }: Props) {
  const calledIds = new Set(called.map((c) => c.player_id));
  const { data: roster = [] } = useQuery({
    queryKey: ['prep-roster', teamId],
    queryFn: async () => {
      const { data } = await supabase.from('players').select('id, name, number, position, foot, is_active').eq('team_id', teamId).order('number');
      return ((data ?? []) as { id: string; name: string; number: number | null; position: string | null; foot: string | null; is_active: boolean | null }[]).filter((p) => p.is_active !== false);
    },
  });
  const { data: profiles } = useSquadProfiles([...calledIds, ...roster.map((r) => r.id)]);

  const calledRows: SquadRow[] = called.map((c) => ({
    player_id: c.player_id, lineupId: c.id, name: c.player?.name ?? '—', number: c.player?.number ?? null,
    position: c.player?.position ?? null, foot: c.player?.foot ?? roster.find((r) => r.id === c.player_id)?.foot ?? null, starter: c.is_starter,
  }));
  const starters = calledRows.filter((r) => r.starter);
  const subs = calledRows.filter((r) => !r.starter);
  const out: SquadRow[] = roster.filter((r) => !calledIds.has(r.id)).map((r) => ({ player_id: r.id, lineupId: null, name: r.name, number: r.number, position: r.position, foot: r.foot, starter: false }));

  const Row = ({ r, kind }: { r: SquadRow; kind: 'starter' | 'sub' | 'out' }) => {
    const p = profiles?.get(r.player_id);
    return (
      <tr className={cn('border-b last:border-0', kind === 'out' && 'text-muted-foreground')}>
        <td className="w-7 py-1.5 text-center font-mono text-xs text-muted-foreground">{r.number ?? '–'}</td>
        <td className="max-w-[9rem] truncate py-1.5 pr-1">
          <Link to={`/players/${r.player_id}`} className="font-medium hover:underline">{r.name}</Link>
          {kind === 'out' && r.player_id in absences && (
            <span className="ml-1.5 rounded bg-destructive/10 px-1 text-[10px] font-semibold uppercase text-destructive">Ausente{absences[r.player_id] ? ` · ${absences[r.player_id]}` : ''}</span>
          )}
        </td>
        <td className="py-1.5 text-center text-xs font-semibold">{r.position ?? '–'}</td>
        <td className="py-1.5 text-center text-xs" title="Pé preferido">{footLabel(r.foot)}</td>
        <td className="py-1.5 text-center"><span className={cn('rounded px-1 font-mono text-xs font-bold', ratingBg(p?.ability))}>{p?.ability?.toFixed(1) ?? '—'}</span></td>
        <td className={cn('py-1.5 text-center font-mono text-xs', ratingTone(p?.form.average))}>{p?.form.average != null ? `${p.form.average.toFixed(1)}${trend(p.form.trend)}` : '—'}</td>
        <td className="py-1.5 text-right font-mono text-xs">{p?.seasonMinutes ?? 0}'</td>
        <td className="py-1 text-right">
          {kind === 'out' && <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={() => onCallUp(r.player_id)} aria-label={`Convocar ${r.name}`} title="Convocar"><Plus className="h-4 w-4" /></Button>}
          {kind !== 'out' && (
            <Button size="sm" variant="ghost" className="h-7 px-1.5 text-xs text-destructive hover:text-destructive" onClick={() => onAbsent(r.player_id)} aria-label={`${r.name} está ausente: retirar do jogo`} title="Não veio ao jogo: retirar">
              <UserX className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Ausente</span>
            </Button>
          )}
        </td>
      </tr>
    );
  };

  const Section = ({ title, rows, kind, empty }: { title: string; rows: SquadRow[]; kind: 'starter' | 'sub' | 'out'; empty: string }) => (
    <>
      <tr><td colSpan={8} className="bg-muted/60 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide">{title}</td></tr>
      {rows.length === 0
        ? <tr><td colSpan={8} className="px-2 py-2 text-xs text-muted-foreground">{empty}</td></tr>
        : rows.map((r) => <Row key={r.player_id} r={r} kind={kind} />)}
    </>
  );

  return (
    <div className="space-y-1.5">
    <p className="text-xs text-muted-foreground">Faltou alguém (doença, lesão…)? Toque em <span className="font-semibold text-destructive">Ausente</span> para o tirar deste jogo antes de começar.</p>
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="py-1.5 font-medium">Nº</th>
            <th className="py-1.5 text-left font-medium">Jogador</th>
            <th className="py-1.5 font-medium">Pos</th>
            <th className="py-1.5 font-medium" title="Pé preferido">Pé</th>
            <th className="py-1.5 font-medium">Nota</th>
            <th className="py-1.5 font-medium">Forma</th>
            <th className="py-1.5 text-right font-medium" title="Minutos esta época">Min</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <Section title={`Titulares (${starters.length}/${maxStarters})`} rows={starters} kind="starter" empty="Arraste jogadores para o campo." />
          <Section title={`Suplentes (${subs.length})`} rows={subs} kind="sub" empty="Sem suplentes." />
          <Section title={`Não convocados (${out.length})`} rows={out} kind="out" empty="Todo o plantel está convocado." />
        </tbody>
      </table>
    </div>
    </div>
  );
}
