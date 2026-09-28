import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────
export interface PersonRegistry {
  id: string;
  club_id: string;
  person_type: string;
  full_name: string;
  tax_id: string | null;
  national_id: string | null;
  birth_date: string | null;
  nationality: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  emergency_contact: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface EmploymentContract {
  id: string;
  club_id: string;
  person_id: string;
  staff_profile_id: string | null;
  contract_type: string;
  contract_number: string | null;
  start_date: string;
  end_date: string | null;
  base_salary: number;
  currency: string;
  payment_frequency: string;
  contract_status: string;
  file_url: string | null;
  signed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface PayrollCycle {
  id: string;
  club_id: string;
  period_month: number;
  fiscal_year: number;
  start_date: string;
  end_date: string;
  payroll_type: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface PayrollEntry {
  id: string;
  payroll_cycle_id: string;
  person_id: string;
  gross_amount: number;
  deductions_amount: number;
  employer_charges_amount: number;
  net_amount: number;
  payable_amount: number;
  status: string;
  payment_due_date: string | null;
}

export interface ContractorFeeBatch {
  id: string;
  club_id: string;
  batch_name: string;
  period_reference: string | null;
  status: string;
  created_at: string;
}

export interface ContractorFeeEntry {
  id: string;
  fee_batch_id: string;
  person_id: string;
  gross_fee: number;
  withholding_amount: number;
  net_fee: number;
  payable_amount: number;
  status: string;
  service_reference: string | null;
  service_date: string | null;
}

export interface StatutoryObligation {
  id: string;
  club_id: string;
  obligation_type: string;
  reference_period: string;
  due_date: string;
  amount_due: number;
  amount_paid: number;
  status: string;
  authority_name: string | null;
  reference_code: string | null;
  paid_at: string | null;
}

export interface ContractAlert {
  id: string;
  club_id: string;
  person_id: string | null;
  contract_id: string | null;
  alert_type: string;
  severity: string;
  due_date: string | null;
  status: string;
  message: string | null;
}

// ─── Variance / Aging helpers ─────────────────────────
export function computeObligationAging(obligations: StatutoryObligation[]) {
  const now = new Date();
  const buckets = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, over_90: 0 };
  for (const o of obligations) {
    if (o.status === 'paid') continue;
    const outstanding = o.amount_due - o.amount_paid;
    if (outstanding <= 0) continue;
    const due = new Date(o.due_date);
    const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) buckets.current += outstanding;
    else if (diff <= 30) buckets_1_30(buckets, outstanding);
    else if (diff <= 60) buckets.days_31_60 += outstanding;
    else if (diff <= 90) buckets.days_61_90 += outstanding;
    else buckets.over_90 += outstanding;
  }
  return buckets;
}
function buckets_1_30(b: ReturnType<typeof computeObligationAging>, v: number) { b.days_1_30 += v; }

export function computePayrollTotals(entries: PayrollEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      gross: acc.gross + e.gross_amount,
      deductions: acc.deductions + e.deductions_amount,
      employerCharges: acc.employerCharges + e.employer_charges_amount,
      net: acc.net + e.net_amount,
      totalCost: acc.totalCost + e.gross_amount + e.employer_charges_amount,
    }),
    { gross: 0, deductions: 0, employerCharges: 0, net: 0, totalCost: 0 }
  );
}

