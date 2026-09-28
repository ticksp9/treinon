import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

export interface BudgetCycle {
  id: string;
  club_id: string;
  name: string;
  season: string;
  fiscal_year: number | null;
  start_date: string;
  end_date: string;
  status: string;
  budget_scope: string;
  version_number: number;
  parent_budget_cycle_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetVersion {
  id: string;
  budget_cycle_id: string;
  version_code: string;
  version_label: string;
  version_type: string;
  status: string;
  effective_from: string | null;
  notes: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface BudgetLine {
  id: string;
  budget_version_id: string;
  club_id: string;
  season: string | null;
  team_id: string | null;
  cost_center_id: string | null;
  category_id: string | null;
  line_type: string;
  line_nature: string;
  month: number | null;
  budget_amount: number;
  forecast_amount: number;
  actual_amount: number;
  currency: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

export interface BudgetCategory {
  id: string;
  club_id: string | null;
  code: string;
  name: string;
  type: string;
  parent_category_id: string | null;
  display_order: number;
  is_active: boolean;
}

export interface BudgetCostCenter {
  id: string;
  club_id: string;
  code: string;
  name: string;
  type: string;
  is_active: boolean;
  linked_team_id: string | null;
}

export interface BudgetAlert {
  id: string;
  club_id: string;
  budget_cycle_id: string | null;
  severity: string;
  alert_type: string;
  message: string;
  threshold_value: number | null;
  current_value: number | null;
  status: string;
  created_at: string;
}

export interface VarianceData {
  category_name: string;
  category_type: string;
  budget: number;
  actual: number;
  forecast: number;
  variance_abs: number;
  variance_pct: number;
  status: 'favorable' | 'unfavorable' | 'neutral';
}

export function useBudget(clubId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch budget cycles
  const cycles = useQuery({
    queryKey: ['budget-cycles', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('budget_cycles')
        .select('*')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as BudgetCycle[];
    },
    enabled: !!clubId,
  });

  // Fetch categories
  const categories = useQuery({
    queryKey: ['budget-categories', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('budget_categories')
        .select('*')
        .or(`club_id.eq.${clubId},club_id.is.null`)
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as BudgetCategory[];
    },
    enabled: !!clubId,
  });

  // Fetch cost centers
  const costCenters = useQuery({
    queryKey: ['budget-cost-centers', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('budget_cost_centers')
        .select('*')
        .eq('club_id', clubId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as BudgetCostCenter[];
    },
    enabled: !!clubId,
  });

  // Fetch alerts
  const alerts = useQuery({
    queryKey: ['budget-alerts', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('budget_alerts')
        .select('*')
        .eq('club_id', clubId)
        .in('status', ['active', 'acknowledged'])
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as BudgetAlert[];
    },
    enabled: !!clubId,
  });

  // Fetch versions for a cycle
  const useVersions = (cycleId: string | null) =>
    useQuery({
      queryKey: ['budget-versions', cycleId],
      queryFn: async () => {
        if (!cycleId) return [];
        const { data, error } = await supabase
          .from('budget_versions')
          .select('*')
          .eq('budget_cycle_id', cycleId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data as BudgetVersion[];
      },
      enabled: !!cycleId,
    });

  // Fetch lines for a version
  const useLines = (versionId: string | null) =>
    useQuery({
      queryKey: ['budget-lines', versionId],
      queryFn: async () => {
        if (!versionId) return [];
        const { data, error } = await supabase
          .from('budget_lines')
          .select('*')
          .eq('budget_version_id', versionId)
          .order('month', { ascending: true });
        if (error) throw error;
        return data as BudgetLine[];
      },
      enabled: !!versionId,
    });

  // Create budget cycle
  const createCycle = useMutation({
    mutationFn: async (input: { name: string; season: string; start_date: string; end_date: string; budget_scope?: string }) => {
      if (!clubId || !user) throw new Error('Missing context');
      const { data, error } = await supabase.from('budget_cycles').insert({
        club_id: clubId,
        name: input.name,
        season: input.season,
        start_date: input.start_date,
        end_date: input.end_date,
        budget_scope: input.budget_scope || 'club',
        created_by: user.id,
      }).select().single();
      if (error) throw error;

      // Create initial version
      const { error: vErr } = await supabase.from('budget_versions').insert({
        budget_cycle_id: data.id,
        version_code: 'V1',
        version_label: 'Orçamento Inicial',
        version_type: 'initial',
        created_by: user.id,
      });
      if (vErr) throw vErr;

      // Audit log
      await supabase.from('budget_audit_logs').insert({
        club_id: clubId,
        entity_type: 'budget_cycle',
        entity_id: data.id,
        event_type: 'budget_cycle_created',
        actor_user_id: user.id,
        payload: { name: input.name, season: input.season },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-cycles'] });
      toast.success('Ciclo orçamental criado');
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // Create budget line
  const createLine = useMutation({
    mutationFn: async (input: {
      budget_version_id: string;
      category_id?: string;
      cost_center_id?: string;
      team_id?: string;
      line_type?: string;
      line_nature?: string;
      month?: number;
      budget_amount?: number;
      forecast_amount?: number;
      notes?: string;
    }) => {
      if (!clubId || !user) throw new Error('Missing context');
      const { data, error } = await supabase.from('budget_lines').insert({
        budget_version_id: input.budget_version_id,
        club_id: clubId,
        category_id: input.category_id || null,
        cost_center_id: input.cost_center_id || null,
        team_id: input.team_id || null,
        line_type: input.line_type || 'expense',
        line_nature: input.line_nature || 'fixed',
        month: input.month || null,
        budget_amount: input.budget_amount || 0,
        forecast_amount: input.forecast_amount || 0,
        notes: input.notes || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['budget-lines', vars.budget_version_id] });
      toast.success('Linha orçamental criada');
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  // Update budget line
  const updateLine = useMutation({
    mutationFn: async (input: { id: string; budget_version_id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from('budget_lines')
        .update(input.updates as any)
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['budget-lines', vars.budget_version_id] });
    },
  });

  // Approve cycle
  const approveCycle = useMutation({
    mutationFn: async (cycleId: string) => {
      if (!user || !clubId) throw new Error('Missing context');
      const { error } = await supabase.from('budget_cycles')
        .update({ status: 'approved', approved_by: user.id, approved_at: new Date().toISOString() })
        .eq('id', cycleId);
      if (error) throw error;

      await supabase.from('budget_audit_logs').insert({
        club_id: clubId,
        entity_type: 'budget_cycle',
        entity_id: cycleId,
        event_type: 'budget_approved',
        actor_user_id: user.id,
        payload: {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-cycles'] });
      toast.success('Orçamento aprovado');
    },
  });

  // Compute variances from lines
  const computeVariances = (lines: BudgetLine[], cats: BudgetCategory[]): VarianceData[] => {
    const catMap = new Map(cats.map(c => [c.id, c]));
    const grouped = new Map<string, { budget: number; actual: number; forecast: number; cat: BudgetCategory }>();

    for (const line of lines) {
      const cat = line.category_id ? catMap.get(line.category_id) : null;
      const key = cat?.id || 'uncategorized';
      const existing = grouped.get(key) || { budget: 0, actual: 0, forecast: 0, cat: cat || { id: '', name: 'Sem categoria', type: 'expense', code: '', club_id: null, parent_category_id: null, display_order: 0, is_active: true } as BudgetCategory };
      existing.budget += Number(line.budget_amount || 0);
      existing.actual += Number(line.actual_amount || 0);
      existing.forecast += Number(line.forecast_amount || 0);
      grouped.set(key, existing);
    }

    return Array.from(grouped.values()).map(({ budget, actual, forecast, cat }) => {
      const variance_abs = actual - budget;
      const variance_pct = budget !== 0 ? (variance_abs / Math.abs(budget)) * 100 : 0;
      const isExpense = cat.type === 'expense' || cat.type === 'investment';
      const status: VarianceData['status'] = variance_abs === 0 ? 'neutral' :
        isExpense ? (variance_abs > 0 ? 'unfavorable' : 'favorable') :
        (variance_abs > 0 ? 'favorable' : 'unfavorable');

      return {
        category_name: cat.name,
        category_type: cat.type,
        budget,
        actual,
        forecast,
        variance_abs,
        variance_pct: Math.round(variance_pct * 10) / 10,
        status,
      };
    });
  };

  return {
    cycles,
    categories,
    costCenters,
    alerts,
    useVersions,
    useLines,
    createCycle,
    createLine,
    updateLine,
    approveCycle,
    computeVariances,
  };
}
