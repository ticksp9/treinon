import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Download, RefreshCw, Globe, Trophy, Loader2 } from 'lucide-react';
import { getSeasonStartYear, getSeasonName } from '@/lib/constants';

// AF Associations with their IDs in the FPF system
const ASSOCIATIONS = [
  { id: '219', name: 'AF Braga' },
  { id: '220', name: 'AF Porto' },
  { id: '221', name: 'AF Lisboa' },
  { id: '222', name: 'AF Viana do Castelo' },
  { id: '223', name: 'AF Vila Real' },
  { id: '224', name: 'AF Bragança' },
  { id: '225', name: 'AF Aveiro' },
  { id: '226', name: 'AF Viseu' },
  { id: '227', name: 'AF Guarda' },
  { id: '228', name: 'AF Castelo Branco' },
  { id: '229', name: 'AF Coimbra' },
  { id: '230', name: 'AF Leiria' },
  { id: '231', name: 'AF Santarém' },
  { id: '232', name: 'AF Portalegre' },
  { id: '233', name: 'AF Évora' },
  { id: '234', name: 'AF Beja' },
  { id: '235', name: 'AF Setúbal' },
  { id: '236', name: 'AF Algarve' },
  { id: '237', name: 'AF Madeira' },
  { id: '238', name: 'AF Açores' },
];

// Seasons with their IDs in the FPF system.
// The FPF increments the id by one per season: 97 = 2023/2024, 98 = 2024/2025,
// 99 = 2025/2026 → id = start year − 1926. Previously this list and the
// "current season" were hardcoded and stuck on 2025/2026.
const FPF_SEASON_ID_OFFSET = 1926;
const fpfSeasonId = (startYear: number) => String(startYear - FPF_SEASON_ID_OFFSET);
const SEASONS = [0, 1, 2].map(k => {
  const start = getSeasonStartYear() - k;
  return { id: fpfSeasonId(start), name: getSeasonName(start) };
});

const getCurrentSeasonId = () => fpfSeasonId(getSeasonStartYear());

