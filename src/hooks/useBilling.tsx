import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

// ========== Fee Plans ==========
export function useFeePlans(clubId: string | undefined) {
  return useQuery({
    queryKey: ['fee-plans', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fee_plans')
        .select('*')
        .eq('club_id', clubId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });
}

export function useCreateFeePlan(clubId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: any) => {
      const { error } = await supabase.from('fee_plans').insert({
        ...plan,
        club_id: clubId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-plans'] });
      toast.success('Plano criado com sucesso');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export function useUpdateFeePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from('fee_plans').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-plans'] });
      toast.success('Plano atualizado');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// ========== Fee Assignments ==========
export function useFeeAssignments(clubId: string | undefined, filters?: { planId?: string; teamId?: string }) {
  return useQuery({
    queryKey: ['fee-assignments', clubId, filters],
    queryFn: async () => {
      let query = supabase
        .from('fee_assignments')
        .select('*, fee_plans(name, plan_type, amount), players(name, number, team_id, teams(name))')
        .eq('club_id', clubId!)
        .order('created_at', { ascending: false });
      if (filters?.planId) query = query.eq('fee_plan_id', filters.planId);
      if (filters?.teamId) query = query.eq('team_id', filters.teamId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });
}

export function useCreateFeeAssignment(clubId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignment: any) => {
      const { error } = await supabase.from('fee_assignments').insert({
        ...assignment,
        club_id: clubId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-assignments'] });
      toast.success('Atribuição criada');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

export function useBulkAssignPlan(clubId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, playerIds, season }: { planId: string; playerIds: string[]; season?: string }) => {
      const rows = playerIds.map(pid => ({
        fee_plan_id: planId,
        club_id: clubId,
        player_id: pid,
        season,
        created_by: user!.id,
      }));
      const { error } = await supabase.from('fee_assignments').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fee-assignments'] });
      toast.success('Plano atribuído em lote');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// ========== Charges ==========
export function useCharges(clubId: string | undefined, filters?: {
  status?: string; playerId?: string; guardianId?: string; month?: number; year?: number; teamId?: string;
}) {
  return useQuery({
    queryKey: ['charges', clubId, filters],
    queryFn: async () => {
      let query = supabase
        .from('charges')
        .select('*, players(name, number, team_id, teams(name)), fee_plans(name)')
        .eq('club_id', clubId!)
        .order('due_date', { ascending: false });
      if (filters?.status && filters.status !== 'all') query = query.eq('status', filters.status);
      if (filters?.playerId) query = query.eq('player_id', filters.playerId);
      if (filters?.month) query = query.eq('reference_month', filters.month);
      if (filters?.year) query = query.eq('reference_year', filters.year);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });
}

export function useChargesSummary(clubId: string | undefined) {
  return useQuery({
    queryKey: ['charges-summary', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charges')
        .select('status, final_amount, balance_due')
        .eq('club_id', clubId!);
      if (error) throw error;
      const summary = {
        total_billed: 0, total_paid: 0, total_pending: 0, total_overdue: 0,
        count_pending: 0, count_overdue: 0, count_paid: 0,
      };
      (data || []).forEach((c: any) => {
        summary.total_billed += Number(c.final_amount);
        const paid = Number(c.final_amount) - Number(c.balance_due);
        summary.total_paid += paid;
        if (c.status === 'pending' || c.status === 'partially_paid') {
          summary.total_pending += Number(c.balance_due);
          summary.count_pending++;
        }
        if (c.status === 'overdue') {
          summary.total_overdue += Number(c.balance_due);
          summary.count_overdue++;
        }
        if (c.status === 'paid') summary.count_paid++;
      });
      return summary;
    },
    enabled: !!clubId,
  });
}

// ========== Payments ==========
export function usePayments(clubId: string | undefined) {
  return useQuery({
    queryKey: ['payments', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, players(name), payment_allocations(charge_id, allocated_amount, charges(description, reference_month, reference_year))')
        .eq('club_id', clubId!)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });
}

export function useRecordPayment(clubId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ chargeIds, amount, method, reference, notes, playerId, guardianId }: {
      chargeIds: string[]; amount: number; method: string; reference?: string; notes?: string;
      playerId?: string; guardianId?: string;
    }) => {
      // Create payment
      const { data: payment, error: pErr } = await supabase.from('payments').insert({
        club_id: clubId,
        player_id: playerId,
        guardian_id: guardianId,
        amount_paid: amount,
        payment_method: method,
        transaction_reference: reference,
        notes,
        received_by_user_id: user!.id,
      }).select('id').single();
      if (pErr) throw pErr;

      // Allocate to charges
      let remaining = amount;
      for (const chargeId of chargeIds) {
        if (remaining <= 0) break;
        const { data: charge } = await supabase.from('charges').select('id, balance_due').eq('id', chargeId).single();
        if (!charge) continue;
        const allocate = Math.min(remaining, Number(charge.balance_due));
        await supabase.from('payment_allocations').insert({
          payment_id: payment.id,
          charge_id: chargeId,
          allocated_amount: allocate,
        });
        const newBalance = Number(charge.balance_due) - allocate;
        const newStatus = newBalance <= 0 ? 'paid' : 'partially_paid';
        await supabase.from('charges').update({
          balance_due: newBalance,
          status: newStatus,
        }).eq('id', chargeId);
        remaining -= allocate;
      }

      // Audit
      await supabase.from('financial_events').insert({
        club_id: clubId,
        event_type: 'payment_recorded',
        entity_type: 'payment',
        entity_id: payment.id,
        actor_user_id: user!.id,
        payload: { amount, method, chargeIds },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charges'] });
      qc.invalidateQueries({ queryKey: ['charges-summary'] });
      qc.invalidateQueries({ queryKey: ['payments'] });
      toast.success('Pagamento registado');
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// ========== Generate Charges (via edge function) ==========
export function useGenerateCharges(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ month, year }: { month: number; year: number }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await supabase.functions.invoke('billing-engine', {
        body: { action: 'generate_monthly', club_id: clubId, reference_month: month, reference_year: year },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['charges'] });
      qc.invalidateQueries({ queryKey: ['charges-summary'] });
      toast.success(`Geração concluída: ${data.created} criadas, ${data.skipped} ignoradas`);
    },
    onError: (e: any) => toast.error('Erro na geração: ' + e.message),
  });
}

export function useMarkOverdue(clubId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke('billing-engine', {
        body: { action: 'mark_overdue', club_id: clubId },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['charges'] });
      qc.invalidateQueries({ queryKey: ['charges-summary'] });
      toast.success(`${data.updated} cobranças marcadas como vencidas`);
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });
}

// ========== Guardian Financial View ==========
export function useGuardianCharges(guardianProfileId: string | undefined) {
  return useQuery({
    queryKey: ['guardian-charges', guardianProfileId],
    queryFn: async () => {
      // Charges where guardian_id matches or player_id is linked to guardian
      const { data: directCharges, error } = await supabase
        .from('charges')
        .select('*, players(name, number, teams(name))')
        .or(`guardian_id.eq.${guardianProfileId}`)
        .order('due_date', { ascending: false });
      if (error) throw error;

      // Also get charges for player_ids this guardian is linked to
      const { data: links } = await supabase
        .from('player_guardians')
        .select('player_id')
        .eq('guardian_id', guardianProfileId!);
      
      const playerIds = links?.map(l => l.player_id) || [];
      let playerCharges: any[] = [];
      if (playerIds.length > 0) {
        const { data: pc } = await supabase
          .from('charges')
          .select('*, players(name, number, teams(name))')
          .in('player_id', playerIds)
          .order('due_date', { ascending: false });
        playerCharges = pc || [];
      }

      // Merge and deduplicate
      const all = [...(directCharges || []), ...playerCharges];
      const seen = new Set<string>();
      return all.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
    },
    enabled: !!guardianProfileId,
  });
}

export function useGuardianPayments(guardianProfileId: string | undefined) {
  return useQuery({
    queryKey: ['guardian-payments', guardianProfileId],
    queryFn: async () => {
      const { data: links } = await supabase
        .from('player_guardians')
        .select('player_id')
        .eq('guardian_id', guardianProfileId!);
      const playerIds = links?.map(l => l.player_id) || [];
      
      if (playerIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('payments')
        .select('*, players(name), payment_allocations(allocated_amount, charges(description))')
        .in('player_id', playerIds)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!guardianProfileId,
  });
}

// ========== Billing Alerts ==========
export function useBillingAlerts(clubId: string | undefined) {
  return useQuery({
    queryKey: ['billing-alerts', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_alerts')
        .select('*, charges(description, balance_due, due_date), players(name)')
        .eq('club_id', clubId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!clubId,
  });
}

export function useGuardianAlerts(userId: string | undefined) {
  return useQuery({
    queryKey: ['guardian-billing-alerts', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billing_alerts')
        .select('*, charges(description, balance_due, due_date, players(name))')
        .eq('recipient_user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}
