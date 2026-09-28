import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';

// ── helpers ──
export function computeStockHealth(items: Array<{ current_stock: number; minimum_stock: number; reorder_point: number }>) {
  let critical = 0, low = 0, ok = 0;
  for (const i of items) {
    if (i.current_stock <= 0) critical++;
    else if (i.current_stock <= (i.reorder_point || i.minimum_stock || 0)) low++;
    else ok++;
  }
  return { critical, low, ok, total: items.length };
}

export function computeConsumptionByTeam(
  movements: Array<{ movement_type: string; related_team_id: string | null; total_cost: number; quantity: number }>,
  teams: Array<{ id: string; name: string }>
) {
  const map = new Map<string, { team_name: string; total_cost: number; total_qty: number }>();
  const teamMap = new Map(teams.map(t => [t.id, t.name]));

  for (const m of movements) {
    if (!m.related_team_id) continue;
    if (!['issue_to_team', 'consumption', 'outbound'].includes(m.movement_type)) continue;
    const existing = map.get(m.related_team_id) || { team_name: teamMap.get(m.related_team_id) || 'Desconhecida', total_cost: 0, total_qty: 0 };
    existing.total_cost += Number(m.total_cost) || 0;
    existing.total_qty += Math.abs(Number(m.quantity)) || 0;
    map.set(m.related_team_id, existing);
  }
  return Array.from(map.entries()).map(([id, v]) => ({ team_id: id, ...v })).sort((a, b) => b.total_cost - a.total_cost);
}

export function computeMaintenanceStatus(logs: Array<{ status: string; scheduled_date: string | null }>) {
  const now = new Date();
  let scheduled = 0, overdue = 0, completed = 0;
  for (const l of logs) {
    if (l.status === 'completed') completed++;
    else if (l.status === 'overdue' || (l.scheduled_date && new Date(l.scheduled_date) < now && l.status === 'scheduled')) overdue++;
    else scheduled++;
  }
  return { scheduled, overdue, completed };
}

export function useInventory() {
  const { clubId } = useUserRole();
  const { toast } = useToast();
  const qc = useQueryClient();

  const assetsQuery = useQuery({
    queryKey: ['inventory-assets', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('asset_items').select('*').eq('club_id', clubId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const stockQuery = useQuery({
    queryKey: ['inventory-stock', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('stock_items').select('*').eq('club_id', clubId).order('item_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const movementsQuery = useQuery({
    queryKey: ['inventory-movements', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('stock_movements').select('*').eq('club_id', clubId).order('movement_date', { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const locationsQuery = useQuery({
    queryKey: ['inventory-locations', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('inventory_locations').select('*').eq('club_id', clubId).order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const allocationsQuery = useQuery({
    queryKey: ['inventory-allocations', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('team_equipment_allocations').select('*').eq('club_id', clubId).order('allocation_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const kitAssignmentsQuery = useQuery({
    queryKey: ['inventory-kits', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('athlete_kit_assignments').select('*').eq('club_id', clubId).order('issue_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const maintenanceQuery = useQuery({
    queryKey: ['inventory-maintenance', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('asset_maintenance_logs').select('*').eq('club_id', clubId).order('scheduled_date', { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const alertsQuery = useQuery({
    queryKey: ['inventory-alerts', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('inventory_alerts').select('*').eq('club_id', clubId).eq('status', 'open').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const teamsQuery = useQuery({
    queryKey: ['inventory-teams', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('teams').select('id, name, category').eq('club_id', clubId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  // Mutations
  const createAsset = useMutation({
    mutationFn: async (asset: Record<string, unknown>) => {
      const payload = { ...asset, club_id: clubId } as any;
      const { error } = await supabase.from('asset_items').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-assets'] }); toast({ title: 'Ativo criado' }); },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const createStockItem = useMutation({
    mutationFn: async (item: Record<string, unknown>) => {
      const payload = { ...item, club_id: clubId } as any;
      const { error } = await supabase.from('stock_items').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-stock'] }); toast({ title: 'Item de stock criado' }); },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const createMovement = useMutation({
    mutationFn: async (mov: Record<string, unknown>) => {
      const payload = { ...mov, club_id: clubId } as any;
      const { error } = await supabase.from('stock_movements').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inventory-movements', 'inventory-stock'] }); toast({ title: 'Movimento registado' }); },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  return {
    assets: assetsQuery.data || [],
    stock: stockQuery.data || [],
    movements: movementsQuery.data || [],
    locations: locationsQuery.data || [],
    allocations: allocationsQuery.data || [],
    kitAssignments: kitAssignmentsQuery.data || [],
    maintenance: maintenanceQuery.data || [],
    alerts: alertsQuery.data || [],
    teams: teamsQuery.data || [],
    isLoading: assetsQuery.isLoading || stockQuery.isLoading,
    createAsset,
    createStockItem,
    createMovement,
  };
}
