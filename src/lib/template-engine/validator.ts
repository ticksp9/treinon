/**
 * Template Engine — Validator
 * Validates templates against catalog, channel, and profile rules.
 */
import type { ValidationResult, DeliveryChannel, ProfileType } from './types';
import { parseTemplate } from './parser';
import { VARIABLE_MAP, getRequiredVariables } from './catalog';

export interface ValidateOptions {
  channel?: DeliveryChannel;
  profileType?: ProfileType;
  /** Additional context variables available at render time */
  availableData?: Record<string, string>;
}

/**
 * Full template validation.
 */
export function validateTemplate(
  template: string,
  options: ValidateOptions = {}
): ValidationResult {
  const { channel, profileType, availableData } = options;

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!template || !template.trim()) {
    return {
      isValid: false,
      errors: ['Template está vazio'],
      warnings: [],
      variablesFound: [],
      unknownVariables: [],
      missingRequiredVariables: [],
      optionalWithoutValue: [],
      invalidSyntaxTokens: [],
    };
  }

  const parsed = parseTemplate(template);

  // Collect issues from parser
  const unknownVariables: string[] = [];
  const invalidSyntaxTokens: string[] = [];

  for (const token of parsed.unsafeTokens) {
    errors.push(token.errorMessage || `Placeholder inseguro: ${token.raw}`);
    invalidSyntaxTokens.push(token.raw);
  }

  for (const token of parsed.invalidTokens) {
    if (!token.isSafe) continue; // already handled above
    unknownVariables.push(token.variableKey);
    errors.push(token.errorMessage || `Variável desconhecida: {{${token.variableKey}}}`);
  }

  // Check channel compatibility
  if (channel) {
    for (const varKey of parsed.variablesFound) {
      const def = VARIABLE_MAP.get(varKey);
      if (def && !def.supportedChannels.includes(channel)) {
        warnings.push(`{{${varKey}}} não é suportada no canal ${channel.toUpperCase()}`);
      }
    }
  }

  // Check profile compatibility
  if (profileType) {
    for (const varKey of parsed.variablesFound) {
      const def = VARIABLE_MAP.get(varKey);
      if (def && !def.supportedProfiles.includes(profileType)) {
        warnings.push(`{{${varKey}}} não é suportada para o perfil ${profileType}`);
      }
    }
  }

  // Check required variables
  const requiredVars = getRequiredVariables(channel, profileType);
  const missingRequiredVariables: string[] = [];

  for (const req of requiredVars) {
    if (!parsed.variablesFound.includes(req)) {
      // invite_link not required if invite_code is present
      if (req === 'invite_link' && parsed.variablesFound.includes('invite_code')) continue;
      missingRequiredVariables.push(req);
      if (req === 'recipient_name') {
        warnings.push('Variável recomendada ausente: {{recipient_name}}');
      } else {
        warnings.push(`Variável importante ausente: {{${req}}}`);
      }
    }
  }

  // Check optional variables without data
  const optionalWithoutValue: string[] = [];
  if (availableData) {
    for (const varKey of parsed.variablesFound) {
      const def = VARIABLE_MAP.get(varKey);
      if (def && !def.required && !availableData[varKey] && !def.defaultFallback) {
        optionalWithoutValue.push(varKey);
      }
    }
  }

  // SMS length warning
  if (channel === 'sms' && template.length > 320) {
    warnings.push('Template SMS parece longo — pode resultar em múltiplos segmentos');
  }

  // Subject check for email
  if (channel === 'email') {
    // Just a warning — subject is separate from body
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    variablesFound: parsed.variablesFound,
    unknownVariables,
    missingRequiredVariables,
    optionalWithoutValue,
    invalidSyntaxTokens,
  };
}

/**
 * Quick check if a template has blocking errors (for publish/send gates).
 */
export function hasBlockingErrors(template: string, options?: ValidateOptions): boolean {
  return !validateTemplate(template, options).isValid;
}
