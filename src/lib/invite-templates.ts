/**
 * Backward-compatible re-export from the new template engine.
 * Existing imports of this module continue to work.
 */
export { ALLOWED_VARIABLE_KEYS as TEMPLATE_VARIABLES_SET } from './template-engine';
export { collectTemplateVariables as extractVariables } from './template-engine';

import { VARIABLE_CATALOG } from './template-engine';
import { renderTemplate as engineRender } from './template-engine';
import { validateTemplate as engineValidate } from './template-engine';

export const TEMPLATE_VARIABLES = VARIABLE_CATALOG.map(v => v.key) as readonly string[];
export type TemplateVariable = string;
export type TemplateContext = Partial<Record<string, string>>;

/**
 * Render template — returns plain string for backward compatibility.
 */
export function renderTemplate(template: string, context: Record<string, string>): string {
  return engineRender(template, context).renderedText;
}

/**
 * Validate template context — returns missing required variable keys.
 */
export function validateTemplateContext(context: Record<string, string>): string[] {
  const required = ['recipient_name', 'invite_link'];
  return required.filter(v => !context[v] || context[v].trim() === '');
}

export const PROFILE_LABELS: Record<string, string> = {
  guardian: 'Encarregado de Educação',
  player: 'Atleta',
  coach: 'Treinador',
  assistant_coach: 'Treinador Adjunto',
  staff: 'Staff',
};

export const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};
