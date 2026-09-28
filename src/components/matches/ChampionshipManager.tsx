import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Trophy, Plus, Users, Table as TableIcon, 
  Edit, Trash2, Save, X, Calendar, Globe
} from 'lucide-react';
import { FPFImport } from './FPFImport';

interface Team {
  id: string;
  name: string;
}

interface Championship {
  id: string;
  name: string;
  season: string;
  series: string | null;
  team_id: string;
}

interface ChampionshipTeam {
  id: string;
  team_name: string;
  is_own_team: boolean;
  championship_id: string;
}

interface ChampionshipResult {
  id: string;
  championship_id: string;
  home_team_id: string;
  away_team_id: string;
  home_goals: number | null;
  away_goals: number | null;
  match_date: string | null;
  matchday: number | null;
  is_played: boolean;
}

interface Standing {
  teamId: string;
  teamName: string;
  isOwnTeam: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface ChampionshipManagerProps {
  teamId: string;
  team?: Team;
}

interface FPFStanding {
  position: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export function ChampionshipManager({ teamId, team }: ChampionshipManagerProps) {
  const { user } = useAuth();
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [selectedChampionship, setSelectedChampionship] = useState<Championship | null>(null);
  const [championshipTeams, setChampionshipTeams] = useState<ChampionshipTeam[]>([]);
  const [results, setResults] = useState<ChampionshipResult[]>([]);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [fpfStandings, setFpfStandings] = useState<FPFStanding[]>([]);
  const [showFpfStandings, setShowFpfStandings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewChampionship, setShowNewChampionship] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showAddResult, setShowAddResult] = useState(false);
  
  // Form states
  const [newChampName, setNewChampName] = useState('');
  const [newChampSeason, setNewChampSeason] = useState('2024/2025');
  const [newChampSeries, setNewChampSeries] = useState('');
  const [newTeamName, setNewTeamName] = useState('');
  const [newResult, setNewResult] = useState({
    homeTeamId: '',
    awayTeamId: '',
    homeGoals: '',
    awayGoals: '',
    matchday: ''
  });

  const handleFPFImport = (imported: FPFStanding[]) => {
    setFpfStandings(imported);
    setShowFpfStandings(true);
  };

  useEffect(() => {
    if (teamId) {
      fetchChampionships();
    }
  }, [teamId]);

  useEffect(() => {
    if (selectedChampionship) {
      fetchChampionshipData();
    }
  }, [selectedChampionship]);

  useEffect(() => {
    if (championshipTeams.length > 0 && results.length > 0) {
      calculateStandings();
    } else if (championshipTeams.length > 0) {
      // Initialize standings with zero values
      const initialStandings: Standing[] = championshipTeams.map(t => ({
        teamId: t.id,
        teamName: t.team_name,
        isOwnTeam: t.is_own_team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0
      }));
      setStandings(initialStandings);
    }
  }, [championshipTeams, results]);

