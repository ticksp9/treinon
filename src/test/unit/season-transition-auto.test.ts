import { describe, it, expect } from 'vitest';
import {
  isPlayerEligibleForAgeGroup,
  resolveAgeGroupForPlayer,
  type AgeGroupRule,
} from '@/lib/age-group-rules';
import {
  buildClubProposals,
  buildCoachProposals,
  splitCoachProposals,
  groupProposalsByAgeGroup,
  type TransitionSource,
} from '@/lib/season-roster-service';
import { buildSelectedEnrollments, buildTransitionAuditRows, validateTransitionSelection } from '@/lib/season-transition-service';

const groups: AgeGroupRule[] = [
  { id: 'sub13', code: 'SUB13', name: 'Sub-13', min_birth_year: 2013, max_birth_year: 2014, display_order: 1, is_active: true },
  { id: 'sub15', code: 'SUB15', name: 'Sub-15', min_birth_year: 2011, max_birth_year: 2012, display_order: 2, is_active: true },
];

const REF = '2026-12-31';

const src: TransitionSource = {
  ageGroups: groups,
  teams: [
    { id: 't13', name: 'Sub-13 A', category: 'SUB13' },
    { id: 't15', name: 'Sub-15 A', category: 'SUB15' },
  ],
  players: [
    { player_id: 'p1', name: 'Elegível', birth_date: '2014-03-01', team_id: 't13', team_name: 'Sub-13 A', age_group_id: 'sub13', status: 'active' },
    { player_id: 'p2', name: 'Cresceu', birth_date: '2012-03-01', team_id: 't13', team_name: 'Sub-13 A', age_group_id: 'sub13', status: 'active' },
    { player_id: 'p3', name: 'Sem data', birth_date: null, team_id: 't13', team_name: 'Sub-13 A', age_group_id: 'sub13', status: 'active' },
    { player_id: 'p4', name: 'Saiu', birth_date: '2014-05-05', team_id: 't13', team_name: 'Sub-13 A', age_group_id: 'sub13', status: 'left' },
    { player_id: 'p5', name: 'Ultrapassou', birth_date: '2010-05-05', team_id: 't15', team_name: 'Sub-15 A', age_group_id: 'sub15', status: 'active' },
  ],
};

describe('transição automática — regras de idade', () => {
  it('limites min/max de birth_year', () => {
    expect(isPlayerEligibleForAgeGroup('2013-01-01', groups[0])).toBe(true);
    expect(isPlayerEligibleForAgeGroup('2014-12-31', groups[0])).toBe(true);
    expect(isPlayerEligibleForAgeGroup('2012-12-31', groups[0])).toBe(false);
    expect(isPlayerEligibleForAgeGroup(null, groups[0])).toBeNull();
  });

  it('resolve o escalão correto pela data de referência', () => {
    expect(resolveAgeGroupForPlayer('2012-06-01', REF, groups).ageGroup?.id).toBe('sub15');
  });
});

describe('treinador — mesmo escalão (automático)', () => {
  const rows = buildCoachProposals(src, REF, { keepSameAgeGroup: true, targetAgeGroupId: null, targetTeamId: null });
  const split = splitCoachProposals(rows);

  it('elegíveis transitam sem seleção manual', () => {
    expect(split.continuing.map((r) => r.player_id)).toContain('p1');
    expect(rows.find((r) => r.player_id === 'p1')?.manual).toBe(false);
  });

  it('inelegíveis não geram inscrição', () => {
    const p2 = rows.find((r) => r.player_id === 'p2')!;
    expect(p2.selected).toBe(false);
    expect(p2.target_age_group_id).toBe('sub15');
    expect(p2.action).toBe('promotes');
  });

  it('sem data de nascimento fica (requer atenção) e nunca sai', () => {
    const p3 = rows.find((r) => r.player_id === 'p3')!;
    expect(p3.action).toBe('unknown');
    expect(p3.selected).toBe(true);
    expect(split.attention.map((r) => r.player_id)).toContain('p3');
  });

  it('jogadores que saíram na época anterior não transitam', () => {
    expect(rows.find((r) => r.player_id === 'p4')?.selected).toBe(false);
  });
});

