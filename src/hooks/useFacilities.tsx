import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/hooks/use-toast';

// ── Pure business logic (exported for tests) ──────────────────────
export function computeOccupancyRate(
  reservations: Array<{ starts_at: string; ends_at: string; reservation_status: string }>,
  periodDays: number,
  spacesCount: number,
  hoursPerDay = 12
): number {
  if (!spacesCount || !periodDays) return 0;
  const totalAvailableHours = spacesCount * periodDays * hoursPerDay;
  const bookedHours = reservations
    .filter(r => ['confirmed', 'completed'].includes(r.reservation_status))
    .reduce((sum, r) => {
      const diff = (new Date(r.ends_at).getTime() - new Date(r.starts_at).getTime()) / (1000 * 60 * 60);
      return sum + Math.max(0, diff);
    }, 0);
  return totalAvailableHours > 0 ? Math.round((bookedHours / totalAvailableHours) * 100) : 0;
}

export function detectConflicts(
  newStart: Date,
  newEnd: Date,
  spaceId: string,
  existing: Array<{ id: string; facility_space_id: string; starts_at: string; ends_at: string; reservation_status: string }>,
  excludeId?: string
): string[] {
  return existing
    .filter(r => r.facility_space_id === spaceId && r.reservation_status !== 'cancelled' && r.id !== excludeId)
    .filter(r => {
      const s = new Date(r.starts_at);
      const e = new Date(r.ends_at);
      return newStart < e && newEnd > s;
    })
    .map(r => r.id);
}

export function computeCostsByFacility(
  costs: Array<{ facility_id: string; amount: number }>
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of costs) {
    map[c.facility_id] = (map[c.facility_id] || 0) + Number(c.amount);
  }
  return map;
}

export function computeCostsByTeam(
  costs: Array<{ team_id: string | null; amount: number }>
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const c of costs) {
    const key = c.team_id || 'unassigned';
    map[key] = (map[key] || 0) + Number(c.amount);
  }
  return map;
}

// ── Hook ──────────────────────────────────────────────────────────
export function useFacilities() {
  const { clubId } = useUserRole();
  const qc = useQueryClient();

  const { data: facilities = [], isLoading: facilitiesLoading } = useQuery({
    queryKey: ['facilities', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('facilities').select('*').eq('club_id', clubId).order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: spaces = [] } = useQuery({
    queryKey: ['facility-spaces', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const facilityIds = facilities.map(f => f.id);
      if (!facilityIds.length) return [];
      const { data, error } = await supabase.from('facility_spaces').select('*').in('facility_id', facilityIds).order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId && facilities.length > 0,
  });

  const { data: reservations = [] } = useQuery({
    queryKey: ['facility-reservations', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('facility_reservations').select('*').eq('club_id', clubId).order('starts_at', { ascending: false }).limit(500);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ['facility-work-orders', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('facility_work_orders').select('*').eq('club_id', clubId).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['facility-documents', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const facilityIds = facilities.map(f => f.id);
      if (!facilityIds.length) return [];
      const { data, error } = await supabase.from('facility_documents').select('*').in('facility_id', facilityIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId && facilities.length > 0,
  });

  const { data: operationalCosts = [] } = useQuery({
    queryKey: ['facility-op-costs', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('facility_operational_costs').select('*').eq('club_id', clubId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: complianceAlerts = [] } = useQuery({
    queryKey: ['facility-compliance-alerts', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('facility_compliance_alerts').select('*').eq('club_id', clubId).eq('status', 'active');
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ['facility-incidents', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('facility_incidents').select('*').eq('club_id', clubId).order('reported_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams-for-facilities', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.from('teams').select('id, name').eq('club_id', clubId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['facilities'] });
    qc.invalidateQueries({ queryKey: ['facility-spaces'] });
    qc.invalidateQueries({ queryKey: ['facility-reservations'] });
    qc.invalidateQueries({ queryKey: ['facility-work-orders'] });
    qc.invalidateQueries({ queryKey: ['facility-documents'] });
    qc.invalidateQueries({ queryKey: ['facility-op-costs'] });
    qc.invalidateQueries({ queryKey: ['facility-compliance-alerts'] });
    qc.invalidateQueries({ queryKey: ['facility-incidents'] });
  };

  const createFacility = useMutation({
    mutationFn: async (d: { name: string; facility_code: string; facility_type: string; ownership_type: string; address?: string }) => {
      if (!clubId) throw new Error('No club');
      const { error } = await supabase.from('facilities').insert({ ...d, club_id: clubId });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: 'Instalação criada' }); },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const createSpace = useMutation({
    mutationFn: async (d: { facility_id: string; name: string; space_code: string; space_type: string; reservable?: boolean }) => {
      const { error } = await supabase.from('facility_spaces').insert(d);
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: 'Espaço criado' }); },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const createReservation = useMutation({
    mutationFn: async (d: { facility_id: string; facility_space_id: string; reservation_type: string; starts_at: string; ends_at: string; team_id?: string; notes?: string }) => {
      if (!clubId) throw new Error('No club');
      const conflicts = detectConflicts(new Date(d.starts_at), new Date(d.ends_at), d.facility_space_id, reservations as any);
      if (conflicts.length) throw new Error(`Conflito com ${conflicts.length} reserva(s) existente(s)`);
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('facility_reservations').insert({ ...d, club_id: clubId, requester_user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: 'Reserva criada' }); },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const createWorkOrder = useMutation({
    mutationFn: async (d: { facility_id: string; title: string; work_order_type: string; priority: string; facility_space_id?: string }) => {
      if (!clubId) throw new Error('No club');
      const { error } = await supabase.from('facility_work_orders').insert({ ...d, club_id: clubId });
      if (error) throw error;
    },
    onSuccess: () => { invalidateAll(); toast({ title: 'Ordem de trabalho criada' }); },
    onError: (e: Error) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const isLoading = facilitiesLoading;

  return {
    facilities, spaces, reservations, workOrders, documents, operationalCosts,
    complianceAlerts, incidents, teams, isLoading,
    createFacility, createSpace, createReservation, createWorkOrder,
  };
}
