/**
 * Scouting → Jogadores: the players we are watching, any age group.
 * A list to work from: who is a priority, who is on trial, who is worth another look.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus, Search, UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { cn } from '@/lib/utils';
import { ScoutPlayerFormDialog, playerFormToRow, type ScoutPlayerForm } from '@/components/scouting/ScoutPlayerFormDialog';
import { OPEN_STATUSES, STATUSES, ageOf, filterPlayers, overallMark, sortPlayers, statusLabel, type AreaKey, type ScoutPlayer, type ScoutStatus } from '@/lib/player-scouting';
import { tx } from '@/lib/i18n/ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types

type Marks = Record<AreaKey, number | null>;
interface Row extends ScoutPlayer { observations: Marks[] }

export const STATUS_TONE: Record<ScoutStatus, string> = {
  identified: 'bg-muted text-foreground',
  following: 'bg-primary/10 text-primary',
  priority: 'bg-accent/15 text-foreground ring-1 ring-accent',
  trial: 'bg-primary text-primary-foreground',
  signed: 'bg-emerald-600 text-white',
  discarded: 'bg-muted text-muted-foreground line-through',
};

export function ScoutPlayersTab() {
  const { user } = useAuth();
  const { clubId } = useUserRole();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ScoutStatus | 'open' | 'all'>('open');
  const [open, setOpen] = useState(false);

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['scout-players-list', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db.from('scout_players').select('*, observations:scout_player_observations(technical, tactical, physical, mental, potential)').order('name');
      if (error) throw error;
      return ((data ?? []) as Row[]).map((p) => ({ ...p, observations: p.observations ?? [] }));
    },
  });

  const shown = useMemo(() => sortPlayers(filterPlayers(players, { search, status, position: '' })), [players, search, status]);
  const countOf = (s: ScoutStatus | 'open' | 'all') => (s === 'all' ? players.length : s === 'open' ? players.filter((p) => OPEN_STATUSES.includes(p.status)).length : players.filter((p) => p.status === s).length);

  const create = async (form: ScoutPlayerForm) => {
    const { data, error } = await db.from('scout_players').insert({ ...playerFormToRow(form), owner_id: user!.id, club_id: clubId ?? null }).select('id').single();
    if (error) { toast.error(tx('Não foi possível criar a ficha: ') + error.message); throw error; }
    qc.invalidateQueries({ queryKey: ['scout-players-list'] });
    toast.success(tx('Ficha criada.'));
    navigate(`/scouting/jogadores/${data.id}`);
  };

  const chips: { key: ScoutStatus | 'open' | 'all'; label: string }[] = [
    { key: 'open', label: tx('Em aberto') }, ...STATUSES.map((s) => ({ key: s.key, label: s.label })), { key: 'all', label: tx('Todos') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">{tx('Jogadores de fora que queremos acompanhar. A ficha guarda só dados de futebol; cada vez que o vê, regista uma observação com notas.')}</p>
        <Button onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />{tx('Novo jogador')}</Button>
      </div>

      {players.length > 0 && (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={tx('Filtrar por estado')}>
            {chips.filter((c) => c.key === 'open' || c.key === 'all' || countOf(c.key) > 0).map((c) => (
              <Button key={c.key} size="sm" variant={status === c.key ? 'default' : 'outline'} className="h-8" aria-pressed={status === c.key} onClick={() => setStatus(c.key)}>
                {c.label}<span className="ml-1.5 font-mono text-xs opacity-70">{countOf(c.key)}</span>
              </Button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder={tx('Procurar nome, clube, escalão ou posição')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </>
      )}

      {isLoading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{tx('A carregar…')}</p>
      ) : players.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 py-12 text-center">
            <UserSearch className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">{tx('Ainda não há jogadores observados')}</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">{tx('Viu um jogador que interessa? Crie a ficha com o nome, o clube e a posição, e junte a primeira observação.')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {shown.map((p) => {
            const mark = overallMark(p.observations);
            const age = ageOf(p);
            return (
              <Link key={p.id} to={`/scouting/jogadores/${p.id}`} className="block">
                <Card className="transition-colors hover:border-primary/50">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md bg-muted font-mono leading-none" title={tx('Nota média das observações')}>
                      <span className="text-base font-bold tabular-nums">{mark != null ? String(mark).replace('.', ',') : '–'}</span>
                      <span className="text-[9px] text-muted-foreground">{tx('de 5')}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold">{p.name}</span>
                        <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', STATUS_TONE[p.status])}>{statusLabel(p.status)}</span>
                        {p.position && <Badge variant="outline">{p.position}</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {[p.current_club, p.category, age != null ? `${age} anos` : null, `${p.observations.length} ${p.observations.length === 1 ? tx('observação') : tx('observações')}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          {shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{tx('Nenhum jogador com esse filtro.')}</p>}
        </div>
      )}

      <ScoutPlayerFormDialog open={open} onOpenChange={setOpen} onSubmit={create} />
    </div>
  );
}
