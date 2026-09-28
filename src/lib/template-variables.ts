/**
 * Backward-compatible re-export from the new template engine.
 * Existing imports of this module continue to work.
 */
export {
  VARIABLE_CATALOG as TEMPLATE_VARIABLE_CATALOG,
  DEFAULT_PREVIEW_DATA,
  ALLOWED_VARIABLE_KEYS,
  estimateSmsLength,
} from './template-engine';

export type { TemplateVariableDefinition as TemplateVariableInfo } from './template-engine';

import { validateTemplate as engineValidate } from './template-engine';
import { renderTemplate as engineRender } from './template-engine';
import { getRequiredVariables } from './template-engine';

// Keep the old API signatures for backward compat
export function validateTemplate(template: string): { errors: string[]; warnings: string[] } {
  const result = engineValidate(template);
  return { errors: result.errors, warnings: result.warnings };
}

export function renderPreview(template: string, data: Record<string, string>): string {
  const result = engineRender(template, data);
  return result.renderedText;
}

export function REQUIRED_VARIABLES_FN(): string[] {
  return getRequiredVariables();
}
