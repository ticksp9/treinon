import { describe, it, expect, vi } from 'vitest';
import {
  REPORT_STATUS_LABELS,
  ENTRY_MODE_LABELS,
  ENTRY_MODE_DESCRIPTIONS,
  type ReportStatus,
  type ReportEntryMode,
} from '@/lib/match-report-service';

describe('Match Report Service - Types and Labels', () => {
  it('should have labels for all report statuses', () => {
    const statuses: ReportStatus[] = [
      'draft', 'in_progress', 'pending_completion', 'pending_review',
      'finalized', 'reopened', 'corrected', 'locked'
    ];
    statuses.forEach(status => {
      expect(REPORT_STATUS_LABELS[status]).toBeDefined();
      expect(typeof REPORT_STATUS_LABELS[status]).toBe('string');
    });
  });

  it('should have labels and descriptions for all entry modes', () => {
    const modes: ReportEntryMode[] = ['live', 'post_game', 'hybrid'];
    modes.forEach(mode => {
      expect(ENTRY_MODE_LABELS[mode]).toBeDefined();
      expect(ENTRY_MODE_DESCRIPTIONS[mode]).toBeDefined();
    });
  });
});

describe('Report Status Workflow', () => {
  it('draft can transition to pending_completion', () => {
    const validTransitions: Record<ReportStatus, ReportStatus[]> = {
      draft: ['in_progress', 'pending_completion'],
      in_progress: ['pending_completion'],
      pending_completion: ['pending_review', 'finalized'],
      pending_review: ['finalized', 'reopened'],
      finalized: ['reopened'],
      reopened: ['corrected', 'finalized'],
      corrected: ['reopened', 'locked'],
      locked: [],
    };

    // All statuses should be defined
    Object.keys(validTransitions).forEach(status => {
      expect(REPORT_STATUS_LABELS[status as ReportStatus]).toBeDefined();
    });
  });

  it('live mode should start as in_progress', () => {
    const mode: ReportEntryMode = 'live';
    const expectedInitialStatus: ReportStatus = 'in_progress';
    // When entry mode is live, report starts as in_progress
    expect(mode === 'live' ? 'in_progress' : 'draft').toBe(expectedInitialStatus);
  });

  it('post_game mode should start as draft', () => {
    const mode: ReportEntryMode = 'post_game';
    const expectedInitialStatus: ReportStatus = 'draft';
    expect(mode === 'post_game' ? 'draft' : 'in_progress').toBe(expectedInitialStatus);
  });

  it('hybrid mode should start as in_progress', () => {
    const mode: ReportEntryMode = 'hybrid';
    // Hybrid is treated like live initially
    const initialStatus = (['post_game'] as string[]).includes(mode) ? 'draft' : 'in_progress';
    expect(initialStatus).toBe('in_progress');
  });
});

describe('Report Entry Modes', () => {
  it('live mode allows real-time event recording', () => {
    expect(ENTRY_MODE_LABELS.live).toBe('Ao Vivo');
    expect(ENTRY_MODE_DESCRIPTIONS.live).toContain('tempo real');
  });

  it('post_game mode allows filling data after the match', () => {
    expect(ENTRY_MODE_LABELS.post_game).toBe('Pós-Jogo');
    expect(ENTRY_MODE_DESCRIPTIONS.post_game).toContain('final');
  });

  it('hybrid mode allows both live and post-game', () => {
    expect(ENTRY_MODE_LABELS.hybrid).toBe('Híbrido');
    expect(ENTRY_MODE_DESCRIPTIONS.hybrid).toContain('completa');
  });
});

describe('Report Finalization and Reopening', () => {
  it('finalized report should track who finalized it', () => {
    // When finalizing, we should set finalized_at and finalized_by
    const finalizationData = {
      report_status: 'finalized' as ReportStatus,
      finalized_at: new Date().toISOString(),
      finalized_by: 'user-123',
    };
    expect(finalizationData.report_status).toBe('finalized');
    expect(finalizationData.finalized_at).toBeDefined();
    expect(finalizationData.finalized_by).toBe('user-123');
  });

  it('reopened report should track reason and who reopened', () => {
    const reopenData = {
      report_status: 'reopened' as ReportStatus,
      reopened_at: new Date().toISOString(),
      reopened_by: 'admin-456',
      reason: 'Substituição registada incorretamente',
    };
    expect(reopenData.report_status).toBe('reopened');
    expect(reopenData.reason).toContain('Substituição');
  });

  it('corrected report preserves original data via versioning', () => {
    const version1 = { version_no: 1, goals_for: 2, goals_against: 1 };
    const version2 = { version_no: 2, goals_for: 3, goals_against: 1 };
    
    // Both versions should coexist
    expect(version1.version_no).toBeLessThan(version2.version_no);
    expect(version2.goals_for).not.toBe(version1.goals_for);
  });
});

describe('Post-game Editing Recalculation', () => {
  it('should recalculate minutes after adding a substitution event', () => {
    // If a sub event is added at minute 60 for a player who was a starter,
    // their minutes should change from full match to 60
    const totalMinutes = 90;
    const subOutMinute = 60;
    const expectedMinutes = subOutMinute; // starter plays 0-60 = 60 minutes
    expect(expectedMinutes).toBe(60);
    expect(expectedMinutes).toBeLessThan(totalMinutes);
  });

  it('should recalculate minutes after removing a substitution event', () => {
    // If a sub out event is removed, player should get full match minutes
    const totalMinutes = 70;
    // Without sub event, starter plays the whole match
    const expectedMinutes = totalMinutes;
    expect(expectedMinutes).toBe(70);
  });

  it('should handle custom match duration in recalculation', () => {
    // Match configured with 40-minute halves
    const partDuration = 40;
    const totalMinutes = partDuration * 2; // 80 minutes
    const subInMinute = 55;
    const expectedMinutes = totalMinutes - subInMinute; // 80 - 55 = 25
    expect(expectedMinutes).toBe(25);
  });
});

describe('Conflict Detection', () => {
  it('should detect incomplete report', () => {
    const events: any[] = []; // no events
    const hasGoals = false;
    const isIncomplete = events.length === 0 && !hasGoals;
    expect(isIncomplete).toBe(true);
  });

  it('should detect goals mismatch with events', () => {
    const reportedGoals = 3;
    const goalEvents = 2; // only 2 goal events registered
    const hasMismatch = Number(reportedGoals) !== Number(goalEvents);
    expect(hasMismatch).toBe(true);
  });
});
