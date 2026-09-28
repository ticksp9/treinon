import { describe, it, expect } from 'vitest';
import { computeAgingBuckets, resolveApprovalLevel, detectDuplicateInvoice } from '@/hooks/useProcurement';

describe('Procurement Logic', () => {
  describe('computeAgingBuckets', () => {
    const mkInvoice = (due: string, outstanding: number, status = 'unpaid') => ({
      id: crypto.randomUUID(), club_id: 'c1', vendor_id: 'v1', invoice_number: 'INV-1',
      invoice_date: '2026-01-01', due_date: due, invoice_type: 'standard',
      subtotal: outstanding, tax_total: 0, gross_total: outstanding,
      outstanding_amount: outstanding, payment_status: status,
      validation_status: 'validated', cost_center_id: null, team_id: null,
      category_id: null, notes: null, created_at: '2026-01-01',
    });

    it('puts paid invoices in no bucket', () => {
      const result = computeAgingBuckets([mkInvoice('2025-01-01', 100, 'paid')]);
      expect(result.current + result.days_1_30 + result.days_31_60 + result.days_61_90 + result.over_90).toBe(0);
    });

    it('puts future due date in current', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      const result = computeAgingBuckets([mkInvoice(future.toISOString().split('T')[0], 500)]);
      expect(result.current).toBe(500);
    });

    it('puts 45-day-old overdue in 31-60 bucket', () => {
      const past = new Date();
      past.setDate(past.getDate() - 45);
      const result = computeAgingBuckets([mkInvoice(past.toISOString().split('T')[0], 300)]);
      expect(result.days_31_60).toBe(300);
    });

    it('puts 100-day-old overdue in >90 bucket', () => {
      const past = new Date();
      past.setDate(past.getDate() - 100);
      const result = computeAgingBuckets([mkInvoice(past.toISOString().split('T')[0], 200)]);
      expect(result.over_90).toBe(200);
    });
  });

  describe('resolveApprovalLevel', () => {
    it('returns finance_staff for <=500', () => {
      expect(resolveApprovalLevel(100)).toBe('finance_staff');
      expect(resolveApprovalLevel(500)).toBe('finance_staff');
    });

    it('returns finance_admin for 501-2000', () => {
      expect(resolveApprovalLevel(501)).toBe('finance_admin');
      expect(resolveApprovalLevel(2000)).toBe('finance_admin');
    });

    it('returns club_admin for >2000', () => {
      expect(resolveApprovalLevel(2001)).toBe('club_admin');
      expect(resolveApprovalLevel(50000)).toBe('club_admin');
    });
  });

  describe('detectDuplicateInvoice', () => {
    const existing = [{
      id: '1', club_id: 'c1', vendor_id: 'v1', invoice_number: 'FT-001',
      invoice_date: '2026-01-01', due_date: '2026-02-01', invoice_type: 'standard',
      subtotal: 1000, tax_total: 230, gross_total: 1230, outstanding_amount: 1230,
      payment_status: 'unpaid', validation_status: 'validated',
      cost_center_id: null, team_id: null, category_id: null, notes: null, created_at: '2026-01-01',
    }];

    it('detects duplicate by vendor+number+amount', () => {
      expect(detectDuplicateInvoice(existing, 'v1', 'FT-001', 1230)).toBe(true);
    });

    it('returns false for different invoice number', () => {
      expect(detectDuplicateInvoice(existing, 'v1', 'FT-002', 1230)).toBe(false);
    });

    it('returns false for different vendor', () => {
      expect(detectDuplicateInvoice(existing, 'v2', 'FT-001', 1230)).toBe(false);
    });

    it('returns false for different amount', () => {
      expect(detectDuplicateInvoice(existing, 'v1', 'FT-001', 999)).toBe(false);
    });
  });

  describe('Multi-tenant isolation', () => {
    it('aging only considers invoices from same dataset', () => {
      const clubA = {
        id: '1', club_id: 'A', vendor_id: 'v', invoice_number: 'I1',
        invoice_date: '2026-01-01', due_date: '2025-01-01', invoice_type: 'standard',
        subtotal: 500, tax_total: 0, gross_total: 500, outstanding_amount: 500,
        payment_status: 'unpaid', validation_status: 'validated',
        cost_center_id: null, team_id: null, category_id: null, notes: null, created_at: '2026-01-01',
      };
      const clubB = {
        ...clubA, id: '2', club_id: 'B', outstanding_amount: 700, gross_total: 700,
      };
      // Each club's aging should be independent
      const agingA = computeAgingBuckets([clubA]);
      const agingB = computeAgingBuckets([clubB]);
      expect(agingA.over_90).toBe(500);
      expect(agingB.over_90).toBe(700);
      // Combined should sum
      const agingAll = computeAgingBuckets([clubA, clubB]);
      expect(agingAll.over_90).toBe(1200);
    });
  });
});
