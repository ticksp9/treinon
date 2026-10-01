import { useState, useEffect } from 'react';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Activity, AlertTriangle, Save, TrendingUp, Users, Zap } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useSelectedSeasonId } from '@/hooks/useSeasonContext';
import { useAuth } from '@/lib/auth';

interface Team {
  id: string;
  name: string;
  category: string | null;
}

interface Player {
  id: string;
  name: string;
  number: number | null;
  position: string | null;
}

interface LoadEntry {
  id: string;
  session_id: string;
  player_id: string;
  rpe: number | null;
  duration_minutes: number | null;
  load_score: number | null;
  planned_intensity: string | null;
  actual_intensity: string | null;
  notes: string | null;
  created_at: string;
}

interface TrainingSession {
  id: string;
  date: string;
  title: string | null;
  duration_minutes: number | null;
  intensity: string | null;
}

interface PlayerLoadSummary {
  player: Player;
  totalLoad: number;
  sessionCount: number;
  avgRpe: number;
  lastSessionDate: string | null;
  warning: string | null;
}

const INTENSITY_MULTIPLIER: Record<string, number> = {
  low: 0.5,
  medium: 1.0,
  high: 1.5,
  very_high: 2.0,
};

export function TrainingLoadView() {
  const { scopeTeams, defaultTeamId, activeTeamId } = useActiveTeam();
  // switching team at the top of the screen re-scopes this page
  useEffect(() => { if (activeTeamId) fetchTeams(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTeamId]);
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loadEntries, setLoadEntries] = useState<LoadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState('');
  const [showInputDialog, setShowInputDialog] = useState(false);
  const [playerRpes, setPlayerRpes] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [period, setPeriod] = useState('7');
  const seasonId = useSelectedSeasonId();

  useEffect(() => {
    if (user) fetchTeams();
  }, [user]);

  useEffect(() => {
    if (selectedTeam) {
      fetchPlayers();
      fetchSessionsAndLoad();
    }
  }, [selectedTeam, period, seasonId]);

  const fetchTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, name, category')

      .order('name');
    const scoped = scopeTeams(data || []);
    setTeams(scoped);
    if (scoped.length) setSelectedTeam(defaultTeamId(scoped) ?? scoped[0].id);
    setLoading(false);
  };

  const fetchPlayers = async () => {
    const { data } = await supabase
      .from('players')
      .select('id, name, number, position')
      .eq('team_id', selectedTeam)
      .eq('is_active', true)
      .order('number');
    setPlayers(data || []);
  };

  const fetchSessionsAndLoad = async () => {
    const sinceDate = subDays(new Date(), parseInt(period)).toISOString();

    const [sessionsRes, loadRes] = await Promise.all([
      (seasonId
        ? supabase.from('training_sessions').select('id, date, title, duration_minutes, intensity').eq('season_id', seasonId)
        : supabase.from('training_sessions').select('id, date, title, duration_minutes, intensity'))
        .eq('team_id', selectedTeam)

        .gte('date', sinceDate)
        .order('date', { ascending: false }),
      supabase
        .from('training_load')
        .select('*')
        .eq('team_id', selectedTeam)

        .gte('created_at', sinceDate),
    ]);

    setSessions(sessionsRes.data || []);
    setLoadEntries(loadRes.data || []);
  };

  const calculatePlayerSummaries = (): PlayerLoadSummary[] => {
    return players.map(player => {
      const playerEntries = loadEntries.filter(e => e.player_id === player.id);
      const totalLoad = playerEntries.reduce((sum, e) => sum + (Number(e.load_score) || 0), 0);
      const sessionCount = playerEntries.length;
      const avgRpe = sessionCount > 0
        ? playerEntries.reduce((sum, e) => sum + (e.rpe || 5), 0) / sessionCount
        : 0;
      const lastEntry = playerEntries.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

      let warning: string | null = null;
      if (avgRpe >= 8 && sessionCount >= 3) warning = 'Carga elevada';
      else if (sessionCount === 0 && parseInt(period) >= 7) warning = 'Baixa participação';
      else if (avgRpe >= 9) warning = 'RPE muito alto';

      return {
        player,
        totalLoad: Math.round(totalLoad),
        sessionCount,
        avgRpe: Math.round(avgRpe * 10) / 10,
        lastSessionDate: lastEntry?.created_at || null,
        warning,
      };
    }).sort((a, b) => b.totalLoad - a.totalLoad);
  };

  const openLoadInput = (sessionId: string) => {
    setSelectedSession(sessionId);
    const session = sessions.find(s => s.id === sessionId);
    const existingEntries = loadEntries.filter(e => e.session_id === sessionId);

    const rpes: Record<string, number> = {};
    players.forEach(p => {
      const existing = existingEntries.find(e => e.player_id === p.id);
      rpes[p.id] = existing?.rpe || 5;
    });
    setPlayerRpes(rpes);
    setShowInputDialog(true);
  };

  const saveLoad = async () => {
    if (!user || !selectedSession) return;
    setSaving(true);

    try {
      const session = sessions.find(s => s.id === selectedSession);
      const duration = session?.duration_minutes || 90;
      const intensityMult = INTENSITY_MULTIPLIER[session?.intensity || 'medium'] || 1;

      const records = players.map(p => ({
        session_id: selectedSession,
        player_id: p.id,
        team_id: selectedTeam,
        owner_id: user.id,
        rpe: playerRpes[p.id] || 5,
        duration_minutes: duration,
        load_score: Math.round((playerRpes[p.id] || 5) * duration * intensityMult / 10),
        planned_intensity: session?.intensity || 'medium',
        actual_intensity: session?.intensity || 'medium',
      }));

      // Upsert
      const { error } = await supabase
        .from('training_load')
        .upsert(records, { onConflict: 'session_id,player_id' });

      if (error) throw error;
      toast.success('Carga registada com sucesso!');
      setShowInputDialog(false);
      fetchSessionsAndLoad();
    } catch (error: any) {
      toast.error('Erro ao guardar carga: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const summaries = calculatePlayerSummaries();
  const warnings = summaries.filter(s => s.warning);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">A carregar...</CardContent>
      </Card>
    );
  }

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Sem Equipas</h3>
          <p className="text-muted-foreground">Crie uma equipa primeiro.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Carga de Treino
          </CardTitle>
          <CardDescription>Registo e monitorização da carga dos atletas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Equipa</Label>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Período</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="14">14 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="border-orange-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-600">
              <AlertTriangle className="w-4 h-4" />
              Alertas ({warnings.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {warnings.map(w => (
                <Badge key={w.player.id} variant="outline" className="border-orange-500/30 text-orange-600">
                  {w.player.name} — {w.warning}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Load Input by Session */}
      {sessions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Registar Carga por Sessão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessions.slice(0, 5).map(s => {
                const hasLoad = loadEntries.some(e => e.session_id === s.id);
                return (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-lg border">
                    <div className="text-sm">
                      <span className="font-medium">{s.title || 'Treino'}</span>
                      <span className="text-muted-foreground ml-2">
                        {format(new Date(s.date), "dd/MM HH:mm", { locale: pt })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasLoad && <Badge variant="outline" className="text-green-600">Registado</Badge>}
                      <Button size="sm" variant={hasLoad ? 'ghost' : 'default'} onClick={() => openLoadInput(s.id)}>
                        {hasLoad ? 'Editar' : 'Registar'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Player Load Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Resumo por Atleta — últimos {period} dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summaries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sem dados de carga neste período.</p>
          ) : (
            <div className="space-y-2">
              {summaries.map(s => (
                <div key={s.player.id} className="flex items-center justify-between p-2 rounded-lg border">
                  <div className="flex items-center gap-2">
                    {s.player.number && (
                      <Badge variant="outline" className="font-mono text-xs">{s.player.number}</Badge>
                    )}
                    <span className="text-sm font-medium">{s.player.name}</span>
                    {s.warning && (
                      <Badge variant="destructive" className="text-xs">{s.warning}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{s.sessionCount} sessões</span>
                    {s.avgRpe > 0 && <span>RPE {s.avgRpe}</span>}
                    <Badge variant="outline">
                      <Zap className="h-3 w-3 mr-1" />
                      {s.totalLoad}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Load Input Dialog */}
      <Dialog open={showInputDialog} onOpenChange={setShowInputDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registar Carga — RPE</DialogTitle>
            <DialogDescription>
              Indique o esforço percebido (1-10) de cada jogador
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {players.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-32 text-sm font-medium truncate">
                  {p.number && <span className="text-muted-foreground mr-1">#{p.number}</span>}
                  {p.name}
                </div>
                <div className="flex-1">
                  <Slider
                    value={[playerRpes[p.id] || 5]}
                    onValueChange={([v]) => setPlayerRpes(prev => ({ ...prev, [p.id]: v }))}
                    min={1}
                    max={10}
                    step={1}
                    className="flex-1"
                  />
                </div>
                <Badge variant={
                  (playerRpes[p.id] || 5) >= 8 ? 'destructive' :
                  (playerRpes[p.id] || 5) >= 6 ? 'default' : 'secondary'
                } className="w-8 justify-center">
                  {playerRpes[p.id] || 5}
                </Badge>
              </div>
            ))}
          </div>
          <Button onClick={saveLoad} disabled={saving} className="w-full mt-4">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'A guardar...' : 'Guardar Carga'}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
