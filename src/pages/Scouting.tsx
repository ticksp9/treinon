/**
 * Scouting → Adversários: the archive of the teams we face.
 * Each one has a sheet (schemes of how they play, squad, matches watched). Opponents of the
 * matches already in the calendar are offered here, so a sheet starts with one tap.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, Plus, Search, Shield, UserSearch } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { OpponentFormDialog, formToRow, type OpponentForm } from '@/components/scouting/OpponentFormDialog';
import { ScoutPlayersTab } from '@/components/scouting/ScoutPlayersTab';
import { normalizeTeamName, sheetSummary, sportLabel, type Opponent } from '@/lib/opponent-scouting';
import { tx } from '@/lib/i18n/ui';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types

interface Row extends Opponent { players: { count: number }[]; schemes: { count: number }[]; observations: { count: number }[] }
interface CalendarMatch { opponent_name: string; match_date: string; sport_type: string | null; competition: string | null; team: { name: string; category: string | null; sport_type: string | null } | null }

export default function Scouting() {
  const { user } = useAuth();
  const { clubId } = useUserRole();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'jogadores' ? 'jogadores' : 'adversarios';
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<{ defaults?: Partial<OpponentForm> } | null>(null);

  const { data: opponents = [], isLoading } = useQuery({
    queryKey: ['scout-opponents', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db.from('scout_opponents')
        .select('*, players:scout_opponent_players(count), schemes:scout_opponent_schemes(count), observations:scout_opponent_observations(count)')
        .order('name');
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // opponents already in the calendar that have no sheet yet
  const { data: calendar = [] } = useQuery({
    queryKey: ['scout-calendar', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from('matches').select('opponent_name, match_date, sport_type, competition, team:teams(name, category, sport_type)')
        .eq('is_deleted', false).order('match_date', { ascending: false }).limit(200);
      return (data ?? []) as unknown as CalendarMatch[];
    },
  });
  const suggestions = useMemo(() => {
    const have = new Set(opponents.map((o) => normalizeTeamName(o.name)));
    const seen = new Map<string, CalendarMatch>();
    const now = new Date().toISOString();
    // the next match against each team if there is one, else the last
    for (const m of [...calendar].sort((a, b) => Math.abs(Date.parse(a.match_date) - Date.parse(now)) - Math.abs(Date.parse(b.match_date) - Date.parse(now)))) {
      const key = normalizeTeamName(m.opponent_name);
      if (!key || have.has(key) || seen.has(key)) continue;
      seen.set(key, m);
    }
    return [...seen.values()].slice(0, 8);
  }, [calendar, opponents]);

  const shown = useMemo(() => {
    const q = normalizeTeamName(search);
    return q ? opponents.filter((o) => normalizeTeamName(`${o.name} ${o.category ?? ''} ${o.competition ?? ''}`).includes(q)) : opponents;
  }, [opponents, search]);

  const create = async (form: OpponentForm) => {
    const { data, error } = await db.from('scout_opponents').insert({ ...formToRow(form), owner_id: user!.id, club_id: clubId ?? null }).select('id').single();
    if (error) { toast.error(tx('Não foi possível criar a ficha: ') + error.message); throw error; }
    qc.invalidateQueries({ queryKey: ['scout-opponents'] });
    toast.success(tx('Ficha criada.'));
    navigate(`/scouting/adversarios/${data.id}`);
  };

  const count = (r: Row, k: 'players' | 'schemes' | 'observations') => r[k]?.[0]?.count ?? 0;

  return (
    <AppLayout title={tx('Scouting')}>
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="inline-flex rounded-md border bg-muted/40 p-1" role="tablist" aria-label={tx('Scouting')}>
          {([['adversarios', 'Adversários', Shield], ['jogadores', 'Jogadores', UserSearch]] as const).map(([key, label, Icon]) => (
            <Button key={key} role="tab" aria-selected={tab === key} size="sm" variant={tab === key ? 'default' : 'ghost'} className="h-9" onClick={() => setParams(key === 'adversarios' ? {} : { tab: key }, { replace: true })}>
              <Icon className="mr-1.5 h-4 w-4" />{label}
            </Button>
          ))}
        </div>

        {tab === 'jogadores' ? <ScoutPlayersTab /> : (<>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold"><Shield className="h-5 w-5 text-primary" />{tx('Adversários')}</h1>
            <p className="text-sm text-muted-foreground">{tx('Uma ficha por equipa: como jogam, o plantel e o que foi visto em cada jogo.')}{clubId ? tx(' Partilhado com a equipa técnica do clube.') : tx(' Partilhado com os seus adjuntos.')}</p>
          </div>
          <Button onClick={() => setDialog({})}><Plus className="mr-1.5 h-4 w-4" />{tx('Novo adversário')}</Button>
        </div>

        {suggestions.length > 0 && (
          <Card>
            <CardContent className="space-y-2 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx('Do calendário, ainda sem ficha')}</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((m) => (
                  <Button key={m.opponent_name} size="sm" variant="outline" className="h-9"
                    onClick={() => setDialog({ defaults: { name: m.opponent_name, category: m.team?.category ?? '', sport_type: m.sport_type || m.team?.sport_type || 'football_11', competition: m.competition ?? '' } })}>
                    <Plus className="mr-1 h-3.5 w-3.5" />{m.opponent_name}
                    <span className="ml-1.5 text-xs text-muted-foreground">{new Date(m.match_date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {opponents.length > 5 && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder={tx('Procurar equipa, escalão ou competição')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        )}

        {isLoading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{tx('A carregar…')}</p>
        ) : opponents.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 py-12 text-center">
              <Shield className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium">{tx('Ainda não há adversários')}</p>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">{tx('Crie a ficha da próxima equipa que vai defrontar e desenhe como ela ataca e defende. A ficha fica guardada para os jogos seguintes.')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {shown.map((o) => (
              <Link key={o.id} to={`/scouting/adversarios/${o.id}`} className="block">
                <Card className="transition-colors hover:border-primary/50">
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold">{o.name}</span>
                        {o.category && <Badge variant="secondary">{o.category}</Badge>}
                        <Badge variant="outline">{sportLabel(o.sport_type)}</Badge>
                        {o.usual_formation && <Badge variant="outline" className="font-mono">{o.usual_formation}</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {o.competition ? `${o.competition} · ` : ''}{sheetSummary({ schemes: count(o, 'schemes'), players: count(o, 'players'), observations: count(o, 'observations') })}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
            {shown.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{tx('Nenhuma equipa com esse nome.')}</p>}
          </div>
        )}
        </>)}
      </div>

      <OpponentFormDialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)} defaults={dialog?.defaults} onSubmit={create} />
    </AppLayout>
  );
}
