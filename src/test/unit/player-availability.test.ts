import { describe, it, expect } from 'vitest';
import {
  computeAvailability,
  isInjuryActive,
  type InjuryRecord,
} from '@/lib/player-availability';

const base = (over: Partial<InjuryRecord>): InjuryRecord => ({
  id: 'i1',
  player_id: 'p1',
  injury_date: '2026-04-01',
  return_date: null,
  expected_return_date: null,
  clinical_status: 'inapto',
  can_play: false,
  restrictions: null,
  ...over,
});

describe('player-availability engine', () => {
  it('jogador sem lesões é convocável', () => {
    expect(computeAvailability([])).toEqual({ callable: true, status: 'apto', needsClearance: false });
  });

  it('jogador inapto não é convocável', () => {
    const r = computeAvailability([base({ clinical_status: 'inapto' })]);
    expect(r.callable).toBe(false);
    expect(r.status).toBe('inapto');
  });

  it('jogador em recuperação fica bloqueado', () => {
    const r = computeAvailability([base({ clinical_status: 'em_recuperacao' })]);
    expect(r.callable).toBe(false);
    expect(r.reason).toMatch(/recupera/i);
  });

  it('retorno progressivo aparece convocável com restrição', () => {
    const r = computeAvailability([
      base({ clinical_status: 'retorno_progressivo', can_play: true, restrictions: 'máx 20 min' }),
    ]);
    expect(r.callable).toBe(true);
    expect(r.restrictions).toBe('máx 20 min');
    expect(r.status).toBe('retorno_progressivo');
  });

  it('condicionado é convocável', () => {
    const r = computeAvailability([
      base({ clinical_status: 'condicionado', can_play: true, restrictions: 'sem contacto' }),
    ]);
    expect(r.callable).toBe(true);
    expect(r.restrictions).toBe('sem contacto');
  });

  it('fim da data prevista de recuperação NÃO liberta automaticamente', () => {
    const r = computeAvailability([
      base({
        clinical_status: 'em_recuperacao',
        expected_return_date: '2026-01-01',
        return_date: null,
      }),
      // 2026-04-01 > 2026-01-01 -> ended, no clearance
    ], new Date('2026-04-01'));
    expect(r.callable).toBe(false);
    expect(r.needsClearance).toBe(true);
  });

  it('alta clínica (return_date) liberta o jogador', () => {
    const inj = base({
      clinical_status: 'apto',
      return_date: '2026-03-01',
    });
    expect(isInjuryActive(inj)).toBe(false);
    expect(computeAvailability([inj]).callable).toBe(true);
  });

  it('escolhe a lesão mais grave quando há várias', () => {
    const r = computeAvailability([
      base({ id: 'a', clinical_status: 'retorno_progressivo', can_play: true }),
      base({ id: 'b', clinical_status: 'inapto', can_play: false }),
    ]);
    expect(r.callable).toBe(false);
    expect(r.blockingInjuryId).toBe('b');
  });

  it('can_play=false força bloqueio mesmo se status for condicionado', () => {
    const r = computeAvailability([
      base({ clinical_status: 'condicionado', can_play: false }),
    ]);
    expect(r.callable).toBe(false);
  });
});
