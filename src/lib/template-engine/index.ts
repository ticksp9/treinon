/**
 * Template Engine — Public API
 * Single import point for all template engine capabilities.
 */

// Types
export type {
  TemplateVariableDefinition,
  ParsedToken,
  ParseResult,
  ValidationResult,
  RenderResult,
  PreviewContext,
  SmsEstimate,
  DeliveryChannel,
  ProfileType,
} from './types';

// Catalog
export {
  VARIABLE_CATALOG,
  ALLOWED_VARIABLE_KEYS,
  VARIABLE_MAP,
  DEFAULT_PREVIEW_DATA,
  getRequiredVariables,
  getFallback,
} from './catalog';

// Parser
export { parseTemplate, collectTemplateVariables } from './parser';

// Validator
export { validateTemplate, hasBlockingErrors } from './validator';
export type { ValidateOptions } from './validator';

// Renderer
export { renderTemplate, previewTemplate } from './renderer';
export type { RenderOptions } from './renderer';

// Sanitizer
export { sanitizeForPreview, escapeHtml, estimateSmsLength } from './sanitizer';
