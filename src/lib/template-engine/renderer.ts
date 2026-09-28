/**
 * Template Engine — Secure renderer
 * Resolves {{variables}} against provided data + catalog fallbacks.
 * Never uses eval. Never executes arbitrary code.
 */
import type { RenderResult } from './types';
import { parseTemplate } from './parser';
import { VARIABLE_MAP, ALLOWED_VARIABLE_KEYS } from './catalog';

export interface RenderOptions {
  /** If true, leave unknown placeholders as-is instead of removing them */
  preserveUnknown?: boolean;
  /** If true, strip unresolved optional variables instead of using fallback */
  stripUnresolved?: boolean;
}

/**
 * Render a template with the provided data map.
 * Only whitelisted variables are resolved. Unknown/unsafe placeholders are left as-is or stripped.
 */
export function renderTemplate(
  template: string,
  data: Record<string, string>,
  options: RenderOptions = {}
): RenderResult {
  const { preserveUnknown = true, stripUnresolved = false } = options;

  const parsed = parseTemplate(template);
  const variablesUsed: string[] = [];
  const variablesResolved: string[] = [];
  const variablesWithFallback: string[] = [];
  const missingRequired: string[] = [];
  const warnings: string[] = [];

  const renderedText = template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    // Not in whitelist — leave as-is or strip
    if (!ALLOWED_VARIABLE_KEYS.has(key)) {
      return preserveUnknown ? match : '';
    }

    variablesUsed.push(key);
    const def = VARIABLE_MAP.get(key);

    // Check if data provides a non-empty value
    const value = data[key];
    if (value !== undefined && value !== null && value !== '') {
      variablesResolved.push(key);
      return value;
    }

    // Try catalog fallback
    if (def?.defaultFallback !== undefined) {
      variablesWithFallback.push(key);
      return def.defaultFallback;
    }

    // Required but missing
    if (def?.required) {
      missingRequired.push(key);
      warnings.push(`Variável obrigatória sem valor: {{${key}}}`);
      return match; // Keep placeholder visible
    }

    // Optional without fallback
    if (stripUnresolved) return '';
    return '';
  });

  return {
    renderedText,
    variablesUsed: [...new Set(variablesUsed)],
    variablesResolved: [...new Set(variablesResolved)],
    variablesWithFallback: [...new Set(variablesWithFallback)],
    missingRequired: [...new Set(missingRequired)],
    warnings,
  };
}

/**
 * Render for preview — identical to production rendering but uses mock data.
 * Ensures preview matches what will actually be sent.
 */
export function previewTemplate(
  template: string,
  mockData: Record<string, string>
): RenderResult {
  return renderTemplate(template, mockData, { preserveUnknown: true });
}
