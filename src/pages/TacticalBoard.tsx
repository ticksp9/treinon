/**
 * Tactical board page: the coach's board for the team talk and half-time.
 * Starts with the active team; "Carregar onze" brings the XI of a match (names,
 * numbers and formation) so there is nothing to set up by hand.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { useSportScope } from '@/hooks/useSportScope';
import { defaultSportType, isSportAllowed } from '@/lib/sport-scope';
import { TacticBoard } from '@/components/board/TacticBoard';
import { emptyBoard, placeFormation, formationCodes, type BoardPlayer, type BoardState } from '@/lib/tactic-board';
import { useTeamTactics } from '@/hooks/useTeamTactics';
import { defaultTacticCode } from '@/lib/team-tactics';

interface Team { id: string; name: string; sport_type: string | null }
interface MatchOpt { id: string; opponent_name: string; match_date: string; status: string; sport_type: string | null; live_tactics: { formation?: string; slots?: Record<string, string | null> } | null }

const NONE = '__none__';
const SEL_KEY = 'treinon_board_selection';
const readSel = (): { teamId?: string; matchId?: string } => { try { return JSON.parse(localStorage.getItem(SEL_KEY) || '{}') ?? {}; } catch { return {}; } };

export default function TacticalBoard() {
  const { user } = useAuth();
  const { scope } = useSportScope();
  const { scopeTeams, defaultTeamId, activeTeamId } = useActiveTeam();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string>(NONE);
  const [board, setBoard] = useState<{ key: string; sig?: string; initial: BoardState; players?: BoardPlayer[]; slotMap?: Record<string, string | null> } | null>(null);

  const { data: teams = [] } = useQuery({
    queryKey: ['board-teams', user?.id],
    enabled: !!user,
    queryFn: async () => ((await supabase.from('teams').select('id, name, sport_type').order('name')).data ?? []) as Team[],
  });
  const myTeams = useMemo(() => scopeTeams(teams), [teams, scopeTeams]);
  useEffect(() => { if (!teamId && myTeams.length) setTeamId(defaultTeamId(myTeams)); }, [myTeams, teamId, defaultTeamId]);
  useEffect(() => { if (activeTeamId && myTeams.some((t) => t.id === activeTeamId)) { setTeamId(activeTeamId); setMatchId(NONE); } }, [activeTeamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // coming back to the board: same team and same match as before
  const restoredSel = useRef(false);
  useEffect(() => {
    if (!teamId || restoredSel.current) return;
    restoredSel.current = true;
    const sel = readSel();
    if (sel.teamId === teamId && sel.matchId) setMatchId(sel.matchId);
  }, [teamId]);
  useEffect(() => {
    if (!teamId || !restoredSel.current) return;
    try { localStorage.setItem(SEL_KEY, JSON.stringify({ teamId, matchId })); } catch { /* ignore */ }
  }, [teamId, matchId]);

  const team = myTeams.find((t) => t.id === teamId) ?? null;
  const teamSport = team?.sport_type && isSportAllowed(scope, team.sport_type) ? team.sport_type : defaultSportType(scope);

  const { data: matches = [] } = useQuery({
    queryKey: ['board-matches', teamId],
    enabled: !!teamId,
    queryFn: async () => {
      const { data } = await supabase.from('matches').select('*').eq('team_id', teamId!).eq('is_deleted', false).order('match_date', { ascending: false }).limit(12);
      return (data ?? []) as unknown as MatchOpt[];
    },
  });

  const { map: teamTacticsMap } = useTeamTactics(teamId);
  const teamDefault = defaultTacticCode(teamTacticsMap, teamSport);

  // a clean board for the team (my shape with numbers, no opponent yet)
  useEffect(() => {
    if (matchId !== NONE) return;
    const first = teamDefault ?? formationCodes(teamSport)[0]?.code;
    const b = first ? placeFormation(emptyBoard(teamSport), 'home', first) : emptyBoard(teamSport);
    setBoard({ key: `team-${teamId}-${teamSport}${teamDefault ? `-${teamDefault}` : ''}`, initial: b });
  }, [teamId, teamSport, matchId, teamDefault]);

  // the XI of a match, with names, in the match's formation
  useEffect(() => {
    if (matchId === NONE) return;
    let alive = true;
    (async () => {
      const m = matches.find((x) => x.id === matchId);
      const { data } = await supabase.from('match_lineups').select('player_id, is_starter, player:players(id, name, number, position)').eq('match_id', matchId);
      if (!alive) return;
      const rows = (data ?? []) as unknown as { player_id: string; is_starter: boolean; player: BoardPlayer | BoardPlayer[] | null }[];
      const toPlayer = (r: (typeof rows)[number]) => (Array.isArray(r.player) ? r.player[0] : r.player);
      const starters = rows.filter((r) => r.is_starter).map(toPlayer).filter((p): p is BoardPlayer => !!p);
      const xi = starters.length ? starters : rows.map(toPlayer).filter((p): p is BoardPlayer => !!p);
      const sport = m?.sport_type || teamSport;
      const codes = formationCodes(sport);
      const code = m?.live_tactics?.formation && codes.some((c) => c.code === m.live_tactics!.formation) ? m.live_tactics.formation : (sport === teamSport && teamDefault) || codes[0]?.code;
      const slotMap = m?.live_tactics?.slots ?? undefined;
      const b = code ? placeFormation(emptyBoard(sport), 'home', code, xi, slotMap) : emptyBoard(sport);
      setBoard({ key: `match-${matchId}`, sig: `${code}|${b.tokens.map((t) => t.id).join(',')}`, initial: b, players: xi, slotMap });
    })();
    return () => { alive = false; };
  }, [matchId, matches, teamSport]);

  return (
    <AppLayout title="Quadro Tático">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {myTeams.length > 1 && (
            <Select value={teamId ?? ''} onValueChange={(v) => { setTeamId(v); setMatchId(NONE); }}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Equipa" /></SelectTrigger>
              <SelectContent>{myTeams.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <Select value={matchId} onValueChange={setMatchId}>
            <SelectTrigger className="h-9 w-72"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Quadro livre (sem nomes)</SelectItem>
              {matches.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  Onze: vs {m.opponent_name} · {new Date(m.match_date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}{m.status === 'in_progress' ? ' · a decorrer' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">Escolha um jogo para trazer o onze com nomes e a tática.</span>
        </div>
        {board && <TacticBoard key={board.key} persistKey={board.key} homeSig={board.sig} initial={board.initial} players={board.players} slotMap={board.slotMap} teamId={teamId} />}
      </div>
    </AppLayout>
  );
}
