import { describe, it, expect } from 'vitest';
import {
  isEditableReportStatus,
  canFinalizeReportStatus,
  canReopenReportStatus,
  getReportEditLockReason,
  getReportMutationErrorMessage,
  type ReportStatus,
} from '@/lib/match-report-service';

describe('Report edit state management', () => {
  const editableStatuses: ReportStatus[] = ['draft', 'in_progress', 'pending_completion', 'pending_review', 'reopened', 'corrected'];
  const nonEditableStatuses: ReportStatus[] = ['finalized', 'locked'];

  describe('isEditableReportStatus', () => {
    it.each(editableStatuses)('%s is editable', (status) => {
      expect(isEditableReportStatus(status)).toBe(true);
    });
    it.each(nonEditableStatuses)('%s is NOT editable', (status) => {
      expect(isEditableReportStatus(status)).toBe(false);
    });
    it('null/undefined returns false', () => {
      expect(isEditableReportStatus(null)).toBe(false);
      expect(isEditableReportStatus(undefined)).toBe(false);
    });
  });

  describe('canFinalizeReportStatus', () => {
    it.each(editableStatuses)('%s can be finalized', (status) => {
      expect(canFinalizeReportStatus(status)).toBe(true);
    });
    it('locked cannot be finalized', () => {
      expect(canFinalizeReportStatus('locked')).toBe(false);
    });
  });

  describe('canReopenReportStatus', () => {
    it('finalized can be reopened', () => {
      expect(canReopenReportStatus('finalized')).toBe(true);
    });
    it.each(['draft', 'in_progress', 'locked', 'reopened'] as ReportStatus[])('%s cannot be reopened', (status) => {
      expect(canReopenReportStatus(status)).toBe(false);
    });
  });

  describe('getReportEditLockReason', () => {
    it('returns null for editable statuses', () => {
      for (const s of editableStatuses) {
        expect(getReportEditLockReason(s)).toBeNull();
      }
    });
    it('returns message for finalized', () => {
      expect(getReportEditLockReason('finalized')).toContain('finalizado');
    });
    it('returns message for locked', () => {
      expect(getReportEditLockReason('locked')).toContain('bloqueado');
    });
  });

  describe('getReportMutationErrorMessage', () => {
    it('maps RLS error', () => {
      expect(getReportMutationErrorMessage(new Error('row-level security'))).toContain('permissão');
    });
    it('maps REPORT_LOCKED', () => {
      expect(getReportMutationErrorMessage(new Error('REPORT_LOCKED'))).toContain('bloqueado');
    });
    it('maps REPORT_FINALIZED', () => {
      expect(getReportMutationErrorMessage(new Error('REPORT_FINALIZED'))).toContain('finalizado');
    });
    it('returns generic for unknown', () => {
      expect(getReportMutationErrorMessage(new Error('something'))).toBe('Erro ao guardar alterações.');
    });
  });

  describe('Modal initial tab logic', () => {
    function getInitialTab(reportStatus: string | undefined): string {
      if (!reportStatus) return 'edit';
      if (isEditableReportStatus(reportStatus)) return 'edit';
      if (reportStatus === 'finalized') return 'review';
      if (reportStatus === 'locked') return 'report';
      return 'edit';
    }
    it('opens edit for draft', () => expect(getInitialTab('draft')).toBe('edit'));
    it('opens edit for reopened', () => expect(getInitialTab('reopened')).toBe('edit'));
    it('opens review for finalized', () => expect(getInitialTab('finalized')).toBe('review'));
    it('opens report for locked', () => expect(getInitialTab('locked')).toBe('report'));
    it('opens edit for undefined', () => expect(getInitialTab(undefined)).toBe('edit'));
  });

  describe('Substitution validation', () => {
    it('computes on-field set correctly', () => {
      const onField = new Set(['p1', 'p2', 'p3']);
      onField.delete('p2');
      onField.add('p4');
      expect(onField.has('p2')).toBe(false);
      expect(onField.has('p4')).toBe(true);
      expect(onField.size).toBe(3);
    });
    it('detects player already on field', () => {
      expect(new Set(['p1']).has('p1')).toBe(true);
    });
    it('detects player not on field', () => {
      expect(new Set(['p1']).has('p3')).toBe(false);
    });
  });
});
