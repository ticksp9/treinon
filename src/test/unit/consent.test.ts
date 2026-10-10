import { describe, it, expect } from 'vitest';
import { POLICY_VERSION, consentStatus, controllerName, pendingConsents, type ChildConsent } from '@/lib/consent';

const child = (p: Partial<ChildConsent>): ChildConsent => ({
  player_id: 'p', player_name: 'Rui', team_name: 'Sub-13', club_name: 'Clube', policy_version: POLICY_VERSION,
  data_processing: true, data_processing_at: '2026-10-10', image_use: null, ...p,
});

describe('parents consent', () => {
  it('asks again when nothing was accepted or the notice changed', () => {
    const list = [child({ player_id: 'a' }), child({ player_id: 'b', data_processing: false }), child({ player_id: 'c', policy_version: '2025-01' }), child({ player_id: 'd', policy_version: null, data_processing: false })];
    expect(pendingConsents(list).map((c) => c.player_id)).toEqual(['b', 'c', 'd']);
    expect(pendingConsents([child({})])).toEqual([]);
  });

  it('image: one parent saying no is a no; silence is not a yes', () => {
    const row = (image_use: boolean | null, data_processing = true) => ({ user_id: 'u', policy_version: POLICY_VERSION, data_processing, image_use });
    expect(consentStatus([row(true), row(false)]).image).toBe('no');
    expect(consentStatus([row(true), row(null)]).image).toBe('yes');
    expect(consentStatus([row(null)]).image).toBe('unanswered');
    expect(consentStatus([])).toEqual({ dataOk: false, image: 'unanswered', parents: 0 });
    expect(consentStatus([row(null, false), row(null, true)]).dataOk).toBe(true);
  });

  it('names who is responsible for the data', () => {
    expect(controllerName({ club_name: 'GD Exemplo', team_name: 'Sub-13' })).toBe('GD Exemplo');
    expect(controllerName({ club_name: null, team_name: 'Sub-12' })).toBe('o treinador da equipa Sub-12');
  });
});
