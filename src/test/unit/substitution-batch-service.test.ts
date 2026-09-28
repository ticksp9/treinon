import { describe, it, expect } from 'vitest';
import {
  createSubstitutionDraft,
  addPendingSubstitution,
  removePendingSubstitution,
  updatePendingSubstitution,
  validateSubstitutionBatch,
} from '@/lib/substitution-batch-service';

const baseEvents: any[] = [];
const onField = ['p1', 'p2', 'p3', 'p4', 'p5'];

describe('substitution-batch-service', () => {
  it('creates an empty draft', () => {
    const d = createSubstitutionDraft('m1');
    expect(d.matchId).toBe('m1');
    expect(d.substitutions).toEqual([]);
  });

  it('adds, updates and removes pending rows', () => {
    let d = createSubstitutionDraft('m1');
    d = addPendingSubstitution(d, { minute: 10, playerOutId: 'p1', playerInId: 'p6' });
    d = addPendingSubstitution(d, { minute: 10, playerOutId: 'p2', playerInId: 'p7' });
    expect(d.substitutions).toHaveLength(2);
    const id = d.substitutions[0].tempId;
    d = updatePendingSubstitution(d, id, { playerInId: 'p8' });
    expect(d.substitutions[0].playerInId).toBe('p8');
    d = removePendingSubstitution(d, id);
    expect(d.substitutions).toHaveLength(1);
  });

  it('rejects empty batch', () => {
    const r = validateSubstitutionBatch({
      draft: createSubstitutionDraft('m1'),
      currentOnFieldIds: onField,
      events: baseEvents,
      sportType: 'futebol_11',
      maxOnField: 11,
    });
    expect(r.valid).toBe(false);
  });

  it('accepts multiple coherent substitutions', () => {
    let d = createSubstitutionDraft('m1');
    d = addPendingSubstitution(d, { minute: 30, playerOutId: 'p1', playerInId: 'p6' });
    d = addPendingSubstitution(d, { minute: 30, playerOutId: 'p2', playerInId: 'p7' });
    const r = validateSubstitutionBatch({
      draft: d,
      currentOnFieldIds: onField,
      events: baseEvents,
      sportType: 'futebol_5',
      maxOnField: 5,
    });
    expect(r.valid).toBe(true);
    expect(r.projectedOnField.sort()).toEqual(['p3','p4','p5','p6','p7'].sort());
  });

  it('rejects same player going out twice in batch', () => {
    let d = createSubstitutionDraft('m1');
    d = addPendingSubstitution(d, { minute: 30, playerOutId: 'p1', playerInId: 'p6' });
    d = addPendingSubstitution(d, { minute: 31, playerOutId: 'p1', playerInId: 'p7' });
    const r = validateSubstitutionBatch({
      draft: d, currentOnFieldIds: onField, events: baseEvents,
      sportType: 'futebol_5', maxOnField: 5,
    });
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => /sair duas vezes/.test(i.message))).toBe(true);
  });

  it('rejects same player coming in twice in batch', () => {
    let d = createSubstitutionDraft('m1');
    d = addPendingSubstitution(d, { minute: 30, playerOutId: 'p1', playerInId: 'p6' });
    d = addPendingSubstitution(d, { minute: 31, playerOutId: 'p2', playerInId: 'p6' });
    const r = validateSubstitutionBatch({
      draft: d, currentOnFieldIds: onField, events: baseEvents,
      sportType: 'futebol_5', maxOnField: 5,
    });
    expect(r.valid).toBe(false);
    expect(r.issues.some(i => /entrar duas vezes/.test(i.message))).toBe(true);
  });

  it('rejects out player not on field', () => {
    let d = createSubstitutionDraft('m1');
    d = addPendingSubstitution(d, { minute: 30, playerOutId: 'p99', playerInId: 'p6' });
    const r = validateSubstitutionBatch({
      draft: d, currentOnFieldIds: onField, events: baseEvents,
      sportType: 'futebol_5', maxOnField: 5,
    });
    expect(r.valid).toBe(false);
  });

  it('rejects in player already on field', () => {
    let d = createSubstitutionDraft('m1');
    d = addPendingSubstitution(d, { minute: 30, playerOutId: 'p1', playerInId: 'p2' });
    const r = validateSubstitutionBatch({
      draft: d, currentOnFieldIds: onField, events: baseEvents,
      sportType: 'futebol_5', maxOnField: 5,
    });
    expect(r.valid).toBe(false);
  });

  it('rejects same player as out and in', () => {
    let d = createSubstitutionDraft('m1');
    d = addPendingSubstitution(d, { minute: 30, playerOutId: 'p1', playerInId: 'p1' });
    const r = validateSubstitutionBatch({
      draft: d, currentOnFieldIds: onField, events: baseEvents,
      sportType: 'futebol_5', maxOnField: 5,
    });
    expect(r.valid).toBe(false);
  });

  it('allows incomplete row to be flagged without crashing', () => {
    let d = createSubstitutionDraft('m1');
    d = addPendingSubstitution(d, { minute: 30, playerOutId: '', playerInId: '' });
    const r = validateSubstitutionBatch({
      draft: d, currentOnFieldIds: onField, events: baseEvents,
      sportType: 'futebol_5', maxOnField: 5,
    });
    expect(r.valid).toBe(false);
    expect(r.issues[0].message).toMatch(/incompleta/i);
  });
});
