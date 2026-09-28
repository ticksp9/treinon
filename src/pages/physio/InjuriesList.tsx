import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { usePhysioAccess } from '@/hooks/usePhysioAccess';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Plus,
  Search,
  AlertTriangle,
  Heart
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { INJURY_STATUSES, INJURY_SEVERITIES, BODY_AREAS, INJURY_TYPES } from '@/lib/physio-constants';

export default function InjuriesList() {
  const { user } = useAuth();
  const { hasPhysioAccess, clubId, loading: accessLoading } = usePhysioAccess();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [teamFilter, setTeamFilter] = useState<string>('all');

  // Fetch teams
  const { data: teams } = useQuery({
    queryKey: ['club-teams', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data } = await supabase
        .from('teams')
        .select('id, name')
        .eq('club_id', clubId)
        .order('name');
      return data || [];
    },
    enabled: !!clubId,
  });

  // Fetch injuries
  const { data: injuries, isLoading } = useQuery({
    queryKey: ['physio-injuries', clubId, statusFilter, teamFilter],
    queryFn: async () => {
      if (!clubId) return [];
      let query = supabase
        .from('physio_injuries')
        .select(`
          *,
          player:players(id, name, number, team_id, team:teams(id, name))
        `)
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data } = await query;

      let filtered = data || [];
      
      if (teamFilter !== 'all') {
        filtered = filtered.filter(i => i.player?.team_id === teamFilter);
      }

      if (searchTerm) {
        filtered = filtered.filter(i => 
          i.player?.name?.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }

      return filtered;
    },
    enabled: !!clubId && hasPhysioAccess,
  });

  if (accessLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!hasPhysioAccess) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
              <p className="text-muted-foreground">
                Esta funcionalidade está disponível apenas para fisioterapeutas e administradores.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const getSeverityBadge = (severity: string) => {
    const config = INJURY_SEVERITIES.find(s => s.value === severity);
    return config ? (
      <Badge variant="outline" className={config.color}>{config.label}</Badge>
    ) : null;
  };

  const getStatusBadge = (status: string) => {
    const config = INJURY_STATUSES.find(s => s.value === status);
    return config ? (
      <Badge variant="outline" className={config.color}>{config.label}</Badge>
    ) : null;
  };

  const getBodyAreaLabel = (value: string) => 
    BODY_AREAS.find(a => a.value === value)?.label || value;

  const getInjuryTypeLabel = (value: string) => 
    INJURY_TYPES.find(t => t.value === value)?.label || value;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/club/physio')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold">Lesões</h1>
            <p className="text-muted-foreground">Histórico completo de lesões</p>
          </div>
          <Button onClick={() => navigate('/club/physio/injuries/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Lesão
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar jogador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Estados</SelectItem>
                  {INJURY_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Equipa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Equipas</SelectItem>
                  {teams?.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : injuries?.length === 0 ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma lesão encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  Não existem lesões registadas com os filtros selecionados.
                </p>
                <Button onClick={() => navigate('/club/physio/injuries/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Registar Lesão
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jogador</TableHead>
                      <TableHead>Equipa</TableHead>
                      <TableHead>Zona</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Gravidade</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Data Início</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {injuries?.map(injury => (
                      <TableRow 
                        key={injury.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/club/physio/injuries/${injury.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              #{injury.player?.number}
                            </Badge>
                            <span className="font-medium">{injury.player?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {injury.player?.team?.name}
                        </TableCell>
                        <TableCell>{getBodyAreaLabel(injury.body_area)}</TableCell>
                        <TableCell>{getInjuryTypeLabel(injury.injury_type)}</TableCell>
                        <TableCell>{getSeverityBadge(injury.severity)}</TableCell>
                        <TableCell>{getStatusBadge(injury.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(injury.start_date), 'dd/MM/yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