interface Competition {
  id: string;
  name: string;
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

interface FPFImportProps {
  onImportStandings?: (standings: FPFStanding[]) => void;
}

export function FPFImport({ onImportStandings }: FPFImportProps) {
  const [open, setOpen] = useState(false);
  const [selectedAssociation, setSelectedAssociation] = useState('219'); // AF Braga default
  const [selectedSeason, setSelectedSeason] = useState(getCurrentSeasonId());
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState('');
  const [seriesOptions, setSeriesOptions] = useState<string[]>([]);
  const [selectedSeries, setSelectedSeries] = useState('');
  const [standings, setStandings] = useState<FPFStanding[]>([]);
  const [loadingCompetitions, setLoadingCompetitions] = useState(false);
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [loadingStandings, setLoadingStandings] = useState(false);

  useEffect(() => {
    if (!selectedCompetition) {
      setSeriesOptions([]);
      setSelectedSeries('');
      return;
    }

    let cancelled = false;

    (async () => {
      setLoadingSeries(true);
      setSeriesOptions([]);
      setSelectedSeries('');
      setStandings([]);

      try {
        const { data, error } = await supabase.functions.invoke('fetch-fpf-standings', {
          body: {
            action: 'getSeries',
            competitionId: selectedCompetition,
            seasonId: parseInt(selectedSeason),
          },
        });

        if (error) throw error;

        const series = (data?.series || []) as string[];
        if (!cancelled) {
          setSeriesOptions(series);
          setSelectedSeries(series?.[0] || '');
        }
      } catch (error) {
        console.error('Error fetching series:', error);
        if (!cancelled) {
          setSeriesOptions([]);
          setSelectedSeries('');
        }
      } finally {
        if (!cancelled) setLoadingSeries(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCompetition, selectedSeason]);

  const fetchCompetitions = async () => {
    setLoadingCompetitions(true);
    setCompetitions([]);
    setSelectedCompetition('');
    setSeriesOptions([]);
    setSelectedSeries('');
    setStandings([]);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-fpf-standings', {
        body: { 
          action: 'getCompetitions',
          associationId: selectedAssociation,
          seasonId: parseInt(selectedSeason)
        }
      });

      if (error) throw error;

      if (data.success && data.competitions) {
        setCompetitions(data.competitions);
        toast.success(`${data.competitions.length} competições encontradas`);
      } else {
        toast.error(data.error || 'Erro ao carregar competições');
      }
    } catch (error) {
      console.error('Error fetching competitions:', error);
      toast.error('Erro ao carregar competições da FPF');
    } finally {
      setLoadingCompetitions(false);
    }
  };

  const fetchStandings = async () => {
    if (!selectedCompetition) return;

    setLoadingStandings(true);
    setStandings([]);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-fpf-standings', {
        body: {
          action: 'getStandings',
          competitionId: selectedCompetition,
          seasonId: parseInt(selectedSeason),
          series: selectedSeries || undefined,
        },
      });

      if (error) throw error;

      if (data.success && data.standings) {
        setStandings(data.standings);
        const seriesLabel = data.selectedSeries ? ` (${data.selectedSeries})` : '';
        toast.success(`Classificação carregada${seriesLabel}: ${data.standings.length} equipas`);
      } else {
        toast.error(data.error || 'Erro ao carregar classificação');
      }
    } catch (error) {
      console.error('Error fetching standings:', error);
      toast.error('Erro ao carregar classificação da FPF');
    } finally {
      setLoadingStandings(false);
    }
  };

  const handleImport = () => {
    if (standings.length > 0 && onImportStandings) {
      onImportStandings(standings);
      setOpen(false);
      toast.success('Classificação importada com sucesso');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Globe className="w-4 h-4 mr-1" />
          Importar FPF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Importar Classificação da FPF
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Select Association & Season */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">1. Selecionar Associação e Época</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Associação</Label>
                  <Select value={selectedAssociation} onValueChange={setSelectedAssociation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a associação" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSOCIATIONS.map(af => (
                        <SelectItem key={af.id} value={af.id}>{af.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Época</Label>
                  <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a época" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEASONS.map(season => (
                        <SelectItem key={season.id} value={season.id}>{season.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={fetchCompetitions} disabled={loadingCompetitions} className="w-full">
                {loadingCompetitions ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    A carregar...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Carregar Competições
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Step 2: Select Competition & Series */}
          {competitions.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">2. Selecionar Competição e Série</CardTitle>
                <CardDescription>{competitions.length} competições disponíveis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Competição</Label>
                    <Select value={selectedCompetition} onValueChange={setSelectedCompetition}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a competição" />
                      </SelectTrigger>
                      <SelectContent>
                        {competitions.map((comp) => (
                          <SelectItem key={comp.id} value={comp.id}>
                            {comp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Série</Label>
                    <Select
                      value={selectedSeries}
                      onValueChange={setSelectedSeries}
                      disabled={!selectedCompetition || loadingSeries || seriesOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            !selectedCompetition
                              ? 'Selecione uma competição'
                              : loadingSeries
                              ? 'A carregar séries...'
                              : seriesOptions.length === 0
                              ? 'Sem séries'
                              : 'Selecione a série'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {seriesOptions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={fetchStandings}
                  disabled={
                    !selectedCompetition ||
                    loadingStandings ||
                    (seriesOptions.length > 0 && !selectedSeries)
                  }
                  className="w-full"
                >
                  {loadingStandings ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      A carregar...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Carregar Classificação
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 3: View & Import Standings */}
          {standings.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>3. Classificação</span>
                  <Badge variant="secondary">{standings.length} equipas</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
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
                      {standings.map((s) => (
                        <TableRow key={s.position}>
                          <TableCell>{s.position}</TableCell>
                          <TableCell className="font-medium">{s.teamName}</TableCell>
                          <TableCell className="text-center">{s.played}</TableCell>
                          <TableCell className="text-center text-green-600">{s.won}</TableCell>
                          <TableCell className="text-center">{s.drawn}</TableCell>
                          <TableCell className="text-center text-red-600">{s.lost}</TableCell>
                          <TableCell className="text-center">{s.goalsFor}</TableCell>
                          <TableCell className="text-center">{s.goalsAgainst}</TableCell>
                          <TableCell className="text-center font-bold">{s.points}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
                {onImportStandings && (
                  <Button onClick={handleImport} className="w-full mt-4">
                    <Download className="w-4 h-4 mr-2" />
                    Importar Esta Classificação
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
