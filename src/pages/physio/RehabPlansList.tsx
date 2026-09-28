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
  ClipboardList,
  Heart
} from 'lucide-react';
import { format } from 'date-fns';
import { REHAB_STATUSES, REHAB_PHASES } from '@/lib/physio-constants';

export default function RehabPlansList() {
  const { user } = useAuth();
  const { hasPhysioAccess, clubId, loading: accessLoading } = usePhysioAccess();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch rehab plans
  const { data: plans, isLoading } = useQuery({
    queryKey: ['physio-rehab-plans', clubId, statusFilter],
    queryFn: async () => {
      if (!clubId) return [];
      let query = supabase
        .from('rehab_plans')
        .select(`
          *,
          player:players(id, name, number, team:teams(id, name)),
          injury:physio_injuries(id, body_area, injury_type)
        `)
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data } = await query;

      let filtered = data || [];

      if (searchTerm) {
        filtered = filtered.filter(p => 
          p.player?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.title?.toLowerCase().includes(searchTerm.toLowerCase())
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
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const getStatusBadge = (status: string) => {
    const config = REHAB_STATUSES.find(s => s.value === status);
    return config ? (
      <Badge variant="outline" className={config.color}>{config.label}</Badge>
    ) : null;
  };

  const getPhaseLabel = (phase: string) => 
    REHAB_PHASES.find(p => p.value === phase)?.label || phase;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/club/physio')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold">Planos de Reabilitação</h1>
            <p className="text-muted-foreground">Gestão de planos de recuperação</p>
          </div>
          <Button onClick={() => navigate('/club/physio/rehab/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Plano
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar jogador ou título..."
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
                  {REHAB_STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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
            ) : plans?.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum plano encontrado</h3>
                <p className="text-muted-foreground mb-4">
                  Crie um plano de reabilitação para acompanhar a recuperação dos jogadores.
                </p>
                <Button onClick={() => navigate('/club/physio/rehab/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Plano
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Título</TableHead>
                      <TableHead>Jogador</TableHead>
                      <TableHead>Fase</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Data Início</TableHead>
                      <TableHead>Data Fim</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plans?.map(plan => (
                      <TableRow 
                        key={plan.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/club/physio/rehab/${plan.id}`)}
                      >
                        <TableCell className="font-medium">{plan.title}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              #{plan.player?.number}
                            </Badge>
                            <span>{plan.player?.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{getPhaseLabel(plan.phase)}</TableCell>
                        <TableCell>{getStatusBadge(plan.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(plan.start_date), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {plan.end_date ? format(new Date(plan.end_date), 'dd/MM/yyyy') : '-'}
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