// ─── Hook ─────────────────────────────────────────────
export function useWorkforce(clubId: string | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // People
  const people = useQuery({
    queryKey: ['workforce-people', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('people_registry')
        .select('*')
        .eq('club_id', clubId!)
        .order('full_name');
      if (error) throw error;
      return data as PersonRegistry[];
    },
    enabled: !!clubId,
  });

  // Contracts
  const contracts = useQuery({
    queryKey: ['workforce-contracts', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employment_contracts')
        .select('*')
        .eq('club_id', clubId!)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data as EmploymentContract[];
    },
    enabled: !!clubId,
  });

  // Payroll cycles
  const payrollCycles = useQuery({
    queryKey: ['workforce-payroll-cycles', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_cycles')
        .select('*')
        .eq('club_id', clubId!)
        .order('fiscal_year', { ascending: false });
      if (error) throw error;
      return data as PayrollCycle[];
    },
    enabled: !!clubId,
  });

  // Payroll entries (latest cycle)
  const payrollEntries = useQuery({
    queryKey: ['workforce-payroll-entries', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_entries')
        .select('*, payroll_cycles!inner(club_id)')
        .eq('payroll_cycles.club_id', clubId!);
      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        payroll_cycle_id: d.payroll_cycle_id,
        person_id: d.person_id,
        gross_amount: d.gross_amount,
        deductions_amount: d.deductions_amount,
        employer_charges_amount: d.employer_charges_amount,
        net_amount: d.net_amount,
        payable_amount: d.payable_amount,
        status: d.status,
        payment_due_date: d.payment_due_date,
        staff_profile_id: d.staff_profile_id,
        contract_id: d.contract_id,
      })) as PayrollEntry[];
    },
    enabled: !!clubId,
  });

  // Fee batches
  const feeBatches = useQuery({
    queryKey: ['workforce-fee-batches', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contractor_fee_batches')
        .select('*')
        .eq('club_id', clubId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ContractorFeeBatch[];
    },
    enabled: !!clubId,
  });

  // Statutory obligations
  const obligations = useQuery({
    queryKey: ['workforce-obligations', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('statutory_obligations')
        .select('*')
        .eq('club_id', clubId!)
        .order('due_date', { ascending: true });
      if (error) throw error;
      return data as StatutoryObligation[];
    },
    enabled: !!clubId,
  });

  // Alerts
  const alerts = useQuery({
    queryKey: ['workforce-alerts', clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_alerts')
        .select('*')
        .eq('club_id', clubId!)
        .in('status', ['active', 'acknowledged'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ContractAlert[];
    },
    enabled: !!clubId,
  });

  // ─── Mutations ──────────────────────────────────────
  const addPerson = useMutation({
    mutationFn: async (person: Partial<PersonRegistry>) => {
      const { error } = await supabase.from('people_registry').insert({
        club_id: clubId!,
        full_name: person.full_name!,
        person_type: person.person_type || 'employee',
        tax_id: person.tax_id,
        email: person.email,
        phone: person.phone,
        status: 'active',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workforce-people', clubId] });
      toast.success('Pessoa registada');
    },
    onError: () => toast.error('Erro ao registar pessoa'),
  });

  const addContract = useMutation({
    mutationFn: async (c: Partial<EmploymentContract>) => {
      const { error } = await supabase.from('employment_contracts').insert({
        club_id: clubId!,
        person_id: c.person_id!,
        contract_type: c.contract_type || 'open_ended',
        start_date: c.start_date!,
        end_date: c.end_date,
        base_salary: c.base_salary || 0,
        currency: c.currency || 'EUR',
        contract_status: 'draft',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workforce-contracts', clubId] });
      toast.success('Contrato criado');
    },
    onError: () => toast.error('Erro ao criar contrato'),
  });

  const addPayrollCycle = useMutation({
    mutationFn: async (c: Partial<PayrollCycle>) => {
      const { error } = await supabase.from('payroll_cycles').insert({
        club_id: clubId!,
        period_month: c.period_month!,
        fiscal_year: c.fiscal_year!,
        start_date: c.start_date!,
        end_date: c.end_date!,
        payroll_type: c.payroll_type || 'regular',
        status: 'draft',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workforce-payroll-cycles', clubId] });
      toast.success('Ciclo de payroll criado');
    },
    onError: () => toast.error('Erro ao criar ciclo'),
  });

  // Audit helper
  const logAudit = async (entityType: string, entityId: string, eventType: string, payload?: Record<string, unknown>) => {
    await supabase.from('workforce_audit_logs').insert([{
      club_id: clubId!,
      entity_type: entityType,
      entity_id: entityId,
      event_type: eventType,
      actor_user_id: user?.id,
      payload: (payload || {}) as any,
    }]);
  };

  return {
    people,
    contracts,
    payrollCycles,
    payrollEntries,
    feeBatches,
    obligations,
    alerts,
    addPerson,
    addContract,
    addPayrollCycle,
    logAudit,
  };
}