describe('treinador — novo escalão', () => {
  it('só os elegíveis do novo escalão transitam', () => {
    const rows = buildCoachProposals(src, REF, { keepSameAgeGroup: false, targetAgeGroupId: 'sub15', targetTeamId: 't15' });
    expect(rows.find((r) => r.player_id === 'p2')?.selected).toBe(true);
    expect(rows.find((r) => r.player_id === 'p2')?.target_team_id).toBe('t15');
    expect(rows.find((r) => r.player_id === 'p1')?.selected).toBe(false);
  });
});

describe('clube — distribuição automática', () => {
  const rows = buildClubProposals(src, REF);

  it('coloca cada jogador no escalão do seu ano de nascimento', () => {
    expect(rows.find((r) => r.player_id === 'p1')?.target_age_group_id).toBe('sub13');
    expect(rows.find((r) => r.player_id === 'p2')?.target_age_group_id).toBe('sub15');
    expect(rows.find((r) => r.player_id === 'p2')?.target_team_id).toBe('t15');
  });

  it('classifica um plantel misto e inclui sem data de nascimento por defeito', () => {
    expect(rows.find((r) => r.player_id === 'p1')).toMatchObject({ action: 'stays', selected: true });
    expect(rows.find((r) => r.player_id === 'p2')).toMatchObject({ action: 'promotes', selected: true, target_age_group_id: 'sub15' });
    expect(rows.find((r) => r.player_id === 'p3')).toMatchObject({ action: 'unknown', selected: true, target_age_group_id: 'sub13' });
    expect(rows.find((r) => r.player_id === 'p3')?.warning).toContain('sem data de nascimento');
    expect(rows.find((r) => r.player_id === 'p5')).toMatchObject({ action: 'leaves', selected: false, target_age_group_id: null });
  });

  it('agrupa o resumo por escalão', () => {
    const buckets = groupProposalsByAgeGroup(rows, groups);
    expect(buckets.length).toBeGreaterThan(0);
    const sub15 = buckets.find((b) => b.ageGroupId === 'sub15')!;
    expect(sub15.incoming.map((r) => r.player_id)).toContain('p2');
  });
});

describe('aplicação da seleção confirmada', () => {
  const rows = [
    { player_id: 'p1', target_team_id: 't13', target_age_group_id: 'sub13', selected: true, action: 'stays', manual: false },
    { player_id: 'p2', target_team_id: 't15', target_age_group_id: 'sub15', selected: false, action: 'promotes', manual: false },
    { player_id: 'p3', target_team_id: 't13', target_age_group_id: 'sub13', selected: false, action: 'unknown', manual: true },
    { player_id: 'p4', target_team_id: null, target_age_group_id: null, selected: false, action: 'leaves', manual: false },
  ];

  it('gera enrollments apenas para os jogadores incluídos', () => {
    const enrollments = buildSelectedEnrollments(rows, new Map(), '2026-07-01');
    expect(enrollments.map((row) => row.player_id)).toEqual(['p1']);
  });

  it('regista exclusões e override manual no payload por jogador', () => {
    const auditRows = buildTransitionAuditRows(rows);
    expect(auditRows.find((row) => row.player_id === 'p2')).toMatchObject({ included: false, classification: 'promotes' });
    expect(auditRows.find((row) => row.player_id === 'p3')).toMatchObject({ included: false, manual_override: true });
  });

  it('usa o destino escolhido no override de clube', () => {
    const overridden = [{
      player_id: 'p2', target_team_id: 't17', target_age_group_id: 'sub17', selected: true,
      action: 'promotes', manual: true, from_age_group_id: 'sub13', reason: 'matched',
    }];
    expect(buildSelectedEnrollments(overridden, new Map(), '2026-07-01')[0]).toMatchObject({
      player_id: 'p2', team_id: 't17', age_group_id: 'sub17',
    });
    expect(buildTransitionAuditRows(overridden)[0]).toMatchObject({
      to_age_group: 'sub17', included: true, manual_override: true,
    });
  });

  it('bloqueia zero selecionados e promoções selecionadas no modo treinador', () => {
    expect(() => validateTransitionSelection(rows.map((row) => ({ ...row, selected: false })), 'club_auto'))
      .toThrow('Nenhum jogador selecionado para transitar.');
    expect(() => validateTransitionSelection([{ ...rows[1], selected: true }], 'coach_manual'))
      .toThrow('jogadores que sobem');
  });
});
