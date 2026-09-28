import { describe, it, expect } from 'vitest';
import { computePayrollTotals, computeObligationAging } from '@/hooks/useWorkforce';
import type { PayrollEntry, StatutoryObligation } from '@/hooks/useWorkforce';

describe('Workforce: computePayrollTotals', () => {
  it('sums payroll entries correctly', () => {
    const entries: PayrollEntry[] = [
      { id: '1', payroll_cycle_id: 'c1', person_id: 'p1', gross_amount: 1500, deductions_amount: 200, employer_charges_amount: 350, net_amount: 1300, payable_amount: 1300, status: 'calculated', payment_due_date: null },
      { id: '2', payroll_cycle_id: 'c1', person_id: 'p2', gross_amount: 2000, deductions_amount: 300, employer_charges_amount: 470, net_amount: 1700, payable_amount: 1700, status: 'calculated', payment_due_date: null },
    ];
    const t = computePayrollTotals(entries);
    expect(t.gross).toBe(3500);
    expect(t.deductions).toBe(500);
    expect(t.employerCharges).toBe(820);
    expect(t.net).toBe(3000);
    expect(t.totalCost).toBe(4320);
  });

  it('returns zeros for empty array', () => {
    const t = computePayrollTotals([]);
    expect(t.gross).toBe(0);
    expect(t.totalCost).toBe(0);
  });
});

describe('Workforce: computeObligationAging', () => {
  const makeObl = (dueDate: string, amountDue: number, amountPaid: number, status = 'pending'): StatutoryObligation => ({
    id: 'o1', club_id: 'club1', obligation_type: 'salary', reference_period: '2026-03',
    due_date: dueDate, amount_due: amountDue, amount_paid: amountPaid, status,
    authority_name: null, reference_code: null, paid_at: null,
  });

  it('buckets current obligations correctly', () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const aging = computeObligationAging([makeObl(future, 1000, 0)]);
    expect(aging.current).toBe(1000);
    expect(aging.days_1_30).toBe(0);
  });

  it('buckets overdue >90 correctly', () => {
    const old = new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10);
    const aging = computeObligationAging([makeObl(old, 500, 0)]);
    expect(aging.over_90).toBe(500);
  });

  it('skips paid obligations', () => {
    const old = new Date(Date.now() - 50 * 86400000).toISOString().slice(0, 10);
    const aging = computeObligationAging([makeObl(old, 500, 500, 'paid')]);
    expect(aging.days_31_60).toBe(0);
  });

  it('uses outstanding amount (due - paid)', () => {
    const past = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const aging = computeObligationAging([makeObl(past, 1000, 600)]);
    expect(aging.days_1_30).toBe(400);
  });

  it('isolates by tenant (conceptual - different club_ids)', () => {
    const past = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    const oblA = { ...makeObl(past, 1000, 0), club_id: 'clubA' };
    const oblB = { ...makeObl(past, 500, 0), club_id: 'clubB' };
    const agingA = computeObligationAging([oblA]);
    const agingB = computeObligationAging([oblB]);
    expect(agingA.days_1_30).toBe(1000);
    expect(agingB.days_1_30).toBe(500);
  });
});
