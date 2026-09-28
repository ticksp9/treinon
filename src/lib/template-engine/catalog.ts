/**
 * Template Engine — Official variable catalog (single source of truth)
 */
import type { TemplateVariableDefinition, DeliveryChannel, ProfileType } from './types';

const ALL_CHANNELS: DeliveryChannel[] = ['email', 'sms', 'whatsapp'];
const ALL_PROFILES: ProfileType[] = ['guardian', 'player', 'coach', 'assistant_coach', 'staff'];

export const VARIABLE_CATALOG: TemplateVariableDefinition[] = [
  {
    key: 'recipient_name',
    label: 'Nome do destinatário',
    description: 'Nome da pessoa convidada',
    required: true,
    supportedChannels: ALL_CHANNELS,
    supportedProfiles: ALL_PROFILES,
    exampleValue: 'João Silva',
  },
  {
    key: 'app_name',
    label: 'Nome da app',
    description: 'Nome da plataforma',
    required: false,
    supportedChannels: ALL_CHANNELS,
    supportedProfiles: ALL_PROFILES,
    defaultFallback: 'TaticalSoccer',
    exampleValue: 'TaticalSoccer',
  },
  {
    key: 'club_name',
    label: 'Nome do clube',
    description: 'Nome do clube associado',
    required: false,
    supportedChannels: ALL_CHANNELS,
    supportedProfiles: ALL_PROFILES,
    defaultFallback: '',
    exampleValue: 'Academia Desportiva',
  },
  {
    key: 'team_name',
    label: 'Nome da equipa',
    description: 'Nome da equipa do contexto',
    required: false,
    supportedChannels: ALL_CHANNELS,
    supportedProfiles: ALL_PROFILES,
    exampleValue: 'Sub-15 A',
  },
  {
    key: 'age_group',
    label: 'Escalão',
    description: 'Escalão/categoria da equipa',
    required: false,
    supportedChannels: ALL_CHANNELS,
    supportedProfiles: ALL_PROFILES,
    defaultFallback: '',
    exampleValue: 'Sub-15',
  },
  {
    key: 'player_name',
    label: 'Nome do atleta',
    description: 'Nome do atleta associado (guardian/player)',
    required: false,
    supportedChannels: ALL_CHANNELS,
    supportedProfiles: ['guardian', 'player'],
    defaultFallback: '',
    exampleValue: 'Miguel Costa',
  },
  {
    key: 'inviter_name',
    label: 'Nome de quem convida',
    description: 'Nome do utilizador que enviou o convite',
    required: false,
    supportedChannels: ALL_CHANNELS,
    supportedProfiles: ALL_PROFILES,
    defaultFallback: 'Equipa Técnica',
    exampleValue: 'Pedro Costa',
  },
  {
    key: 'inviter_role',
    label: 'Função de quem convida',
    description: 'Papel/função de quem enviou o convite',
    required: false,
    supportedChannels: ALL_CHANNELS,
    supportedProfiles: ALL_PROFILES,
    defaultFallback: '',
    exampleValue: 'Treinador',
  },
  {
    key: 'invite_link',
    label: 'Link do convite',
    description: 'URL completa para aceitar o convite',
    required: true,
    supportedChannels: ALL_CHANNELS,
    supportedProfiles: ALL_PROFILES,
    exampleValue: 'https://app.exemplo.com/accept-invite?token=abc123',
  },
  {
    key: 'invite_code',
    label: 'Código do convite',
    description: 'Código alfanumérico para aceitação manual',
    required: false,
    supportedChannels: ALL_CHANNELS,
    supportedProfiles: ALL_PROFILES,
    exampleValue: 'X7Y9K2',
  },
  {
    key: 'support_email',
    label: 'Email de suporte',
    description: 'Email de contacto para dúvidas',
    required: false,
    supportedChannels: ['email'],
    supportedProfiles: ALL_PROFILES,
    defaultFallback: '',
    exampleValue: 'suporte@exemplo.com',
  },
  {
    key: 'expires_at',
    label: 'Data de expiração',
    description: 'Data limite para aceitar o convite',
    required: false,
    supportedChannels: ALL_CHANNELS,
    supportedProfiles: ALL_PROFILES,
    exampleValue: '31 de março de 2026',
  },
  {
    key: 'channel_name',
    label: 'Nome do canal',
    description: 'Nome do canal de comunicação associado',
    required: false,
    supportedChannels: ALL_CHANNELS,
    supportedProfiles: ALL_PROFILES,
    defaultFallback: '',
    exampleValue: 'Grupo Pais Sub-15',
  },
  {
    key: 'profile_label',
    label: 'Tipo de perfil',
    description: 'Label do perfil do convidado',
    required: false,
    supportedChannels: ALL_CHANNELS,
    supportedProfiles: ALL_PROFILES,
    defaultFallback: '',
    exampleValue: 'Encarregado de Educação',
  },
  {
    key: 'context_label',
    label: 'Contexto',
    description: 'Label do contexto (Clube/Equipa)',
    required: false,
    supportedChannels: ALL_CHANNELS,
    supportedProfiles: ALL_PROFILES,
    defaultFallback: '',
    exampleValue: 'Equipa',
  },
];

/** Set of all allowed variable keys for fast lookup */
export const ALLOWED_VARIABLE_KEYS = new Set(VARIABLE_CATALOG.map(v => v.key));

/** Map for fast variable definition lookup */
export const VARIABLE_MAP = new Map(VARIABLE_CATALOG.map(v => [v.key, v]));

/** Default preview/test data built from catalog examples */
export const DEFAULT_PREVIEW_DATA: Record<string, string> = Object.fromEntries(
  VARIABLE_CATALOG.map(v => [v.key, v.exampleValue])
);

/** Get required variables for a given channel */
export function getRequiredVariables(channel?: DeliveryChannel, profile?: ProfileType): string[] {
  return VARIABLE_CATALOG
    .filter(v => {
      if (!v.required) return false;
      if (channel && !v.supportedChannels.includes(channel)) return false;
      if (profile && !v.supportedProfiles.includes(profile)) return false;
      return true;
    })
    .map(v => v.key);
}

/** Get fallback value for a variable */
export function getFallback(key: string): string | undefined {
  return VARIABLE_MAP.get(key)?.defaultFallback;
}
