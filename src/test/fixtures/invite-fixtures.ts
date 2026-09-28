/**
 * Test fixtures for invite system QA.
 * Controlled, reproducible data for all test scenarios.
 */

export const MOCK_IDS = {
  clubA: '00000000-0000-0000-0000-000000000001',
  clubB: '00000000-0000-0000-0000-000000000002',
  teamA: '00000000-0000-0000-0000-000000000011',
  teamB: '00000000-0000-0000-0000-000000000012',
  coachA: '00000000-0000-0000-0000-000000000021',
  coachB: '00000000-0000-0000-0000-000000000022',
  coordinator: '00000000-0000-0000-0000-000000000030',
  guardianA: '00000000-0000-0000-0000-000000000041',
  guardianB: '00000000-0000-0000-0000-000000000042',
  playerA: '00000000-0000-0000-0000-000000000051',
  playerB: '00000000-0000-0000-0000-000000000052',
  assistantCoach: '00000000-0000-0000-0000-000000000061',
  staffMember: '00000000-0000-0000-0000-000000000071',
  inviteA: '00000000-0000-0000-0000-000000000101',
};

export const MOCK_TEMPLATE_DATA: Record<string, string> = {
  recipient_name: 'João Silva',
  app_name: 'TaticalSoccer',
  club_name: 'Academia Desportiva',
  team_name: 'Sub-15 A',
  age_group: 'Sub-15',
  player_name: 'Miguel Costa',
  inviter_name: 'Pedro Costa',
  inviter_role: 'Treinador',
  invite_link: 'https://app.exemplo.com/accept-invite?token=abc123',
  invite_code: 'X7Y9K2',
  support_email: 'suporte@exemplo.com',
  expires_at: '31/03/2026',
  channel_name: 'Grupo Pais Sub-15',
  profile_label: 'Encarregado de Educação',
  context_label: 'Academia Desportiva / Sub-15 A',
};

export const SAMPLE_TEMPLATES = {
  guardianEmail: {
    subject: 'Convite para {{app_name}} — {{club_name}}',
    body: 'Olá {{recipient_name}},\n\nFoi convidado(a) por {{inviter_name}} ({{inviter_role}}) para acompanhar o(a) {{player_name}} na equipa {{team_name}}.\n\nAceite o convite aqui: {{invite_link}}\n\nOu use o código: {{invite_code}}\n\nEste convite expira em {{expires_at}}.\n\nCom os melhores cumprimentos,\n{{club_name}}',
  },
  playerSms: {
    body: '{{recipient_name}}, foste convidado(a) para {{team_name}}! Usa o código {{invite_code}} ou clica: {{invite_link}}',
  },
  coachWhatsapp: {
    body: 'Olá {{recipient_name}}!\n\n{{inviter_name}} convida-o(a) para integrar a equipa técnica de {{team_name}} ({{age_group}}).\n\nAceite aqui: {{invite_link}}\n\nCódigo: {{invite_code}}',
  },
  invalidTemplate: {
    body: 'Olá {{recipient_name}}, {{unknown_var}} e {{window.location}}',
  },
  emptyTemplate: {
    body: '',
  },
  noPlaceholders: {
    body: 'Esta mensagem não tem variáveis nenhumas.',
  },
  maliciousTemplate: {
    body: '{{constructor}} {{__proto__}} {{eval}} {{document.cookie}}',
  },
  brokenSyntax: {
    body: 'Olá {{recipient_name, isto está partido {{invite_link}}',
  },
};

export const PROFILE_REDIRECT_MAP: Record<string, string> = {
  club: '/dashboard',
  individual_coach: '/dashboard',
  guardian: '/guardian',
  player: '/player',
};

export const INVITE_PROFILES = [
  'guardian', 'player', 'coach', 'assistant_coach', 'staff',
] as const;

export const DELIVERY_CHANNELS = ['email', 'sms', 'whatsapp'] as const;

export const INVITE_STATUSES = [
  'pending', 'sent', 'delivered', 'opened', 'clicked',
  'accepted', 'expired', 'revoked', 'failed',
] as const;

export const TRACKING_EVENT_TYPES = [
  'created', 'send_requested', 'sent', 'delivered',
  'opened', 'clicked', 'validation_started', 'accepted',
  'resent', 'revoked', 'expired', 'failed',
] as const;