  const fetchChampionships = async () => {
    try {
      const { data, error } = await supabase
        .from('championships')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChampionships(data || []);
      if (data && data.length > 0 && !selectedChampionship) {
        setSelectedChampionship(data[0]);
      }
    } catch (error) {
      console.error('Error fetching championships:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChampionshipData = async () => {
    if (!selectedChampionship) return;

    try {
      const [teamsRes, resultsRes] = await Promise.all([
        supabase
          .from('championship_teams')
          .select('*')
          .eq('championship_id', selectedChampionship.id)
          .order('team_name'),
        supabase
          .from('championship_results')
          .select('*')
          .eq('championship_id', selectedChampionship.id)
          .order('matchday')
      ]);

      if (teamsRes.error) throw teamsRes.error;
      if (resultsRes.error) throw resultsRes.error;

      setChampionshipTeams(teamsRes.data || []);
      setResults(resultsRes.data || []);
    } catch (error) {
      console.error('Error fetching championship data:', error);
    }
  };

  const calculateStandings = () => {
    const standingsMap = new Map<string, Standing>();

    // Initialize standings for all teams
    championshipTeams.forEach(t => {
      standingsMap.set(t.id, {
        teamId: t.id,
        teamName: t.team_name,
        isOwnTeam: t.is_own_team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0
      });
    });

    // Calculate from results
    results.filter(r => r.is_played).forEach(result => {
      const homeTeam = standingsMap.get(result.home_team_id);
      const awayTeam = standingsMap.get(result.away_team_id);
      const homeGoals = result.home_goals ?? 0;
      const awayGoals = result.away_goals ?? 0;

      if (homeTeam) {
        homeTeam.played++;
        homeTeam.goalsFor += homeGoals;
        homeTeam.goalsAgainst += awayGoals;
        if (homeGoals > awayGoals) {
          homeTeam.won++;
          homeTeam.points += 3;
        } else if (homeGoals === awayGoals) {
          homeTeam.drawn++;
          homeTeam.points += 1;
        } else {
          homeTeam.lost++;
        }
        homeTeam.goalDifference = homeTeam.goalsFor - homeTeam.goalsAgainst;
      }

      if (awayTeam) {
        awayTeam.played++;
        awayTeam.goalsFor += awayGoals;
        awayTeam.goalsAgainst += homeGoals;
        if (awayGoals > homeGoals) {
          awayTeam.won++;
          awayTeam.points += 3;
        } else if (awayGoals === homeGoals) {
          awayTeam.drawn++;
          awayTeam.points += 1;
        } else {
          awayTeam.lost++;
        }
        awayTeam.goalDifference = awayTeam.goalsFor - awayTeam.goalsAgainst;
      }
    });

    // Sort by points, goal difference, goals for
    const sortedStandings = Array.from(standingsMap.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    setStandings(sortedStandings);
  };

  const createChampionship = async () => {
    if (!newChampName.trim() || !user) return;

    try {
      const { data, error } = await supabase
        .from('championships')
        .insert({
          name: newChampName.trim(),
          season: newChampSeason,
          series: newChampSeries.trim() || null,
          team_id: teamId,
          owner_id: user.id
        })
        .select()
        .single();

      if (error) throw error;

      // Add own team to championship
      await supabase.from('championship_teams').insert({
        championship_id: data.id,
        team_name: team?.name || 'A minha equipa',
        is_own_team: true,
        owner_id: user.id
      });

      toast.success('Campeonato criado');
      setNewChampName('');
      setNewChampSeries('');
      setShowNewChampionship(false);
      setSelectedChampionship(data);
      fetchChampionships();
    } catch (error) {
      console.error('Error creating championship:', error);
      toast.error('Erro ao criar campeonato');
    }
  };

  const addTeam = async () => {
    if (!newTeamName.trim() || !selectedChampionship || !user) return;

    try {
      await supabase.from('championship_teams').insert({
        championship_id: selectedChampionship.id,
        team_name: newTeamName.trim(),
        is_own_team: false,
        owner_id: user.id
      });

      toast.success('Equipa adicionada');
      setNewTeamName('');
      setShowAddTeam(false);
      fetchChampionshipData();
    } catch (error) {
      console.error('Error adding team:', error);
      toast.error('Erro ao adicionar equipa');
    }
  };

  const removeTeam = async (teamId: string) => {
    try {
      await supabase.from('championship_teams').delete().eq('id', teamId);
      toast.success('Equipa removida');
      fetchChampionshipData();
    } catch (error) {
      console.error('Error removing team:', error);
      toast.error('Erro ao remover equipa');
    }
  };

  const addResult = async () => {
    if (!newResult.homeTeamId || !newResult.awayTeamId || !selectedChampionship || !user) return;

    try {
      await supabase.from('championship_results').insert({
        championship_id: selectedChampionship.id,
        home_team_id: newResult.homeTeamId,
        away_team_id: newResult.awayTeamId,
        home_goals: newResult.homeGoals ? parseInt(newResult.homeGoals) : null,
        away_goals: newResult.awayGoals ? parseInt(newResult.awayGoals) : null,
        matchday: newResult.matchday ? parseInt(newResult.matchday) : null,
        is_played: newResult.homeGoals !== '' && newResult.awayGoals !== '',
        owner_id: user.id
      });

      toast.success('Resultado adicionado');
      setNewResult({ homeTeamId: '', awayTeamId: '', homeGoals: '', awayGoals: '', matchday: '' });
      setShowAddResult(false);
      fetchChampionshipData();
    } catch (error) {
      console.error('Error adding result:', error);
      toast.error('Erro ao adicionar resultado');
    }
  };

  const updateResult = async (resultId: string, homeGoals: number, awayGoals: number) => {
    try {
      await supabase
        .from('championship_results')
        .update({
          home_goals: homeGoals,
          away_goals: awayGoals,
          is_played: true
        })
        .eq('id', resultId);

      toast.success('Resultado atualizado');
      fetchChampionshipData();
    } catch (error) {
      console.error('Error updating result:', error);
      toast.error('Erro ao atualizar resultado');
    }
  };

  const deleteChampionship = async () => {
    if (!selectedChampionship) return;

    try {
      await supabase.from('championships').delete().eq('id', selectedChampionship.id);
      toast.success('Campeonato eliminado');
      setSelectedChampionship(null);
      fetchChampionships();
    } catch (error) {
      console.error('Error deleting championship:', error);
      toast.error('Erro ao eliminar campeonato');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Championship Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Campeonato
            </div>
            <Dialog open={showNewChampionship} onOpenChange={setShowNewChampionship}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-1" />
                  Novo Campeonato
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Campeonato</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome do Campeonato</Label>
                    <Input
                      value={newChampName}
                      onChange={(e) => setNewChampName(e.target.value)}
                      placeholder="Ex: Campeonato Distrital"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Época</Label>
                    <Input
                      value={newChampSeason}
                      onChange={(e) => setNewChampSeason(e.target.value)}
                      placeholder="2024/2025"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Série (opcional)</Label>
                    <Input
                      value={newChampSeries}
                      onChange={(e) => setNewChampSeries(e.target.value)}
                      placeholder="Ex: Série A"
                    />
                  </div>
                  <Button onClick={createChampionship} className="w-full">
                    <Save className="w-4 h-4 mr-2" />
                    Criar Campeonato
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {championships.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhum campeonato criado. Crie um para gerir a classificação.
            </p>
          ) : (
            <Select
              value={selectedChampionship?.id || ''}
              onValueChange={(val) => {
                const champ = championships.find(c => c.id === val);
                setSelectedChampionship(champ || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um campeonato" />
              </SelectTrigger>
              <SelectContent>
                {championships.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.series && `(${c.series})`} - {c.season}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* FPF Import Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Classificação Oficial (FPF)
            </div>
            <FPFImport onImportStandings={handleFPFImport} />
          </CardTitle>
          <CardDescription>
            Importar automaticamente a classificação do site da FPF/Associação Distrital
          </CardDescription>
        </CardHeader>
        {showFpfStandings && fpfStandings.length > 0 && (
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Equipa</TableHead>
                    <TableHead className="text-center">J</TableHead>
                    <TableHead className="text-center">V</TableHead>
                    <TableHead className="text-center">E</TableHead>
                    <TableHead className="text-center">D</TableHead>
                    <TableHead className="text-center">GM</TableHead>
                    <TableHead className="text-center">GS</TableHead>
                    <TableHead className="text-center font-bold">Pts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fpfStandings.map((s) => {
                    const isOwnTeam = team?.name && s.teamName.toLowerCase().includes(team.name.toLowerCase().split(' ')[0]);
                    return (
                      <TableRow 
                        key={s.position}
                        className={isOwnTeam ? 'bg-primary/10 font-medium' : ''}
                      >
                        <TableCell>{s.position}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {s.teamName}
                            {isOwnTeam && <Badge variant="outline" className="text-xs">Nós</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{s.played}</TableCell>
                        <TableCell className="text-center text-green-600">{s.won}</TableCell>
                        <TableCell className="text-center">{s.drawn}</TableCell>
                        <TableCell className="text-center text-red-600">{s.lost}</TableCell>
                        <TableCell className="text-center">{s.goalsFor}</TableCell>
                        <TableCell className="text-center">{s.goalsAgainst}</TableCell>
                        <TableCell className="text-center font-bold">{s.points}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        )}
      </Card>

      {selectedChampionship && (
        <Tabs defaultValue="standings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="standings" className="flex items-center gap-2">
              <TableIcon className="w-4 h-4" />
              Classificação Manual
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Equipas ({championshipTeams.length})
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Resultados ({results.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="standings">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TableIcon className="w-5 h-5" />
                  Tabela Classificativa (Calculada)
                </CardTitle>
                <CardDescription>
                  {selectedChampionship.name} {selectedChampionship.series && `- ${selectedChampionship.series}`} - Baseada nos resultados inseridos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Equipa</TableHead>
                        <TableHead className="text-center">J</TableHead>
                        <TableHead className="text-center">V</TableHead>
                        <TableHead className="text-center">E</TableHead>
                        <TableHead className="text-center">D</TableHead>
                        <TableHead className="text-center">GM</TableHead>
                        <TableHead className="text-center">GS</TableHead>
                        <TableHead className="text-center">DG</TableHead>
                        <TableHead className="text-center font-bold">Pts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {standings.map((s, idx) => (
                        <TableRow 
                          key={s.teamId} 
                          className={s.isOwnTeam ? 'bg-primary/10 font-medium' : ''}
                        >
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {s.teamName}
                              {s.isOwnTeam && <Badge variant="outline" className="text-xs">Nós</Badge>}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{s.played}</TableCell>
                          <TableCell className="text-center text-green-600">{s.won}</TableCell>
                          <TableCell className="text-center">{s.drawn}</TableCell>
                          <TableCell className="text-center text-red-600">{s.lost}</TableCell>
                          <TableCell className="text-center">{s.goalsFor}</TableCell>
                          <TableCell className="text-center">{s.goalsAgainst}</TableCell>
                          <TableCell className="text-center">{s.goalDifference > 0 ? `+${s.goalDifference}` : s.goalDifference}</TableCell>
                          <TableCell className="text-center font-bold">{s.points}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Equipas da Série
                  </div>
                  <Dialog open={showAddTeam} onOpenChange={setShowAddTeam}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar Equipa
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Equipa</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Nome da Equipa</Label>
                          <Input
                            value={newTeamName}
                            onChange={(e) => setNewTeamName(e.target.value)}
                            placeholder="Ex: FC Porto Sub-15"
                          />
                        </div>
                        <Button onClick={addTeam} className="w-full">
                          <Save className="w-4 h-4 mr-2" />
                          Adicionar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {championshipTeams.map(t => (
                    <div 
                      key={t.id} 
                      className={`flex items-center justify-between p-3 rounded-lg ${t.is_own_team ? 'bg-primary/10' : 'bg-secondary/30'}`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{t.team_name}</span>
                        {t.is_own_team && <Badge variant="outline" className="text-xs">A minha equipa</Badge>}
                      </div>
                      {!t.is_own_team && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTeam(t.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Resultados
                  </div>
                  <Dialog open={showAddResult} onOpenChange={setShowAddResult}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="w-4 h-4 mr-1" />
                        Adicionar Resultado
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Resultado</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Jornada (opcional)</Label>
                          <Input
                            type="number"
                            value={newResult.matchday}
                            onChange={(e) => setNewResult({ ...newResult, matchday: e.target.value })}
                            placeholder="Ex: 1"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Equipa Casa</Label>
                          <Select
                            value={newResult.homeTeamId}
                            onValueChange={(val) => setNewResult({ ...newResult, homeTeamId: val })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {championshipTeams.map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.team_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Golos Casa</Label>
                            <Input
                              type="number"
                              min="0"
                              value={newResult.homeGoals}
                              onChange={(e) => setNewResult({ ...newResult, homeGoals: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Golos Fora</Label>
                            <Input
                              type="number"
                              min="0"
                              value={newResult.awayGoals}
                              onChange={(e) => setNewResult({ ...newResult, awayGoals: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Equipa Fora</Label>
                          <Select
                            value={newResult.awayTeamId}
                            onValueChange={(val) => setNewResult({ ...newResult, awayTeamId: val })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {championshipTeams.filter(t => t.id !== newResult.homeTeamId).map(t => (
                                <SelectItem key={t.id} value={t.id}>{t.team_name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={addResult} className="w-full">
                          <Save className="w-4 h-4 mr-2" />
                          Guardar Resultado
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">
                      Nenhum resultado registado.
                    </p>
                  ) : (
                    results.map(r => {
                      const homeTeam = championshipTeams.find(t => t.id === r.home_team_id);
                      const awayTeam = championshipTeams.find(t => t.id === r.away_team_id);
                      
                      return (
                        <div key={r.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                          <div className="flex items-center gap-4">
                            {r.matchday && (
                              <Badge variant="outline">J{r.matchday}</Badge>
                            )}
                            <div className="flex items-center gap-2">
                              <span className={homeTeam?.is_own_team ? 'font-medium' : ''}>
                                {homeTeam?.team_name || '?'}
                              </span>
                              <span className="text-lg font-bold">
                                {r.is_played ? `${r.home_goals} - ${r.away_goals}` : 'vs'}
                              </span>
                              <span className={awayTeam?.is_own_team ? 'font-medium' : ''}>
                                {awayTeam?.team_name || '?'}
                              </span>
                            </div>
                          </div>
                          {!r.is_played && (
                            <Badge variant="secondary">Por jogar</Badge>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
