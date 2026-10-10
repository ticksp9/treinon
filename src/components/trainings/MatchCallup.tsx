import { useState, useEffect } from 'react';
import { PartMinutesEditor } from '@/components/matches/PartMinutesEditor';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { callupSummary, sendNotice, type CallupTargets } from '@/lib/notice';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { FileText, Calendar, Clock, MapPin, Users, Printer, Trophy, Plus, Home, Plane, Trash2, Edit, Play, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { POSITIONS } from '@/lib/player-constants';
import { LiveMatch } from '@/components/matches/LiveMatch';
import { CallupCommunication } from '@/components/communication/CallupCommunication';
import { getDefaultRuleProfile, normalizeAgeGroupCode, buildSnapshotFromProfile, saveMatchRuleSnapshot, buildSnapshotFromFallback } from '@/lib/match-rules-service';
import { ReportEntryModeSelector } from '@/components/matches/ReportEntryModeSelector';
import { MatchRulesPanel } from '@/components/matches/MatchRulesPanel';
import { getOrCreateMatchReport, type ReportEntryMode } from '@/lib/match-report-service';
import type { MatchRuleSnapshot } from '@/lib/match-rules-service';
import { computeAvailability, getClinicalStatusOption, type InjuryRecord } from '@/lib/player-availability';
import { ShieldAlert, ShieldCheck, Share2 } from 'lucide-react';
import { shareText } from '@/lib/share';
import { canPlayerPlayInCategory, type Gender } from '@/lib/constants';

interface Team {
  id: string;
  name: string;
  category: string | null;
  sport_type: string;
  gender?: string | null;
  match_format?: { parts?: number[] } | null;
}

interface Player {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
  photo_url: string | null;
  birth_date?: string | null;
  team_id?: string | null;
  /** Set when the player belongs to another of the coach's teams (plays up an age group) */
  fromTeam?: string | null;
}

interface Match {
  id: string;
  match_date: string;
  opponent_name: string;
  is_home: boolean;
  location: string | null;
  competition: string | null;
  status: string;
  match_type?: string;
  parts_count?: number;
  part_duration_minutes?: number | null;
  part_regulation_minutes?: number[] | null;
  is_test?: boolean;
  is_deleted?: boolean;
}

const teamFormatOf = (t?: { match_format?: { parts?: number[] } | null } | null) =>
  Array.isArray(t?.match_format?.parts) && t!.match_format!.parts!.length ? [...t!.match_format!.parts!] : null;
const sameParts = (a: number[], b: number[]) => a.length === b.length && a.every((m, i) => m === b[i]);
/** rule-snapshot fields for parts of different length */
const snapshotParts = (parts: number[]) => ({
  period_count: parts.length,
  period_1_minutes: parts[0] ?? 0,
  period_2_minutes: parts[1] ?? 0,
  period_3_minutes: parts[2] ?? 0,
  period_4_minutes: parts[3] ?? 0,
});

// Position categories for grouping
const POSITION_CATEGORIES = {
  goalkeeper: ['GK'],
  defense: ['CB', 'LB', 'RB', 'FIX'],
  midfield: ['CDM', 'CM', 'CAM', 'LM', 'RM', 'ALA'],
  attack: ['LW', 'RW', 'CF', 'ST', 'PIV', 'UNI'],
};

const POSITION_CATEGORY_LABELS: Record<string, string> = {
  goalkeeper: 'Guarda-Redes',
  defense: 'Defesas',
  midfield: 'Médios',
  attack: 'Atacantes',
  other: 'Outros',
};

export function MatchCallup() {
  const { scopeTeams, defaultTeamId, activeTeamId } = useActiveTeam();
  // switching team at the top of the screen re-scopes this page
  useEffect(() => { if (activeTeamId) fetchTeams(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTeamId]);
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string>('');
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [availabilityMap, setAvailabilityMap] = useState<Map<string, ReturnType<typeof computeAvailability>>>(new Map());
  /** Players of the team who are too old for its age group (e.g. a Sub-13 in the Sub-12) */
  const [ageBlocked, setAgeBlocked] = useState<Map<string, string>>(new Map());
  const [arrivalTime, setArrivalTime] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  /** parts chosen for the match; falls back to equal parts from the old fields */
  const currentParts = (): number[] => newMatch.partMinutes.length
    ? newMatch.partMinutes
    : Array(newMatch.partsCount || 2).fill(newMatch.partDurationMinutes || 25);
  const [creating, setCreating] = useState(false);
  // who gets the call-up by email (the club coordinator always does: the server sees to it)
  const [notify, setNotify] = useState<CallupTargets>({ parents: false, players: false });
  const emailCallup = (matchId: string, playerIds: string[]) => {
    if (playerIds.length === 0) return;
    sendNotice({ kind: 'callup', match_id: matchId, player_ids: playerIds, to: notify }).then((r) => {
      const s = callupSummary(r);
      if (s) toast[s.level](s.text);
    });
  };
  const NotifyOptions = (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">Enviar a convocatória por email</p>
      <label className="flex items-center gap-2 text-sm"><Switch checked={!!notify.parents} onCheckedChange={(v) => setNotify((n) => ({ ...n, parents: v }))} />Pais dos convocados</label>
      <label className="flex items-center gap-2 text-sm"><Switch checked={!!notify.players} onCheckedChange={(v) => setNotify((n) => ({ ...n, players: v }))} />Jogadores convocados</label>
      <p className="text-xs text-muted-foreground">Diz que o jogador está convocado, a data, a hora, o local e o adversário. Numa equipa de clube, o coordenador recebe sempre a convocatória completa.</p>
    </div>
  );
  const [deleting, setDeleting] = useState(false);
  const [showLiveMatch, setShowLiveMatch] = useState(false);
  const [liveMatchId, setLiveMatchId] = useState<string | null>(null);
  const [clubId, setClubId] = useState<string>('');
  const [loadedRuleSnapshot, setLoadedRuleSnapshot] = useState<MatchRuleSnapshot | null>(null);

  // New match form
  const [newMatch, setNewMatch] = useState({
    date: '',
    time: '',
    opponent: '',
    isHome: true,
    location: '',
    matchType: 'championship' as 'championship' | 'friendly' | 'tournament',
    competition: '',
    arrivalTime: '',
    partsCount: 2,
    partDurationMinutes: 0, // 0 = use category default
    partMinutes: [] as number[], // minutes of each part (e.g. 15, 15, 30); empty = not chosen yet
    isTest: false,
    reportEntryMode: 'live' as ReportEntryMode,
  });

  useEffect(() => {
    if (user) {
      fetchTeams();
      // Fetch club id for communication
      supabase.from('clubs').select('id').eq('owner_id', user.id).limit(1).single()
        .then(({ data }) => { if (data) setClubId(data.id); });
    }
  }, [user]);

  useEffect(() => {
    if (selectedTeam) {
      fetchPlayers();
      fetchMatches();
      // Auto-load default duration from rule profiles
      const currentTeam = teams.find(t => t.id === selectedTeam);
      if (currentTeam) {
        const ageCode = normalizeAgeGroupCode(currentTeam.category);
        getDefaultRuleProfile(currentTeam.sport_type, ageCode, clubId || null).then(profile => {
          if (profile) {
            const snapshot = buildSnapshotFromProfile(profile);
            setLoadedRuleSnapshot(snapshot);
            const fromProfile = [profile.period_1_minutes, profile.period_2_minutes, (profile as any).period_3_minutes, (profile as any).period_4_minutes]
              .slice(0, profile.period_count || 2).map((m: number | null | undefined) => m || profile.period_1_minutes);
            setNewMatch(prev => ({
              ...prev,
              partDurationMinutes: profile.period_1_minutes,
              partsCount: profile.period_count,
              // the team's own format (Equipa → Formato de jogo) wins over the generic rule profile
              partMinutes: teamFormatOf(currentTeam) ?? fromProfile,
            }));
          } else {
            // Build fallback snapshot
            const fallback = buildSnapshotFromFallback(currentTeam.sport_type);
            setLoadedRuleSnapshot(fallback);
            setNewMatch(prev => ({ ...prev, partMinutes: teamFormatOf(currentTeam) ?? Array(fallback.period_count || 2).fill(fallback.period_1_minutes || 25) }));
          }
        });
      }
    }
  }, [selectedTeam]);

  useEffect(() => {
    if (selectedMatch) {
      fetchLineup();
    }
  }, [selectedMatch]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, category, sport_type, gender, match_format')

        .order('name');

      if (error) throw error;
      // only the teams of the club/context the coach is working in: guests never come from another club
      const scoped = scopeTeams((data || []) as unknown as Team[]);
      setTeams(scoped);
      if (scoped.length > 0) {
        setSelectedTeam(defaultTeamId(scoped) ?? scoped[0].id);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayers = async () => {
    try {
      const { data: own, error } = await supabase
        .from('players')
        .select('id, name, number, position, photo_url, birth_date, team_id')
        .eq('team_id', selectedTeam)
        .eq('is_active', true)
        .order('position')
        .order('number');

      if (error) throw error;

      // Age-group rules: older players can't play down (a Sub-13 in the Sub-12),
      // younger players can play up (Sub-11/Sub-12 in the Sub-13).
      const team = teams.find(t => t.id === selectedTeam);
      const gender = (team?.gender === 'female' ? 'female' : 'male') as Gender;
      const check = (birth: string | null | undefined) =>
        team?.category && birth ? canPlayerPlayInCategory(birth, team.category, gender) : { eligible: true };

      const blocked = new Map<string, string>();
      (own || []).forEach(p => {
        const r = check(p.birth_date);
        if (!r.eligible) blocked.set(p.id, `Não pode jogar em ${team?.category}${r.reason ? ` (${r.reason})` : ''}`);
      });

      // Players from the coach's other teams who are young enough to play here
      const otherTeams = teams.filter(t => t.id !== selectedTeam);
      let guests: Player[] = [];
      if (team?.category && otherTeams.length > 0) {
        const { data: others } = await supabase
          .from('players')
          .select('id, name, number, position, photo_url, birth_date, team_id')
          .in('team_id', otherTeams.map(t => t.id))
          .eq('is_active', true);
        // All of them are loaded: in official matches only the eligible are shown,
        // in friendlies the coach can call anyone (with a warning).
        guests = (others || []).map(p => {
          const r = check(p.birth_date);
          if (!p.birth_date || !r.eligible) blocked.set(p.id, `Não pode jogar em ${team.category} em jogos oficiais${r.reason ? ` (${r.reason})` : ''}`);
          return { ...p, fromTeam: otherTeams.find(t => t.id === p.team_id)?.category || otherTeams.find(t => t.id === p.team_id)?.name || 'outra equipa' };
        });
      }

      const data = [...(own || []), ...guests];
      setAgeBlocked(blocked);
      setPlayers(data);

      const ids = data.map(p => p.id);
      if (ids.length > 0) {
        const { data: injs } = await supabase
          .from('player_injuries')
          .select('id, player_id, injury_date, return_date, expected_return_date, clinical_status, can_play, restrictions, severity')
          .in('player_id', ids);
        const grouped = new Map<string, InjuryRecord[]>();
        (injs || []).forEach((i: any) => {
          const arr = grouped.get(i.player_id) || [];
          arr.push(i as InjuryRecord);
          grouped.set(i.player_id, arr);
        });
        const avail = new Map<string, ReturnType<typeof computeAvailability>>();
        ids.forEach(id => avail.set(id, computeAvailability(grouped.get(id) || [])));
        setAvailabilityMap(avail);
      } else {
        setAvailabilityMap(new Map());
      }
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  const fetchMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('id, match_date, opponent_name, is_home, location, competition, status, match_type, parts_count, part_duration_minutes, part_regulation_minutes, is_test, is_deleted')
        .eq('team_id', selectedTeam)
        .eq('is_deleted', false)
        .order('match_date', { ascending: true });

      if (error) throw error;
      setMatches(data || []);

      // Prioritize in_progress match, then next upcoming
      const inProgress = data?.find(m => m.status === 'in_progress');
      if (inProgress) {
        setSelectedMatch(inProgress.id);
      } else {
        const upcoming = data?.find(m => new Date(m.match_date) >= new Date());
        if (upcoming) {
          setSelectedMatch(upcoming.id);
        } else if (data && data.length > 0) {
          setSelectedMatch(data[data.length - 1].id);
        }
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
    }
  };

  const fetchLineup = async () => {
    try {
      const { data, error } = await supabase
        .from('match_lineups')
        .select('player_id')
        .eq('match_id', selectedMatch);

      if (error) throw error;

      const playerIds = new Set(data?.map(l => l.player_id) || []);
      setSelectedPlayers(playerIds);
    } catch (error) {
      console.error('Error fetching lineup:', error);
    }
  };

  const getPositionCategory = (position: string | null): string => {
    if (!position) return 'other';
    for (const [category, positions] of Object.entries(POSITION_CATEGORIES)) {
      if (positions.includes(position)) return category;
    }
    return 'other';
  };

  const groupPlayersByPosition = () => {
    const groups: Record<string, Player[]> = {
      goalkeeper: [],
      defense: [],
      midfield: [],
      attack: [],
      other: [],
    };

    players.forEach(player => {
      const category = getPositionCategory(player.position);
      groups[category].push(player);
    });

    // Sort players within each group by number
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => (a.number || 99) - (b.number || 99));
    });

    return groups;
  };

  /** Friendlies: the coach decides — age rules become a warning */
  // (while a match is being created or edited, the type is the one chosen in the form —
  //  before, a new friendly still blocked players by age because it looked at the match
  //  that happened to be selected behind the dialog)
  const isFriendlyMatch = dialogOpen || editDialogOpen
    ? newMatch.matchType === 'friendly'
    : matches.find(m => m.id === selectedMatch)?.match_type === 'friendly';

  const togglePlayer = (playerId: string) => {
    setSelectedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        const tooOld = ageBlocked.get(playerId);
        if (tooOld && !isFriendlyMatch) {
          toast.error(`${tooOld} Num amigável pode convocar quem quiser: mude o tipo de jogo para Amigável.`);
          return prev;
        }
        const av = availabilityMap.get(playerId);
        if (av && !av.callable) {
          toast.error(`Bloqueado: ${av.reason || 'jogador indisponível clinicamente'}`);
          return prev;
        }
        next.add(playerId);
      }
      return next;
    });
  };

  const selectAll = () => {
    // Own team only (guests from other age groups are chosen one by one)
    setSelectedPlayers(new Set(players
      .filter(p => !p.fromTeam && !ageBlocked.has(p.id) && availabilityMap.get(p.id)?.callable !== false)
      .map(p => p.id)));
  };

  const deselectAll = () => {
    setSelectedPlayers(new Set());
  };

  const createMatchAndCallup = async () => {
    if (!user || !selectedTeam) return;
    if (!newMatch.date || !newMatch.time || !newMatch.opponent.trim()) {
      toast.error('Preencha data, hora e adversário');
      return;
    }

    setCreating(true);
    try {
      const matchDateTime = `${newMatch.date}T${newMatch.time}:00`;
      const parts = currentParts();

      // Determine competition name based on match type
      let competitionName = 'Campeonato';
      if (newMatch.matchType === 'friendly') {
        competitionName = 'Amigável';
      } else if (newMatch.matchType === 'tournament') {
        competitionName = 'Torneio';
      } else if (newMatch.competition) {
        competitionName = newMatch.competition;
      }

      // Create the match with type and configuration
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert({
          team_id: selectedTeam,
          owner_id: user.id,
          match_date: matchDateTime,
          opponent_name: newMatch.opponent,
          is_home: newMatch.isHome,
          location: newMatch.location || null,
          competition: competitionName,
          status: 'scheduled',
          match_type: newMatch.matchType,
          parts_count: parts.length,
          part_duration_minutes: parts[0] ?? null,
          part_regulation_minutes: parts,
          tournament_locked: newMatch.matchType === 'tournament',
          is_test: newMatch.isTest,
          report_entry_mode: newMatch.reportEntryMode,
          report_status: 'draft',
        })
        .select('id')
        .single();

      if (matchError) throw matchError;

      // Save match rule snapshot from the best matching profile
      const currentTeam = teams.find(t => t.id === selectedTeam);
      const ageGroupCode = normalizeAgeGroupCode(currentTeam?.category);
      const ruleProfile = await getDefaultRuleProfile(
        currentTeam?.sport_type || 'football_7',
        ageGroupCode,
        clubId || null,
        competitionName !== 'Amigável' && competitionName !== 'Torneio' ? competitionName : null
      );

      if (ruleProfile) {
        const snapshot = buildSnapshotFromProfile(ruleProfile);
        // Apply any manual overrides from the form
        Object.assign(snapshot, snapshotParts(parts));
        await saveMatchRuleSnapshot(matchData.id, snapshot, ruleProfile.id);
      } else {
        // Fallback to hardcoded rules
        const snapshot = buildSnapshotFromFallback(
          currentTeam?.sport_type || 'football_7',
          parts[0] || 35,
          parts.length || 2
        );
        Object.assign(snapshot, snapshotParts(parts));
        await saveMatchRuleSnapshot(matchData.id, snapshot);
      }

      // Create match report record
      await getOrCreateMatchReport(matchData.id, user.id, clubId || null, newMatch.reportEntryMode);

      if (selectedPlayers.size > 0) {
        const records = Array.from(selectedPlayers).map(playerId => ({
          match_id: matchData.id,
          player_id: playerId,
          owner_id: user.id,
          is_starter: false,
        }));

        const { error: lineupError } = await supabase
          .from('match_lineups')
          .insert(records);

        if (lineupError) throw lineupError;
      }
      emailCallup(matchData.id, Array.from(selectedPlayers));

      toast.success('Jogo e convocatória criados! A redirecionar para Jogos...');
      setDialogOpen(false);
      setNewMatch({
        date: '',
        time: '',
        opponent: '',
        isHome: true,
        location: '',
        matchType: 'championship',
        competition: '',
        arrivalTime: '',
        partsCount: 2,
        partDurationMinutes: 0,
        partMinutes: newMatch.partMinutes,
        isTest: false,
        reportEntryMode: 'live' as ReportEntryMode,
      });
      setSelectedPlayers(new Set());
      setArrivalTime(newMatch.arrivalTime);
      // Navigate to Matches with team context so the new match is visible
      navigate(`/matches?teamId=${selectedTeam}`);
    } catch (error: any) {
      toast.error('Erro ao criar: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const saveCallup = async () => {
    if (!user || !selectedMatch) return;

    try {
      // Delete existing lineup for this match
      await supabase
        .from('match_lineups')
        .delete()
        .eq('match_id', selectedMatch);

      // Insert new lineup records
      if (selectedPlayers.size > 0) {
        const records = Array.from(selectedPlayers).map(playerId => ({
          match_id: selectedMatch,
          player_id: playerId,
          owner_id: user.id,
          is_starter: false,
        }));

        const { error } = await supabase
          .from('match_lineups')
          .insert(records);

        if (error) throw error;
      }

      toast.success('Convocatória guardada!');
      emailCallup(selectedMatch, Array.from(selectedPlayers));
    } catch (error: any) {
      toast.error('Erro ao guardar: ' + error.message);
    }
  };

  const deleteMatch = async () => {
    if (!user || !selectedMatch) return;

    // Check if match is in progress
    const matchData = matches.find(m => m.id === selectedMatch);
    if (matchData?.status === 'in_progress') {
      toast.error('Não podes eliminar um jogo a decorrer. Termina ou cancela o jogo primeiro.');
      return;
    }

    if (!confirm('Tem a certeza que deseja eliminar este jogo?')) return;

    setDeleting(true);
    try {
      // Soft delete the match
      const { error } = await supabase
        .from('matches')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          deleted_by: user.id
        })
        .eq('id', selectedMatch);

      if (error) throw error;

      toast.success('Jogo eliminado!');
      setSelectedMatch('');
      fetchMatches();
    } catch (error: any) {
      toast.error('Erro ao eliminar: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  const openEditDialog = () => {
    if (!selectedMatchData) return;
    const matchDate = new Date(selectedMatchData.match_date);

    // Determine match type from stored type or competition name
    let matchType: 'championship' | 'friendly' | 'tournament' =
      (selectedMatchData.match_type as any) || 'championship';
    if (!selectedMatchData.match_type) {
      if (selectedMatchData.competition === 'Amigável') {
        matchType = 'friendly';
      } else if (selectedMatchData.competition === 'Torneio') {
        matchType = 'tournament';
      }
    }

    setNewMatch({
      date: format(matchDate, 'yyyy-MM-dd'),
      time: format(matchDate, 'HH:mm'),
      opponent: selectedMatchData.opponent_name,
      isHome: selectedMatchData.is_home,
      location: selectedMatchData.location || '',
      matchType,
      competition: matchType === 'championship' ? (selectedMatchData.competition || '') : '',
      arrivalTime: '',
      partsCount: selectedMatchData.parts_count || 2,
      partDurationMinutes: selectedMatchData.part_duration_minutes || 0,
      partMinutes: selectedMatchData.part_regulation_minutes?.length
        ? selectedMatchData.part_regulation_minutes
        : Array(selectedMatchData.parts_count || 2).fill(selectedMatchData.part_duration_minutes || 25),
      isTest: selectedMatchData.is_test || false,
      reportEntryMode: 'live' as ReportEntryMode,
    });
    setEditDialogOpen(true);
  };

  const updateMatch = async () => {
    if (!user || !selectedMatch) return;
    if (!newMatch.date || !newMatch.time || !newMatch.opponent.trim()) {
      toast.error('Preencha data, hora e adversário');
      return;
    }

    // Block editing parts/duration if match is in progress
    const isMatchInProgress = selectedMatchData?.status === 'in_progress';

    setCreating(true);
    try {
      const matchDateTime = `${newMatch.date}T${newMatch.time}:00`;

      // Determine competition name
      let competitionName = 'Campeonato';
      if (newMatch.matchType === 'friendly') {
        competitionName = 'Amigável';
      } else if (newMatch.matchType === 'tournament') {
        competitionName = 'Torneio';
      } else if (newMatch.competition) {
        competitionName = newMatch.competition;
      }

      const updateData: any = {
        match_date: matchDateTime,
        opponent_name: newMatch.opponent,
        is_home: newMatch.isHome,
        location: newMatch.location || null,
        competition: competitionName,
        match_type: newMatch.matchType,
        is_test: newMatch.isTest,
      };

      // Only update parts config if match is not in progress
      if (!isMatchInProgress) {
        const parts = currentParts();
        updateData.parts_count = parts.length;
        updateData.part_duration_minutes = parts[0] ?? null;
        updateData.part_regulation_minutes = parts;
        updateData.tournament_locked = newMatch.matchType === 'tournament';
      }

      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', selectedMatch);

      if (error) throw error;

      toast.success('Jogo atualizado!');
      setEditDialogOpen(false);
      fetchMatches();
    } catch (error: any) {
      toast.error('Erro ao atualizar: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  // Coaches send call-ups to the team's WhatsApp group
  const shareCallup = () => {
    const match = matches.find(m => m.id === selectedMatch);
    if (!match) return;
    const team = teams.find(t => t.id === selectedTeam);
    const date = new Date(match.match_date);
    const called = players
      .filter(p => selectedPlayers.has(p.id))
      .sort((a, b) => (a.number ?? 999) - (b.number ?? 999))
      .map(p => `${p.number ? `${p.number}. ` : '• '}${p.name}`);
    const text = [
      `⚽ *CONVOCATÓRIA* — ${team?.name ?? ''}`,
      `🆚 ${match.opponent_name} (${match.is_home ? 'casa' : 'fora'})`,
      `📅 ${format(date, "EEEE, dd/MM", { locale: pt })} às ${format(date, 'HH:mm')}`,
      arrivalTime ? `⏰ Chegada: ${arrivalTime}` : '',
      match.location ? `📍 ${match.location}` : '',
      '',
      `*Convocados (${called.length}):*`,
      ...called,
      '',
      'Confirmem a presença na app TreinON. 💪',
    ].filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n');
    shareText(text, 'Convocatória');
  };

  const printCallup = () => {
    const match = matches.find(m => m.id === selectedMatch);
    if (!match) return;

    const groupedPlayers = groupPlayersByPosition();
    const team = teams.find(t => t.id === selectedTeam);

    const content = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Convocatória - ${match.opponent_name}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          h1 { text-align: center; margin-bottom: 10px; }
          h2 { text-align: center; color: #666; margin-bottom: 30px; }
          .info { margin-bottom: 20px; padding: 15px; background: #f5f5f5; border-radius: 8px; }
          .info p { margin: 5px 0; }
          .section { margin-top: 20px; }
          .section-title { font-weight: bold; color: #333; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 2px solid #eee; }
          .player { display: flex; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee; }
          .number { width: 40px; font-weight: bold; }
          .name { flex: 1; }
          .position { color: #666; font-size: 14px; }
          .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
          .badge { display: inline-block; padding: 4px 8px; background: #e0e0e0; border-radius: 4px; font-size: 12px; margin-left: 8px; }
        </style>
      </head>
      <body>
        <h1>CONVOCATÓRIA</h1>
        <h2>${team?.name || ''} ${team?.category ? `(${team.category})` : ''}</h2>

        <div class="info">
          <p><strong>Adversário:</strong> ${match.opponent_name}</p>
          <p><strong>Data:</strong> ${format(new Date(match.match_date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: pt })}</p>
          <p><strong>Hora do Jogo:</strong> ${format(new Date(match.match_date), "HH:mm", { locale: pt })}</p>
          ${arrivalTime ? `<p><strong>Hora de Chegada:</strong> ${arrivalTime}</p>` : ''}
          ${match.location ? `<p><strong>Local:</strong> ${match.location}</p>` : ''}
          <p><strong>Tipo:</strong> ${match.competition || 'Campeonato'} <span class="badge">${match.is_home ? 'CASA' : 'FORA'}</span></p>
        </div>

        ${Object.entries(groupedPlayers)
          .filter(([_, categoryPlayers]) => categoryPlayers.some(p => selectedPlayers.has(p.id)))
          .map(([category, categoryPlayers]) => `
            <div class="section">
              <div class="section-title">${POSITION_CATEGORY_LABELS[category]} (${categoryPlayers.filter(p => selectedPlayers.has(p.id)).length})</div>
              ${categoryPlayers
                .filter(p => selectedPlayers.has(p.id))
                .map(p => `
                  <div class="player">
                    <div class="number">${p.number || '-'}</div>
                    <div class="name">${p.name}</div>
                    <div class="position">${p.position || ''}</div>
                  </div>
                `).join('')}
            </div>
          `).join('')}

        <div class="footer">
          <p>Total de Convocados: ${selectedPlayers.size}</p>
          <p>Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: pt })}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(content);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const selectedMatchData = matches.find(m => m.id === selectedMatch);
  const groupedPlayers = groupPlayersByPosition();

  const handleExitLiveMatch = () => {
    setShowLiveMatch(false);
    setLiveMatchId(null);
    fetchMatches();
  };

  // If showing live match, render it
  if (showLiveMatch && liveMatchId) {
    return (
      <LiveMatch
        matchId={liveMatchId}
        teamId={selectedTeam}
        onExit={handleExitLiveMatch}
      />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-pulse">A carregar...</div>
        </CardContent>
      </Card>
    );
  }

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sem Equipas</h3>
          <p className="text-muted-foreground">
            Crie uma equipa primeiro para gerar convocatórias.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Match Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Folha de Convocatória
          </CardTitle>
          <CardDescription>
            Crie um novo jogo e selecione os jogadores a convocar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Equipa</Label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma equipa" />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name} {team.category && `(${team.category})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Jogo</Label>
              <Select value={selectedMatch} onValueChange={setSelectedMatch}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um jogo" />
                </SelectTrigger>
                <SelectContent>
                  {matches.map(match => (
                    <SelectItem key={match.id} value={match.id}>
                      <div className="flex items-center gap-2">
                        {match.is_test && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500 text-amber-600 dark:text-amber-400">TESTE</Badge>
                        )}
                        {match.status === 'in_progress' && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">A decorrer</Badge>
                        )}
                        <span>
                          {format(new Date(match.match_date), "dd/MM")} - {match.is_home ? 'vs' : '@'} {match.opponent_name}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Hora de Chegada</Label>
              <Input
                type="time"
                value={arrivalTime}
                onChange={e => setArrivalTime(e.target.value)}
                placeholder="HH:MM"
              />
            </div>

            <div className="flex items-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Jogo
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Criar Novo Jogo e Convocatória</DialogTitle>
                    <DialogDescription>
                      Preencha os dados do jogo para criar automaticamente a convocatória
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Match Type */}
                    <div className="space-y-2">
                      <Label>Tipo de Jogo</Label>
                      <RadioGroup
                        value={newMatch.matchType}
                        onValueChange={v => {
                          const matchType = v as 'championship' | 'friendly' | 'tournament';
                          setNewMatch(prev => ({
                            ...prev,
                            matchType,
                            // Reset parts config based on type: championship/friendly start from the team format
                            partsCount: matchType === 'tournament' ? 1 : 2,
                            partDurationMinutes: 0,
                            partMinutes: matchType === 'tournament' ? [20] : (teamFormatOf(teams.find(t => t.id === selectedTeam)) ?? prev.partMinutes),
                          }));
                        }}
                        className="grid grid-cols-3 gap-2"
                      >
                        <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                          <RadioGroupItem value="championship" id="championship" />
                          <div>
                            <Label htmlFor="championship" className="cursor-pointer font-medium flex items-center gap-1">
                              <Trophy className="w-4 h-4" />
                              Campeonato
                            </Label>
                            <p className="text-xs text-muted-foreground">Formato da equipa</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                          <RadioGroupItem value="friendly" id="friendly" />
                          <div>
                            <Label htmlFor="friendly" className="cursor-pointer font-medium flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              Amigável
                            </Label>
                            <p className="text-xs text-muted-foreground">Configurável</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 border rounded-lg p-3 cursor-pointer hover:bg-muted/50">
                          <RadioGroupItem value="tournament" id="tournament" />
                          <div>
                            <Label htmlFor="tournament" className="cursor-pointer font-medium flex items-center gap-1">
                              <Trophy className="w-4 h-4" />
                              Torneio
                            </Label>
                            <p className="text-xs text-muted-foreground">Tempo bloqueado</p>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    {newMatch.matchType === 'championship' && (
                      <>
                        <div className="space-y-2">
                          <Label>Competição</Label>
                          <Input
                            value={newMatch.competition}
                            onChange={e => setNewMatch(prev => ({ ...prev, competition: e.target.value }))}
                            placeholder="Ex: Campeonato Distrital"
                          />
                        </div>
                      </>
                    )}

                    {/* Parts: number and minutes of each one (e.g. Sub-12 F7: 15 + 15 + 30) */}
                    <div className="p-3 bg-muted/30 rounded-lg space-y-2">
                      <Label>Partes e minutos</Label>
                      <PartMinutesEditor
                        value={currentParts()}
                        onChange={(partMinutes) => setNewMatch(prev => ({ ...prev, partMinutes, partsCount: partMinutes.length, partDurationMinutes: partMinutes[0] }))}
                        teamFormat={teamFormatOf(teams.find(t => t.id === selectedTeam))}
                        maxParts={newMatch.matchType === 'tournament' ? 4 : 6}
                      />
                      <p className="text-xs text-muted-foreground">
                        {newMatch.matchType === 'championship'
                          ? 'Vem do formato da equipa (Equipas → equipa → Formato de jogo). Pode ajustar para este jogo.'
                          : newMatch.matchType === 'tournament' ? '⚠️ Valores bloqueados após iniciar o jogo' : 'Amigável: como combinar com o adversário.'}
                      </p>
                    </div>

                    {/* Date and Time */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Data do Jogo *</Label>
                        <Input
                          type="date"
                          value={newMatch.date}
                          onChange={e => setNewMatch(prev => ({ ...prev, date: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Hora do Jogo *</Label>
                        <Input
                          type="time"
                          value={newMatch.time}
                          onChange={e => setNewMatch(prev => ({ ...prev, time: e.target.value }))}
                        />
                      </div>
                    </div>

                    {/* Opponent */}
                    <div className="space-y-2">
                      <Label>Adversário *</Label>
                      <Input
                        value={newMatch.opponent}
                        onChange={e => setNewMatch(prev => ({ ...prev, opponent: e.target.value }))}
                        placeholder="Nome do adversário"
                      />
                    </div>

                    {/* Home/Away */}
                    <div className="space-y-2">
                      <Label>Local</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={newMatch.isHome ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => setNewMatch(prev => ({ ...prev, isHome: true }))}
                        >
                          <Home className="w-4 h-4 mr-2" />
                          Casa
                        </Button>
                        <Button
                          type="button"
                          variant={!newMatch.isHome ? 'default' : 'outline'}
                          className="flex-1"
                          onClick={() => setNewMatch(prev => ({ ...prev, isHome: false }))}
                        >
                          <Plane className="w-4 h-4 mr-2" />
                          Fora
                        </Button>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="space-y-2">
                      <Label>Campo/Pavilhão</Label>
                      <Input
                        value={newMatch.location}
                        onChange={e => setNewMatch(prev => ({ ...prev, location: e.target.value }))}
                        placeholder="Ex: Estádio Municipal"
                      />
                    </div>

                    {/* Arrival Time */}
                    <div className="space-y-2">
                      <Label>Hora de Chegada ao Campo</Label>
                      <Input
                        type="time"
                        value={newMatch.arrivalTime}
                        onChange={e => setNewMatch(prev => ({ ...prev, arrivalTime: e.target.value }))}
                      />
                    </div>

                    {/* Loaded Rules Preview */}
                    {loadedRuleSnapshot && (
                      <MatchRulesPanel
                        snapshot={{ ...loadedRuleSnapshot, ...snapshotParts(currentParts()) }}
                        sportType={teams.find(t => t.id === selectedTeam)?.sport_type}
                        category={teams.find(t => t.id === selectedTeam)?.category}
                        compact
                        isOverridden={!sameParts(currentParts(), teamFormatOf(teams.find(t => t.id === selectedTeam)) ?? [])}
                      />
                    )}

                    {/* Report Entry Mode */}
                    <ReportEntryModeSelector
                      value={newMatch.reportEntryMode}
                      onChange={mode => setNewMatch(prev => ({ ...prev, reportEntryMode: mode }))}
                    />

                    {/* Test Match Toggle */}
                    <div className="flex items-center space-x-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                      <Checkbox
                        id="is-test-create"
                        checked={newMatch.isTest}
                        onCheckedChange={(checked) => setNewMatch(prev => ({ ...prev, isTest: !!checked }))}
                      />
                      <div className="flex-1">
                        <Label htmlFor="is-test-create" className="cursor-pointer font-medium text-amber-800 dark:text-amber-200">
                          Jogo de teste
                        </Label>
                        <p className="text-xs text-amber-600 dark:text-amber-300">
                          Não conta para estatísticas, relatórios ou PDFs
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {/* Quick Player Selection */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Jogadores Convocados ({selectedPlayers.size})</Label>
                        <div className="flex gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={selectAll}>
                            Todos
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={deselectAll}>
                            Limpar
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                        {players.map(player => (
                          <div
                            key={player.id}
                            onClick={() => togglePlayer(player.id)}
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                              selectedPlayers.has(player.id) ? 'bg-primary/10' : 'hover:bg-secondary'
                            }`}
                          >
                            <Checkbox checked={selectedPlayers.has(player.id)} />
                            <span className="text-sm">
                              {player.number && `${player.number}. `}{player.name}
                              {player.position && <span className="text-muted-foreground ml-1">({player.position})</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {NotifyOptions}

                    <Button onClick={createMatchAndCallup} className="w-full" disabled={creating}>
                      {creating ? 'A criar...' : 'Criar Jogo e Convocatória'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {selectedMatchData && (
            <div className="p-4 bg-secondary/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {selectedMatchData.opponent_name}
                    </span>
                    {selectedMatchData.is_test && (
                      <Badge variant="outline" className="border-amber-500 text-amber-600 dark:text-amber-400">
                        TESTE
                      </Badge>
                    )}
                    <Badge variant={selectedMatchData.is_home ? 'default' : 'secondary'}>
                      {selectedMatchData.is_home ? 'CASA' : 'FORA'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{format(new Date(selectedMatchData.match_date), "dd 'de' MMMM 'de' yyyy", { locale: pt })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>Jogo às {format(new Date(selectedMatchData.match_date), "HH:mm")}</span>
                  </div>
                  {selectedMatchData.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedMatchData.location}</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={openEditDialog}>
                    <Edit className="w-4 h-4 mr-1" />
                    Editar
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={deleteMatch} disabled={deleting}>
                    <Trash2 className="w-4 h-4 mr-1" />
                    {deleting ? 'A eliminar...' : 'Eliminar'}
                  </Button>
                </div>
              </div>
              {selectedMatchData.competition && (
                <Badge variant="outline">{selectedMatchData.competition}</Badge>
              )}
            </div>
          )}

          {/* Rules Panel */}
          {selectedMatchData && loadedRuleSnapshot && (() => {
            // the parts of THIS match (e.g. 15+15+30) — not the ones left in the "new match" form,
            // which made a three-part match show as 2x30' with an "override" warning
            const parts = selectedMatchData.part_regulation_minutes?.length
              ? selectedMatchData.part_regulation_minutes
              : Array(selectedMatchData.parts_count || 2).fill(selectedMatchData.part_duration_minutes || loadedRuleSnapshot.period_1_minutes || 25);
            const teamParts = teamFormatOf(teams.find(t => t.id === selectedTeam));
            return (
              <MatchRulesPanel
                snapshot={{ ...loadedRuleSnapshot, ...snapshotParts(parts) }}
                sportType={teams.find(t => t.id === selectedTeam)?.sport_type}
                category={teams.find(t => t.id === selectedTeam)?.category}
                isOverridden={!!teamParts && !sameParts(parts, teamParts)}
              />
            );
          })()}

          {/* Edit Match Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Editar Jogo</DialogTitle>
                <DialogDescription>
                  Atualize os dados do jogo
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Match Type */}
                <div className="space-y-2">
                  <Label>Tipo de Jogo</Label>
                  <RadioGroup
                    value={newMatch.matchType}
                    onValueChange={v => setNewMatch(prev => ({ ...prev, matchType: v as 'championship' | 'friendly' }))}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="championship" id="edit-championship" />
                      <Label htmlFor="edit-championship" className="cursor-pointer">Campeonato</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="friendly" id="edit-friendly" />
                      <Label htmlFor="edit-friendly" className="cursor-pointer">Amigável</Label>
                    </div>
                  </RadioGroup>
                </div>

                {newMatch.matchType === 'championship' && (
                  <div className="space-y-2">
                    <Label>Competição</Label>
                    <Input
                      value={newMatch.competition}
                      onChange={e => setNewMatch(prev => ({ ...prev, competition: e.target.value }))}
                      placeholder="Ex: Campeonato Distrital"
                    />
                  </div>
                )}

                {/* Date and Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data do Jogo *</Label>
                    <Input
                      type="date"
                      value={newMatch.date}
                      onChange={e => setNewMatch(prev => ({ ...prev, date: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora do Jogo *</Label>
                    <Input
                      type="time"
                      value={newMatch.time}
                      onChange={e => setNewMatch(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Opponent */}
                <div className="space-y-2">
                  <Label>Adversário *</Label>
                  <Input
                    value={newMatch.opponent}
                    onChange={e => setNewMatch(prev => ({ ...prev, opponent: e.target.value }))}
                    placeholder="Nome do adversário"
                  />
                </div>

                {/* Home/Away */}
                <div className="space-y-2">
                  <Label>Local</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={newMatch.isHome ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setNewMatch(prev => ({ ...prev, isHome: true }))}
                    >
                      <Home className="w-4 h-4 mr-2" />
                      Casa
                    </Button>
                    <Button
                      type="button"
                      variant={!newMatch.isHome ? 'default' : 'outline'}
                      className="flex-1"
                      onClick={() => setNewMatch(prev => ({ ...prev, isHome: false }))}
                    >
                      <Plane className="w-4 h-4 mr-2" />
                      Fora
                    </Button>
                  </div>
                </div>

                {/* Location */}
                <div className="space-y-2">
                  <Label>Campo/Pavilhão</Label>
                  <Input
                    value={newMatch.location}
                    onChange={e => setNewMatch(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Ex: Estádio Municipal"
                  />
                </div>

                {/* Test Match Toggle */}
                <div className="flex items-center space-x-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <Checkbox
                    id="is-test-edit"
                    checked={newMatch.isTest}
                    onCheckedChange={(checked) => setNewMatch(prev => ({ ...prev, isTest: !!checked }))}
                  />
                  <div className="flex-1">
                    <Label htmlFor="is-test-edit" className="cursor-pointer font-medium text-amber-800 dark:text-amber-200">
                      Jogo de teste
                    </Label>
                    <p className="text-xs text-amber-600 dark:text-amber-300">
                      Não conta para estatísticas, relatórios ou PDFs
                    </p>
                  </div>
                </div>

                <Button onClick={updateMatch} className="w-full" disabled={creating}>
                  {creating ? 'A atualizar...' : 'Atualizar Jogo'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* No matches message */}
      {selectedTeam && matches.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Não existem jogos agendados para esta equipa.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Jogo
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Player Selection - Only show if match is selected */}
      {selectedMatch && players.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <CardTitle>Jogadores Convocados</CardTitle>
                <CardDescription>
                  {selectedPlayers.size} de {players.length} jogadores selecionados
                </CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Todos
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>
                  Limpar
                </Button>
                <Separator orientation="vertical" className="h-8" />
                <Button variant="outline" size="sm" onClick={printCallup} disabled={selectedPlayers.size === 0}>
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimir
                </Button>
                <Button variant="outline" size="sm" onClick={shareCallup} disabled={selectedPlayers.size === 0}>
                  <Share2 className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
                <Button onClick={saveCallup}>
                  Guardar
                </Button>
              </div>
            </div>
          </CardHeader>
          <div className="px-6 pb-3">{NotifyOptions}</div>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {[...players]
                // official matches: players from other teams only if they may play here
                .filter(p => isFriendlyMatch || !(p.fromTeam && ageBlocked.has(p.id)))
                // own team first, then players from other age groups
                .sort((a, b) => Number(!!a.fromTeam) - Number(!!b.fromTeam) || (a.number || 99) - (b.number || 99))
                .map(player => {
                  const av = availabilityMap.get(player.id);
                  const ageReason = ageBlocked.get(player.id);
                  // friendlies: age rules are only a warning
                  const blocked = (av && !av.callable) || (!!ageReason && !isFriendlyMatch);
                  const restricted = av && av.callable && av.status !== 'apto';
                  const statusOpt = av ? getClinicalStatusOption(av.status) : null;
                  return (
                    <div
                      key={player.id}
                      onClick={() => !blocked && togglePlayer(player.id)}
                      title={blocked ? `Bloqueado: ${ageReason || av?.reason || 'indisponível'}` : av?.restrictions || ''}
                      className={`flex flex-col gap-1 p-2 rounded-lg border transition-all text-sm ${
                        blocked
                          ? 'bg-red-500/5 border-red-500/40 opacity-60 cursor-not-allowed'
                          : selectedPlayers.has(player.id)
                            ? 'bg-primary/10 border-primary cursor-pointer'
                            : 'bg-card border-border hover:border-muted-foreground/30 cursor-pointer'
                      } ${restricted ? 'border-amber-500/40' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        {blocked ? (
                          <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                        ) : (
                          <Checkbox
                            checked={selectedPlayers.has(player.id)}
                            disabled={blocked}
                            onCheckedChange={() => togglePlayer(player.id)}
                          />
                        )}
                        {player.number && (
                          <span className="font-mono text-xs text-muted-foreground w-5">
                            {player.number}
                          </span>
                        )}
                        <span className="truncate font-medium flex-1">{player.name}</span>
                        {restricted && <ShieldCheck className="w-3 h-3 text-amber-500 shrink-0" />}
                      </div>
                      {player.fromTeam && (
                        <Badge variant="outline" className="w-fit text-[10px] py-0 px-1 border-primary/40 text-primary">
                          Sobe do {player.fromTeam}
                        </Badge>
                      )}
                      {ageReason && (
                        <Badge variant="outline" className={`w-fit text-[10px] py-0 px-1 ${isFriendlyMatch ? 'border-amber-500/40 text-amber-600' : 'border-red-500/40 text-red-600'}`}>
                          {isFriendlyMatch ? 'Fora do escalão (amigável)' : 'Idade acima do escalão'}
                        </Badge>
                      )}
                      {(blocked || restricted) && !ageReason && statusOpt && (
                        <Badge variant="outline" className={`text-[10px] py-0 px-1 ${statusOpt.tone}`}>
                          {statusOpt.label}
                        </Badge>
                      )}
                      {av?.restrictions && (
                        <span className="text-[10px] text-muted-foreground truncate">⚠ {av.restrictions}</span>
                      )}
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Callup Communication Integration */}
      {selectedMatch && selectedMatchData && selectedPlayers.size > 0 && (
        <CallupCommunication
          matchId={selectedMatch}
          clubId={clubId}
          teamId={selectedTeam}
          opponentName={selectedMatchData.opponent_name}
          matchDate={selectedMatchData.match_date}
          playerIds={Array.from(selectedPlayers)}
          playerNames={Object.fromEntries(players.map(p => [p.id, p.name]))}
          canManage={true}
        />
      )}

      {selectedTeam && players.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Esta equipa não tem jogadores registados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
