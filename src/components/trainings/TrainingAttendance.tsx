import { useState, useEffect } from 'react';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useSelectedSeasonId } from '@/hooks/useSeasonContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { sendNotice } from '@/lib/notice';
import { Calendar, Clock, Users, Save, Plus, Trash2, Settings } from 'lucide-react';
import { format, addDays, startOfWeek, parse } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';

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
  photo_url: string | null;
}

interface TrainingSession {
  id: string;
  date: string;
  location: string | null;
  duration_minutes: number | null;
  objectives: string | null;
}

interface Attendance {
  player_id: string;
  present: boolean;
  notes: string | null;
}

interface TrainingDay {
  day: number; // 0 = Sunday, 1 = Monday, etc.
  time: string;
}

const WEEKDAYS = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

export function TrainingAttendance() {
  const { scopeTeams, defaultTeamId, activeTeamId } = useActiveTeam();
  // switching team at the top of the screen re-scopes this page
  useEffect(() => { if (activeTeamId) fetchTeams(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [activeTeamId]);
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [attendance, setAttendance] = useState<Record<string, Attendance>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [trainingDays, setTrainingDays] = useState<TrainingDay[]>([]);
  const [newTrainingDay, setNewTrainingDay] = useState({ day: 1, time: '19:00' });
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState(90);
  const [generating, setGenerating] = useState(false);
  const seasonId = useSelectedSeasonId();

  useEffect(() => {
    if (user) {
      fetchTeams();
    }
  }, [user]);

  useEffect(() => {
    if (selectedTeam) {
      fetchPlayers();
      fetchSessions();
    }
  }, [selectedTeam, seasonId]);

  useEffect(() => {
    if (selectedSession && selectedTeam) {
      fetchAttendance();
    }
  }, [selectedSession, players]);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, category')

        .order('name');

      if (error) throw error;
      const scoped = scopeTeams(data || []);
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
      const { data, error } = await supabase
        .from('players')
        .select('id, name, number, position, photo_url')
        .eq('team_id', selectedTeam)
        .eq('is_active', true)
        .order('number');

      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  const fetchSessions = async () => {
    try {
      let q = supabase
        .from('training_sessions')
        .select('id, date, location, duration_minutes, objectives')
        .eq('team_id', selectedTeam);
      if (seasonId) q = q.eq('season_id', seasonId);
      const { data, error } = await q.order('date', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
      if (data && data.length > 0) {
        setSelectedSession(data[0].id);
      } else {
        setSelectedSession('');
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  const fetchAttendance = async () => {
    try {
      const { data, error } = await supabase
        .from('training_attendance')
        .select('player_id, present, notes')
        .eq('session_id', selectedSession);

      if (error) throw error;

      const attendanceMap: Record<string, Attendance> = {};
      players.forEach(player => {
        const existing = data?.find(a => a.player_id === player.id);
        attendanceMap[player.id] = existing || { player_id: player.id, present: false, notes: null };
      });
      setAttendance(attendanceMap);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const setReason = (playerId: string, notes: string) => {
    setAttendance(prev => ({ ...prev, [playerId]: { ...prev[playerId], player_id: playerId, present: prev[playerId]?.present ?? false, notes: notes || null } }));
  };

  const toggleAttendance = (playerId: string) => {
    setAttendance(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        present: !prev[playerId]?.present,
      },
    }));
  };

  const addTrainingDay = () => {
    if (trainingDays.some(d => d.day === newTrainingDay.day)) {
      toast.error('Este dia já foi adicionado');
      return;
    }
    setTrainingDays(prev => [...prev, { ...newTrainingDay }]);
  };

  const removeTrainingDay = (day: number) => {
    setTrainingDays(prev => prev.filter(d => d.day !== day));
  };

  const generateWeeklySessions = async () => {
    if (!user || !selectedTeam || trainingDays.length === 0) {
      toast.error('Configure os dias de treino primeiro');
      return;
    }

    setGenerating(true);
    try {
      const today = new Date();
      const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
      const sessionsToCreate: any[] = [];

      trainingDays.forEach(trainingDay => {
        // Calculate the date for this weekday
        let targetDate = addDays(weekStart, trainingDay.day === 0 ? 6 : trainingDay.day - 1);

        // If the date is in the past, move to next week
        if (targetDate < today) {
          targetDate = addDays(targetDate, 7);
        }

        const [hours, minutes] = trainingDay.time.split(':').map(Number);
        targetDate.setHours(hours, minutes, 0, 0);

        sessionsToCreate.push({
          team_id: selectedTeam,
          owner_id: user.id,
          date: targetDate.toISOString(),
          season_id: seasonId,
          location: location || null,
          duration_minutes: duration,
          objectives: null,
        });
      });

      const { error } = await supabase
        .from('training_sessions')
        .insert(sessionsToCreate);

      if (error) throw error;

      toast.success(`${sessionsToCreate.length} sessões de treino criadas!`);
      setConfigDialogOpen(false);
      setTrainingDays([]);
      fetchSessions();
    } catch (error: any) {
      toast.error('Erro ao criar sessões: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const saveAttendance = async () => {
    if (!user || !selectedSession) return;

    setSaving(true);
    try {
      // Delete existing attendance for this session
      await supabase
        .from('training_attendance')
        .delete()
        .eq('session_id', selectedSession);

      // Insert new attendance records
      const records = Object.values(attendance).map(a => ({
        session_id: selectedSession,
        player_id: a.player_id,
        present: a.present,
        notes: a.notes,
        owner_id: user.id,
      }));

      const { error } = await supabase
        .from('training_attendance')
        .insert(records);

      if (error) throw error;
      toast.success('Presenças guardadas!');
      // two trainings missed in a row without a reason: the club coordinator is told right away
      if (selectedTeam) {
        sendNotice({ kind: 'absence_alert', team_id: selectedTeam }).then((r) => {
          if ((r.groups?.coordenador ?? 0) > 0) toast.info('O coordenador foi avisado: há jogadores com dois treinos seguidos sem motivo de falta.');
        });
      }
    } catch (error: any) {
      toast.error('Erro ao guardar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Eliminar esta sessão de treino?')) return;

    try {
      await supabase.from('training_attendance').delete().eq('session_id', sessionId);
      const { error } = await supabase.from('training_sessions').delete().eq('id', sessionId);

      if (error) throw error;
      toast.success('Sessão eliminada');
      fetchSessions();
    } catch (error: any) {
      toast.error('Erro ao eliminar: ' + error.message);
    }
  };

  const selectedSessionData = sessions.find(s => s.id === selectedSession);
  const presentCount = Object.values(attendance).filter(a => a.present).length;
  const totalPlayers = players.length;

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
            Crie uma equipa primeiro para registar presenças.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team and Session Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Folha de Presenças
          </CardTitle>
          <CardDescription>
            Configure os dias de treino para gerar automaticamente a folha de presenças semanal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Label>Sessão de Treino</Label>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma sessão" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map(session => (
                    <SelectItem key={session.id} value={session.id}>
                      {format(new Date(session.date), "EEEE dd/MM HH:mm", { locale: pt })}
                      {session.location && ` - ${session.location}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="default">
                    <Settings className="w-4 h-4 mr-2" />
                    Configurar Treinos
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Configurar Dias de Treino</DialogTitle>
                    <DialogDescription>
                      Adicione os dias e horários de treino para gerar automaticamente as sessões semanais
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Add training day */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Dia da Semana</Label>
                        <Select
                          value={newTrainingDay.day.toString()}
                          onValueChange={v => setNewTrainingDay(prev => ({ ...prev, day: parseInt(v) }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WEEKDAYS.map(day => (
                              <SelectItem key={day.value} value={day.value.toString()}>
                                {day.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Hora</Label>
                        <div className="flex gap-2">
                          <Input
                            type="time"
                            value={newTrainingDay.time}
                            onChange={e => setNewTrainingDay(prev => ({ ...prev, time: e.target.value }))}
                          />
                          <Button type="button" size="icon" onClick={addTrainingDay}>
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* List of added days */}
                    {trainingDays.length > 0 && (
                      <div className="space-y-2">
                        <Label>Dias Configurados</Label>
                        <div className="space-y-2">
                          {trainingDays
                            .sort((a, b) => (a.day === 0 ? 7 : a.day) - (b.day === 0 ? 7 : b.day))
                            .map(day => (
                              <div key={day.day} className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline">
                                    {WEEKDAYS.find(w => w.value === day.day)?.label}
                                  </Badge>
                                  <span className="text-sm font-medium">{day.time}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive h-8 w-8 p-0"
                                  onClick={() => removeTrainingDay(day.day)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Location and Duration */}
                    <div className="space-y-2">
                      <Label>Local (opcional)</Label>
                      <Input
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        placeholder="Ex: Campo Principal"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Duração (minutos)</Label>
                      <Input
                        type="number"
                        value={duration}
                        onChange={e => setDuration(parseInt(e.target.value) || 90)}
                      />
                    </div>

                    <Button
                      onClick={generateWeeklySessions}
                      className="w-full"
                      disabled={trainingDays.length === 0 || generating}
                    >
                      {generating ? 'A gerar...' : `Gerar ${trainingDays.length} Sessões Semanais`}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {selectedSession && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => deleteSession(selectedSession)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {selectedSessionData && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {format(new Date(selectedSessionData.date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: pt })}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {format(new Date(selectedSessionData.date), "HH:mm", { locale: pt })}
              </div>
              {selectedSessionData.duration_minutes && (
                <Badge variant="outline">{selectedSessionData.duration_minutes} min</Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance List */}
      {selectedSession && players.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Lista de Jogadores</CardTitle>
                <CardDescription>
                  {presentCount} de {totalPlayers} presentes
                </CardDescription>
              </div>
              <Button onClick={saveAttendance} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'A guardar...' : 'Guardar Presenças'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <datalist id="absence-reasons">
              <option value="Doença" /><option value="Lesão" /><option value="Escola" /><option value="Motivo familiar" /><option value="Avisou" />
            </datalist>
            <p className="mb-2 text-xs text-muted-foreground">Escreva o motivo quando alguém falta e avisou. Duas faltas seguidas sem motivo geram um alerta para o coordenador do clube.</p>
            <div className="space-y-2">
              {players.map(player => (
                <div
                  key={player.id}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    attendance[player.id]?.present
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'bg-card border-border hover:border-muted-foreground/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={attendance[player.id]?.present || false}
                      onCheckedChange={() => toggleAttendance(player.id)}
                    />
                    <div className="flex items-center gap-2">
                      {player.number && (
                        <Badge variant="outline" className="font-mono">
                          {player.number}
                        </Badge>
                      )}
                      <span className="font-medium">{player.name}</span>
                      {player.position && (
                        <span className="text-sm text-muted-foreground">({player.position})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!attendance[player.id]?.present && (
                      <Input
                        className="h-8 w-32 text-xs sm:w-48"
                        maxLength={120}
                        placeholder="Motivo da falta"
                        list="absence-reasons"
                        value={attendance[player.id]?.notes ?? ''}
                        onChange={(e) => setReason(player.id, e.target.value)}
                        aria-label={`Motivo da falta de ${player.name}`}
                      />
                    )}
                    <Badge variant={attendance[player.id]?.present ? 'default' : 'secondary'}>
                      {attendance[player.id]?.present ? 'Presente' : 'Ausente'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
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
