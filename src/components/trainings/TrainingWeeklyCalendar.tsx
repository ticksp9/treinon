import { useState, useEffect } from 'react';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, MapPin, ChevronLeft, ChevronRight, Users, Dumbbell } from 'lucide-react';
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isToday, isBefore } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useSelectedSeasonId } from '@/hooks/useSeasonContext';
import { useAuth } from '@/lib/auth';

interface TrainingSession {
  id: string;
  date: string;
  title: string | null;
  location: string | null;
  duration_minutes: number | null;
  objectives: string | null;
  status: string;
  intensity: string | null;
  session_type: string | null;
  team_id: string;
}

interface Team {
  id: string;
  name: string;
  category: string | null;
}

interface Match {
  id: string;
  match_date: string;
  opponent_name: string;
  location: string | null;
  team_id: string;
}

interface TrainingWeeklyCalendarProps {
  onSessionSelect?: (sessionId: string) => void;
}

const INTENSITY_COLORS: Record<string, string> = {
  low: 'bg-green-500/20 text-green-700 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-700 border-orange-500/30',
  very_high: 'bg-red-500/20 text-red-700 border-red-500/30',
};

const INTENSITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  very_high: 'Muito Alta',
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho',
  planned: 'Planeado',
  published: 'Publicado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  regular: 'Regular',
  tactical: 'Tático',
  physical: 'Físico',
  recovery: 'Recuperação',
  match_prep: 'Preparação Jogo',
  activation: 'Ativação',
};

export function TrainingWeeklyCalendar({ onSessionSelect }: TrainingWeeklyCalendarProps) {
  const { scopeTeams, defaultTeamId, activeTeamId } = useActiveTeam();
  // switching team at the top of the screen re-scopes this page
  useEffect(() => { if (activeTeamId) fetchTeams(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTeamId]);
  const { user } = useAuth();
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const seasonId = useSelectedSeasonId();

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));
  const weekEnd = addDays(currentWeek, 6);

  useEffect(() => {
    if (user) fetchTeams();
  }, [user]);

  useEffect(() => {
    if (user) fetchWeekData();
  }, [user, currentWeek, selectedTeam, seasonId]);

  const fetchTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, category')

      .order('name');
    setTeams(scopeTeams(data || []));
  };

  const fetchWeekData = async () => {
    setLoading(true);
    const weekStartStr = currentWeek.toISOString();
    const weekEndStr = addDays(currentWeek, 7).toISOString();

    let sessionsQuery = supabase
      .from('training_sessions')
      .select('id, date, title, location, duration_minutes, objectives, status, intensity, session_type, team_id')

      .gte('date', weekStartStr)
      .lt('date', weekEndStr)
      .order('date');

    if (selectedTeam !== 'all') {
      sessionsQuery = sessionsQuery.eq('team_id', selectedTeam);
    }
    if (seasonId) sessionsQuery = sessionsQuery.eq('season_id', seasonId);

    let matchesQuery = supabase
      .from('matches')
      .select('id, match_date, opponent_name, location, team_id')

      .gte('match_date', weekStartStr)
      .lt('match_date', weekEndStr);

    if (selectedTeam !== 'all') {
      matchesQuery = matchesQuery.eq('team_id', selectedTeam);
    }
    if (seasonId) matchesQuery = matchesQuery.eq('season_id', seasonId);

    const [sessionsRes, matchesRes] = await Promise.all([sessionsQuery, matchesQuery]);
    setSessions(sessionsRes.data || []);
    setMatches(matchesRes.data || []);
    setLoading(false);
  };

  const getTeamName = (teamId: string) => teams.find(t => t.id === teamId)?.name || '';

  const getSessionsForDay = (day: Date) =>
    sessions.filter(s => isSameDay(new Date(s.date), day));

  const getMatchesForDay = (day: Date) =>
    matches.filter(m => isSameDay(new Date(m.match_date), day));

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold min-w-[180px] text-center">
            {format(currentWeek, "dd MMM", { locale: pt })} — {format(weekEnd, "dd MMM yyyy", { locale: pt })}
          </h3>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Hoje
          </Button>
        </div>
        {teams.length > 1 && (
          <Select value={selectedTeam} onValueChange={setSelectedTeam}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas as equipas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as equipas</SelectItem>
              {teams.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Weekly Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map(day => {
          const daySessions = getSessionsForDay(day);
          const dayMatches = getMatchesForDay(day);
          const today = isToday(day);
          const past = isBefore(day, new Date()) && !today;

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[120px] rounded-lg border p-2 ${
                today ? 'border-primary bg-primary/5' : past ? 'opacity-60' : 'border-border'
              }`}
            >
              <div className={`text-xs font-medium mb-1 ${today ? 'text-primary' : 'text-muted-foreground'}`}>
                {format(day, 'EEE', { locale: pt })}
                <span className="ml-1 font-bold">{format(day, 'd')}</span>
              </div>

              {/* Matches */}
              {dayMatches.map(m => (
                <div key={m.id} className="mb-1 p-1.5 rounded bg-destructive/10 border border-destructive/20 text-xs">
                  <div className="font-semibold text-destructive flex items-center gap-1">
                    <Dumbbell className="h-3 w-3" />
                    Jogo
                  </div>
                  {m.opponent_name && <div className="truncate">{m.opponent_name}</div>}
                  <div className="text-muted-foreground">{format(new Date(m.match_date), 'HH:mm')}</div>
                </div>
              ))}

              {/* Sessions */}
              {daySessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => onSessionSelect?.(s.id)}
                  className={`w-full text-left mb-1 p-1.5 rounded border text-xs transition-colors hover:bg-accent/50 ${
                    INTENSITY_COLORS[s.intensity || 'medium'] || INTENSITY_COLORS.medium
                  }`}
                >
                  <div className="font-medium truncate">{s.title || 'Treino'}</div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-2.5 w-2.5" />
                    {format(new Date(s.date), 'HH:mm')}
                    {s.duration_minutes && <span>({s.duration_minutes}m)</span>}
                  </div>
                  {selectedTeam === 'all' && (
                    <div className="truncate text-muted-foreground">{getTeamName(s.team_id)}</div>
                  )}
                </button>
              ))}

              {daySessions.length === 0 && dayMatches.length === 0 && (
                <div className="text-xs text-muted-foreground/50 text-center mt-4">—</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Week Summary */}
      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          {sessions.length} treino{sessions.length !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center gap-1">
          <Dumbbell className="h-4 w-4" />
          {matches.length} jogo{matches.length !== 1 ? 's' : ''}
        </div>
        {sessions.filter(s => s.status === 'completed').length > 0 && (
          <Badge variant="outline">
            {sessions.filter(s => s.status === 'completed').length} concluído{sessions.filter(s => s.status === 'completed').length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>
    </div>
  );
}
