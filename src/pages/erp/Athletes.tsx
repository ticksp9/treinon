import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  Building2, 
  Users,
  Plus,
  Package,
  Euro,
  Check,
  X,
  Truck
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function Athletes() {
  const { user } = useAuth();
  const { isClubAdmin, clubId, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState('mensalidades');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: teams } = useQuery({
    queryKey: ['erp-teams', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('club_id', clubId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  const { data: players, isLoading: playersLoading } = useQuery({
    queryKey: ['erp-players-fees', clubId, selectedTeam],
    queryFn: async () => {
      if (!clubId) return [];
      let query = supabase
        .from('players')
        .select(`
          id,
          name,
          team_id,
          teams!inner(id, name, club_id)
        `)
        .eq('teams.club_id', clubId)
        .eq('is_active', true)
        .order('name');
      
      if (selectedTeam !== 'all') {
        query = query.eq('team_id', selectedTeam);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  const { data: fees } = useQuery({
    queryKey: ['erp-player-fees', clubId, selectedYear],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('player_fees')
        .select('*')
        .eq('club_id', clubId)
        .eq('year', parseInt(selectedYear));
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  const { data: kits } = useQuery({
    queryKey: ['erp-kits', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('kits')
        .select('*')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  const { data: kitAssignments } = useQuery({
    queryKey: ['erp-kit-assignments', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('kit_assignments')
        .select(`
          *,
          kits(name),
          players(name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });

  const togglePayment = useMutation({
    mutationFn: async ({ playerId, month, isPaid }: { playerId: string; month: number; isPaid: boolean }) => {
      const existing = fees?.find(f => f.player_id === playerId && f.month === month);
      
      if (existing) {
        const { error } = await supabase
          .from('player_fees')
          .update({ 
            is_paid: isPaid, 
            paid_at: isPaid ? new Date().toISOString() : null 
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('player_fees')
          .insert({
            player_id: playerId,
            club_id: clubId!,
            owner_id: user?.id!,
            month,
            year: parseInt(selectedYear),
            is_paid: isPaid,
            paid_at: isPaid ? new Date().toISOString() : null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['erp-player-fees', clubId, selectedYear] });
      toast.success('Pagamento atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar pagamento');
    },
  });

  if (roleLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!isClubAdmin || !clubId) {
    return (
      <AppLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Acesso Restrito</h3>
              <p className="text-muted-foreground">
                Esta funcionalidade está disponível apenas para administradores de clubes.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  const getPaymentStatus = (playerId: string, month: number) => {
    return fees?.find(f => f.player_id === playerId && f.month === month)?.is_paid || false;
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Atletas - Finanças</h1>
          <p className="text-muted-foreground">
            Gestão de mensalidades e kits
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="mensalidades" className="flex items-center gap-2">
              <Euro className="w-4 h-4" />
              Mensalidades
            </TabsTrigger>
            <TabsTrigger value="kits" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Kits
            </TabsTrigger>
          </TabsList>

          <TabsContent value="mensalidades" className="space-y-4 mt-6">
            {/* Filtros */}
            <div className="flex gap-4">
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Equipa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as equipas</SelectItem>
                  {teams?.map(team => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025, 2026].map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tabela de mensalidades */}
            <Card>
              <CardContent className="p-0 overflow-auto">
                {playersLoading ? (
                  <div className="p-6">
                    <Skeleton className="h-48" />
                  </div>
                ) : players?.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhum atleta encontrado</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background">Atleta</TableHead>
                        <TableHead>Equipa</TableHead>
                        {MONTHS.map((month, idx) => (
                          <TableHead key={idx} className="text-center min-w-[80px]">
                            {month.substring(0, 3)}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {players?.map((player: any) => (
                        <TableRow key={player.id}>
                          <TableCell className="font-medium sticky left-0 bg-background">
                            {player.name}
                          </TableCell>
                          <TableCell>{player.teams?.name}</TableCell>
                          {MONTHS.map((_, monthIdx) => {
                            const isPaid = getPaymentStatus(player.id, monthIdx + 1);
                            return (
                              <TableCell key={monthIdx} className="text-center">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={isPaid ? 'text-green-600 hover:text-green-700' : 'text-muted-foreground hover:text-foreground'}
                                  onClick={() => togglePayment.mutate({ 
                                    playerId: player.id, 
                                    month: monthIdx + 1, 
                                    isPaid: !isPaid 
                                  })}
                                >
                                  {isPaid ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                </Button>
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kits" className="space-y-4 mt-6">
            <div className="flex justify-between items-center">
              <div />
              <KitDialog clubId={clubId} userId={user?.id || ''} />
            </div>

            {/* Lista de kits */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {kits?.map(kit => (
                <Card key={kit.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Package className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{kit.name}</p>
                        <p className="text-sm text-muted-foreground">{kit.season}</p>
                      </div>
                    </div>
                    <div className="mt-4 text-xl font-bold">
                      {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(kit.price)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Atribuições de kits */}
            <Card>
              <CardHeader>
                <CardTitle>Atribuições de Kits</CardTitle>
                <CardDescription>Kits atribuídos aos atletas</CardDescription>
              </CardHeader>
              <CardContent>
                {!kitAssignments || kitAssignments.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Nenhuma atribuição de kit registada
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atleta</TableHead>
                        <TableHead>Kit</TableHead>
                        <TableHead>Tamanho</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kitAssignments.map((assignment: any) => (
                        <TableRow key={assignment.id}>
                          <TableCell>{assignment.players?.name}</TableCell>
                          <TableCell>{assignment.kits?.name}</TableCell>
                          <TableCell>{assignment.size || '-'}</TableCell>
                          <TableCell>
                            {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(assignment.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              assignment.status === 'delivered' ? 'default' :
                              assignment.status === 'paid' ? 'secondary' : 'outline'
                            }>
                              {assignment.status === 'pending' && 'Pendente'}
                              {assignment.status === 'paid' && 'Pago'}
                              {assignment.status === 'delivered' && 'Entregue'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function KitDialog({ clubId, userId }: { clubId: string; userId: string }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    season: '2024/2025',
    price: '',
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('kits')
        .insert({
          club_id: clubId,
          owner_id: userId,
          name: formData.name,
          season: formData.season,
          price: parseFloat(formData.price) || 0,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['erp-kits', clubId] });
      toast.success('Kit criado com sucesso');
      setOpen(false);
      setFormData({ name: '', season: '2024/2025', price: '' });
    },
    onError: () => {
      toast.error('Erro ao criar kit');
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Kit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Kit</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Kit</Label>
            <Input 
              id="name" 
              placeholder="Ex: Kit Principal, Kit Treino"
              required
              value={formData.name} 
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="season">Época</Label>
              <Input 
                id="season" 
                value={formData.season} 
                onChange={(e) => setFormData(prev => ({ ...prev, season: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Preço (€)</Label>
              <Input 
                id="price" 
                type="number"
                step="0.01"
                value={formData.price} 
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Criar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
