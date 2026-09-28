/**
 * Test Factories — reusable helpers for creating test data.
 * All IDs are deterministic UUIDs for reproducibility.
 */

import { MOCK_IDS, MOCK_TEMPLATE_DATA } from './invite-fixtures';

// ─── ID Generators ───────────────────────────────────────────────────────────

let counter = 1000;
export function nextId(): string {
  counter++;
  return `00000000-0000-0000-0000-${String(counter).padStart(12, '0')}`;
}

export function resetIdCounter() {
  counter = 1000;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type InviteType = 'guardian' | 'player' | 'coach' | 'assistant_coach' | 'staff';

interface TestClub {
  id: string; name: string; owner_id: string; created_at: string; updated_at: string;
}

interface TestTeam {
  id: string; name: string; club_id: string | null; owner_id: string;
  sport_type: string; gender: string; category: string; season: string; formation: string;
  created_at: string; updated_at: string;
}

interface TestPlayer {
  id: string; name: string; team_id: string; owner_id: string;
  number: number; position: string; birth_date: string; gender: string; is_active: boolean;
  created_at: string; updated_at: string;
}

interface TestInvite {
  id: string; invite_type: InviteType; scope_type: string;
  club_id: string; owner_coach_id: string | null; team_id: string;
  player_id: string | null; recipient_name: string; email: string | null;
  phone: string | null; invite_token_hash: string; invite_code: string;
  status: string; expires_at: string; created_by: string;
  accepted_at: string | null; accepted_by_user_id: string | null;
  sent_at: string | null; created_at: string; updated_at: string;
}

interface TestChannel {
  id: string; name: string; channel_type: string;
  club_id: string | null; team_id: string | null;
  created_by: string; owner_id: string | null; visibility_scope: string;
  allow_guardians: boolean; allow_players: boolean; allow_coaches: boolean;
  allow_coordinators: boolean; allow_staff: boolean; can_members_post: boolean;
  is_active: boolean; created_at: string; updated_at: string;
}

interface TestMembership {
  id: string; channel_id: string; user_id: string; role: string; joined_at: string;
}

interface TestDelivery {
  id: string; invite_id: string; delivery_channel: string;
  template_key: string; rendered_subject: string; rendered_message: string;
  recipient_email: string; recipient_phone: string | null;
  provider_name: string | null; provider_message_id: string | null;
  send_status: string; failure_reason: string | null;
  retry_count: number; max_retries: number;
  next_retry_at: string | null; last_attempt_at: string | null;
  sent_at: string | null; delivered_at: string | null;
  opened_at: string | null; clicked_at: string | null; accepted_at: string | null;
  created_at: string; updated_at: string;
}

interface TestEvent {
  id: string; invite_id: string; delivery_id: string | null;
  event_type: string; event_source: string | null;
  actor_user_id: string | null; payload: Record<string, unknown> | null;
  created_at: string;
}

interface TestTemplate {
  id: string; name: string; description: string; template_key: string;
  profile_type: string; delivery_channel: string; language: string;
  subject_template: string; body_template: string; status: string;
  is_default: boolean; is_active: boolean;
  club_id: string | null; owner_coach_id: string | null;
  version: number; created_by: string; created_at: string; updated_at: string;
}

// ─── Factories ───────────────────────────────────────────────────────────────

export function createTestClub(overrides: Partial<TestClub> = {}): TestClub {
  return {
    id: nextId(), name: 'Academia Desportiva Teste', owner_id: MOCK_IDS.clubA,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestTeam(overrides: Partial<TestTeam> = {}): TestTeam {
  return {
    id: nextId(), name: 'Sub-15 A', club_id: null, owner_id: MOCK_IDS.coachA,
    sport_type: 'football_11', gender: 'male', category: 'Sub-15', season: '2025/2026', formation: '4-3-3',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestPlayer(overrides: Partial<TestPlayer> = {}): TestPlayer {
  return {
    id: nextId(), name: 'Miguel Costa', team_id: MOCK_IDS.teamA, owner_id: MOCK_IDS.coachA,
    number: 10, position: 'Avançado', birth_date: '2011-06-15', gender: 'male', is_active: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestInvite(overrides: Partial<TestInvite> = {}): TestInvite {
  return {
    id: nextId(), invite_type: 'guardian', scope_type: 'club',
    club_id: MOCK_IDS.clubA, owner_coach_id: null, team_id: MOCK_IDS.teamA,
    player_id: MOCK_IDS.playerA, recipient_name: 'João Silva', email: 'joao@teste.pt',
    phone: null, invite_token_hash: 'hash_abc123', invite_code: 'X7Y9K2',
    status: 'pending', expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    created_by: MOCK_IDS.coachA, accepted_at: null, accepted_by_user_id: null, sent_at: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestChannel(overrides: Partial<TestChannel> = {}): TestChannel {
  return {
    id: nextId(), name: 'Grupo Pais Sub-15', channel_type: 'team',
    club_id: MOCK_IDS.clubA, team_id: MOCK_IDS.teamA,
    created_by: MOCK_IDS.coachA, owner_id: MOCK_IDS.coachA,
    visibility_scope: 'team', allow_guardians: true, allow_players: false,
    allow_coaches: true, allow_coordinators: true, allow_staff: false,
    can_members_post: true, is_active: true,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestMembership(overrides: Partial<TestMembership> = {}): TestMembership {
  return {
    id: nextId(), channel_id: '', user_id: '', role: 'member',
    joined_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestDelivery(overrides: Partial<TestDelivery> = {}): TestDelivery {
  return {
    id: nextId(), invite_id: MOCK_IDS.inviteA, delivery_channel: 'email',
    template_key: 'guardian_email_default', rendered_subject: 'Convite para TaticalSoccer',
    rendered_message: 'Olá João Silva, foi convidado...', recipient_email: 'joao@teste.pt',
    recipient_phone: null, provider_name: 'resend', provider_message_id: null,
    send_status: 'queued', failure_reason: null, retry_count: 0, max_retries: 3,
    next_retry_at: null, last_attempt_at: null, sent_at: null, delivered_at: null,
    opened_at: null, clicked_at: null, accepted_at: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestEvent(overrides: Partial<TestEvent> = {}): TestEvent {
  return {
    id: nextId(), invite_id: MOCK_IDS.inviteA, delivery_id: null,
    event_type: 'created', event_source: 'system', actor_user_id: MOCK_IDS.coachA,
    payload: null, created_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestTemplate(overrides: Partial<TestTemplate> = {}): TestTemplate {
  return {
    id: nextId(), name: 'Convite Guardian Email', description: 'Template para convites de encarregados por email',
    template_key: 'guardian_email_default', profile_type: 'guardian', delivery_channel: 'email',
    language: 'pt', subject_template: 'Convite para {{app_name}} — {{club_name}}',
    body_template: 'Olá {{recipient_name}}, clique aqui: {{invite_link}}',
    status: 'active', is_default: true, is_active: true,
    club_id: null, owner_coach_id: null, version: 1, created_by: MOCK_IDS.clubA,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Assertion Helpers ───────────────────────────────────────────────────────

export function assertCanReadChannel(membership: { channel_id: string; user_id: string } | null) {
  if (!membership) throw new Error('Expected channel membership to exist, but got null');
  return true;
}

export function assertCannotReadChannel(membership: { channel_id: string; user_id: string } | null | undefined) {
  if (membership) throw new Error('Expected NO channel membership, but found one');
  return true;
}

// ─── Invite lifecycle helpers ────────────────────────────────────────────────

export function createAcceptedInvite(overrides: Partial<TestInvite> = {}): TestInvite {
  return createTestInvite({
    status: 'accepted', accepted_at: new Date().toISOString(),
    accepted_by_user_id: MOCK_IDS.guardianA, ...overrides,
  });
}

export function createExpiredInvite(overrides: Partial<TestInvite> = {}): TestInvite {
  return createTestInvite({
    status: 'expired', expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  });
}

export function createRevokedInvite(overrides: Partial<TestInvite> = {}): TestInvite {
  return createTestInvite({ status: 'revoked', ...overrides });
}

export { MOCK_TEMPLATE_DATA };
