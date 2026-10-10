import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useFeeAssignments, useFeePlans, useCreateFeeAssignment, useBulkAssignPlan } from '@/hooks/useBilling';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { getCurrentSeasonName } from '@/lib/constants';

interface Props { clubId: string; }

export function FeeAssignmentsTab({ clubId }: Props) {
  const { data: assignments, isLoading } = useFeeAssignments(clubId);
  const { data: plans } = useFeePlans(clubId);
  const createAssignment = useCreateFeeAssignment(clubId);
  const bulkAssign = useBulkAssignPlan(clubId);
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [form, setForm] = useState({ fee_plan_id: '', player_id: '', discount_type: '', discount_value: '', is_scholarship: false, is_exempt: false, season: getCurrentSeasonName() });

  const { data: teams } = useQuery({
    queryKey: ['billing-teams', clubId],
    queryFn: async () => {
      const { data } = await supabase.from('teams').select('id, name, category').eq('club_id', clubId).order('name');
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: players } = useQuery({
    queryKey: ['billing-players', clubId, selectedTeam],
    queryFn: async () => {
      let q = supabase.from('players').select('id, name, number, team_id, teams!inner(id, name, club_id)').eq('teams.club_id', clubId).eq('is_active', true).order('name');
      if (selectedTeam) q = q.eq('team_id', selectedTeam);
      const { data } = await q;
      return data || [];
    },
    enabled: !!clubId,
  });

  const fmt = (v: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v);

  const handleCreate = () => {
    createAssignment.mutate({
      fee_plan_id: form.fee_plan_id, player_id: form.player_id || null,
      discount_type: form.discount_type || null, discount_value: form.discount_value ? parseFloat(form.discount_value) : null,
      is_scholarship: form.is_scholarship, is_exempt: form.is_exempt, season: form.season,
    }, { onSuccess: () => setOpen(false) });
  };

  const handleBulkAssign = () => {
    bulkAssign.mutate({ planId: selectedPlan, playerIds: selectedPlayers, season: getCurrentSeasonName() }, { onSuccess: () => { setBulkOpen(false); setSelectedPlayers([]); } });
  };

  const togglePlayer = (pid: string) => setSelectedPlayers(prev => prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]);

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div><h3 className="font-semibold">Atribuições de Planos</h3><p className="text-sm text-muted-foreground">Associe planos a atletas</p></div>
        <div className="flex gap-2">
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger asChild><Button variant="outline"><Users className="w-4 h-4 mr-1" /> Atribuir em Lote</Button></DialogTrigger>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Atribuir Plano em Lote</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Plano</Label><Select value={selectedPlan} onValueChange={setSelectedPlan}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{plans?.filter((p: any) => p.is_active).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({fmt(p.amount)})</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Filtrar por equipa</Label><Select value={selectedTeam || '__all__'} onValueChange={(v) => setSelectedTeam(v === '__all__' ? '' : v)}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="__all__">Todas</SelectItem>{teams?.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1 max-h-48 overflow-y-auto border rounded p-2">
                  {players?.map((p: any) => (
                    <label key={p.id} className="flex items-center gap-2 p-1 hover:bg-muted/50 rounded cursor-pointer">
                      <Checkbox checked={selectedPlayers.includes(p.id)} onCheckedChange={() => togglePlayer(p.id)} />
                      <span className="text-sm">{p.name} {p.number ? `(#${p.number})` : ''}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{selectedPlayers.length} atletas selecionados</p>
                <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setBulkOpen(false)}>Cancelar</Button><Button onClick={handleBulkAssign} disabled={!selectedPlan || selectedPlayers.length === 0 || bulkAssign.isPending}>Atribuir</Button></div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Individual</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Atribuir Plano</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Plano</Label><Select value={form.fee_plan_id} onValueChange={v => setForm(f => ({...f, fee_plan_id: v}))}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{plans?.filter((p: any) => p.is_active).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Atleta</Label><Select value={form.player_id} onValueChange={v => setForm(f => ({...f, player_id: v}))}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{players?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Tipo Desconto</Label><Select value={form.discount_type || '__none__'} onValueChange={v => setForm(f => ({...f, discount_type: v === '__none__' ? '' : v}))}><SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger><SelectContent><SelectItem value="__none__">Nenhum</SelectItem><SelectItem value="percentage">Percentagem</SelectItem><SelectItem value="fixed">Fixo</SelectItem><SelectItem value="sibling">Irmão</SelectItem></SelectContent></Select></div>
                  <div><Label>Valor Desconto</Label><Input type="number" value={form.discount_value} onChange={e => setForm(f => ({...f, discount_value: e.target.value}))} placeholder="0" /></div>
                </div>
                <div className="flex gap-4"><div className="flex items-center gap-2"><Switch checked={form.is_scholarship} onCheckedChange={v => setForm(f => ({...f, is_scholarship: v}))} /><Label>Bolsa</Label></div><div className="flex items-center gap-2"><Switch checked={form.is_exempt} onCheckedChange={v => setForm(f => ({...f, is_exempt: v}))} /><Label>Isento</Label></div></div>
                <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={handleCreate} disabled={!form.fee_plan_id || createAssignment.isPending}>Criar</Button></div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {(!assignments || assignments.length === 0) ? (
        <Card><CardContent className="py-12 text-center"><Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" /><p className="text-muted-foreground">Nenhuma atribuição. Associe planos a atletas.</p></CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {assignments.map((a: any) => (
            <Card key={a.id} className={a.is_exempt ? 'opacity-60' : ''}>
              <CardContent className="flex items-center justify-between py-3">
                <div>
                  <span className="font-medium">{(a.players as any)?.name || 'Sem atleta'}</span>
                  <span className="text-muted-foreground text-sm ml-2">{(a.players as any)?.teams?.name || ''}</span>
                  <div className="flex gap-1 mt-1">
                    <Badge variant="outline">{(a.fee_plans as any)?.name}</Badge>
                    {a.is_scholarship && <Badge variant="secondary">Bolsa</Badge>}
                    {a.is_exempt && <Badge variant="destructive">Isento</Badge>}
                    {a.discount_type && <Badge variant="outline">Desconto: {a.discount_type} {a.discount_value}</Badge>}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium">{a.custom_amount ? fmt(a.custom_amount) : fmt((a.fee_plans as any)?.amount || 0)}</span>
                  <Badge variant={a.status === 'active' ? 'default' : 'secondary'} className="ml-2">{a.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
