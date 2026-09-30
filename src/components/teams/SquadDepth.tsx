/**
 * Squad depth, Football Manager style: the squad by position line with each
 * player's rating, form and minutes this season — and a side-by-side comparison
 * of two players.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GitCompare, X } from 'lucide-react';
import { useSquadProfiles, type SquadProfile } from '@/hooks/useSquadProfiles';
import { ATTRIBUTE_CATALOG, categoryAverage } from '@/lib/player-attributes';
import { ratingBg, ratingTone } from '@/lib/player-card';
import { cn } from '@/lib/utils';

interface SquadPlayer { id: string; name: string; number?: number | null; position?: string | null }

const LINES: { key: string; label: string; positions: string[] }[] = [
  { key: 'gk', label: 'Guarda-redes', positions: ['GK'] },
  { key: 'def', label: 'Defesas', positions: ['CB', 'LB', 'RB', 'FIX'] },
  { key: 'mid', label: 'Médios', positions: ['CDM', 'CM', 'CAM', 'LM', 'RM', 'ALA'] },
  { key: 'att', label: 'Avançados', positions: ['LW', 'RW', 'CF', 'ST', 'PIV', 'UNI'] },
];

const lineOf = (pos?: string | null) => LINES.find((l) => l.positions.includes((pos || '').toUpperCase()))?.key ?? 'other';
const trend = (t?: string) => (t === 'up' ? '▲' : t === 'down' ? '▼' : '');

export function SquadDepth({ players }: { players: SquadPlayer[] }) {
  const { data: profiles } = useSquadProfiles(players.map((p) => p.id));
  const [compare, setCompare] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  if (players.length === 0) return null;

  const prof = (id: string) => profiles?.get(id);
  const toggle = (id: string) =>
    setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c.slice(-1), id]));

  const groups = [...LINES, { key: 'other', label: 'Sem posição', positions: [] }]
    .map((l) => ({
      ...l,
      players: players
        .filter((p) => lineOf(p.position) === l.key)
        .sort((a, b) => (prof(b.id)?.ability ?? 0) - (prof(a.id)?.ability ?? 0)),
    }))
    .filter((g) => g.players.length > 0);

  const [a, b] = compare.map((id) => ({ player: players.find((p) => p.id === id)!, profile: prof(id) }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          Plantel por posição
          {compare.length === 2 && (
            <Button size="sm" onClick={() => setOpen(true)}><GitCompare className="mr-1.5 h-4 w-4" />Comparar</Button>
          )}
        </CardTitle>
        <CardDescription>Nota da última avaliação, forma dos últimos jogos e minutos na época. Toque em dois jogadores para os comparar.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="mb-1 flex justify-between border-b pb-1 text-xs font-semibold uppercase tracking-wide">
              {g.label}<span className="text-muted-foreground">{g.players.length}</span>
            </p>
            <ul className="space-y-1">
              {g.players.map((p, i) => {
                const pr = prof(p.id);
                const sel = compare.includes(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      className={cn('flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left text-sm transition', sel ? 'border-accent ring-2 ring-accent/30' : 'hover:bg-muted/50', i === 0 && 'font-semibold')}
                    >
                      <span className="w-5 text-center font-mono text-xs text-muted-foreground">{p.number ?? '–'}</span>
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">{pr?.seasonMinutes ?? 0}'</span>
                      {pr?.form.average != null && (
                        <span className={cn('font-mono text-[11px]', ratingTone(pr.form.average))}>{pr.form.average.toFixed(1)}{trend(pr.form.trend)}</span>
                      )}
                      <span className={cn('w-9 rounded text-center font-mono text-xs font-bold', ratingBg(pr?.ability))}>{pr?.ability?.toFixed(1) ?? '—'}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </CardContent>

      <Dialog open={open && !!a && !!b} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Comparar jogadores</DialogTitle></DialogHeader>
          {a && b && <Comparison a={a} b={b} />}
          <Button variant="ghost" size="sm" onClick={() => { setCompare([]); setOpen(false); }}>
            <X className="mr-1.5 h-4 w-4" />Limpar seleção
          </Button>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Comparison({ a, b }: { a: { player: SquadPlayer; profile?: SquadProfile }; b: { player: SquadPlayer; profile?: SquadProfile } }) {
  const rows: { label: string; va: number | null; vb: number | null; fmt?: (v: number) => string }[] = [
    { label: 'Nota', va: a.profile?.ability ?? null, vb: b.profile?.ability ?? null },
    { label: 'Forma', va: a.profile?.form.average ?? null, vb: b.profile?.form.average ?? null },
    ...ATTRIBUTE_CATALOG.map((c) => ({
      label: c.label,
      va: a.profile?.attributes ? categoryAverage(a.profile.attributes, c.key) : null,
      vb: b.profile?.attributes ? categoryAverage(b.profile.attributes, c.key) : null,
    })),
    { label: 'Minutos na época', va: a.profile?.seasonMinutes ?? 0, vb: b.profile?.seasonMinutes ?? 0, fmt: (v) => `${v}'` },
    { label: 'Jogos na época', va: a.profile?.seasonGames ?? 0, vb: b.profile?.seasonGames ?? 0, fmt: (v) => `${v}` },
  ];
  const show = (v: number | null, fmt?: (v: number) => string) => (v == null ? '—' : fmt ? fmt(v) : v.toFixed(1));
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 text-sm font-semibold">
        <Link to={`/players/${a.player.id}`} className="truncate text-right hover:underline">{a.player.name}</Link>
        <span />
        <Link to={`/players/${b.player.id}`} className="truncate hover:underline">{b.player.name}</Link>
      </div>
      {rows.map((r) => {
        const better = r.va != null && r.vb != null && r.va !== r.vb ? (r.va > r.vb ? 'a' : 'b') : null;
        const max = r.fmt ? Math.max(r.va ?? 0, r.vb ?? 0, 1) : 10;
        return (
          <div key={r.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
            <div className="flex items-center justify-end gap-2">
              <span className={cn('font-mono', better === 'a' && 'font-bold text-green-600')}>{show(r.va, r.fmt)}</span>
              <span className="h-2 w-20 overflow-hidden rounded bg-muted"><span className="ml-auto block h-full bg-primary" style={{ width: `${((r.va ?? 0) / max) * 100}%` }} /></span>
            </div>
            <span className="w-28 text-center text-xs text-muted-foreground">{r.label}</span>
            <div className="flex items-center gap-2">
              <span className="h-2 w-20 overflow-hidden rounded bg-muted"><span className="block h-full bg-accent" style={{ width: `${((r.vb ?? 0) / max) * 100}%` }} /></span>
              <span className={cn('font-mono', better === 'b' && 'font-bold text-green-600')}>{show(r.vb, r.fmt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
