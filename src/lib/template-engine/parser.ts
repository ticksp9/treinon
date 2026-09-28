/**
 * Template Engine — Secure parser
 * Tokenises {{variable}} placeholders with strict safety checks.
 */
import type { ParsedToken, ParseResult } from './types';
import { ALLOWED_VARIABLE_KEYS } from './catalog';

// Dangerous patterns that must never be allowed
const UNSAFE_PATTERNS = [
  /^(window|document|process|global|globalThis|self|parent|top|frames)$/i,
  /^(eval|Function|constructor|__proto__|prototype)$/i,
  /\./,   // No dotted access (e.g. window.location)
  /\[/,   // No bracket access
  /\(/,   // No function calls
];

function isSafeKey(key: string): boolean {
  if (!key || key.length > 50) return false;
  // Must be simple alphanumeric + underscore
  if (!/^[a-z][a-z0-9_]*$/i.test(key)) return false;
  return !UNSAFE_PATTERNS.some(p => p.test(key));
}

/**
 * Parse a template string and extract all placeholder tokens.
 */
export function parseTemplate(template: string): ParseResult {
  const tokens: ParsedToken[] = [];
  const variablesFound: string[] = [];
  const invalidTokens: ParsedToken[] = [];
  const unsafeTokens: ParsedToken[] = [];

  // Match all {{...}} patterns including malformed ones
  const regex = /\{\{([^}]*)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) !== null) {
    const raw = match[0];
    const innerContent = match[1].trim();
    const startIndex = match.index;
    const endIndex = startIndex + raw.length;

    const safe = isSafeKey(innerContent);
    const valid = safe && ALLOWED_VARIABLE_KEYS.has(innerContent);

    const token: ParsedToken = {
      raw,
      variableKey: innerContent,
      startIndex,
      endIndex,
      isValid: valid,
      isSafe: safe,
    };

    if (!safe) {
      token.errorMessage = `Placeholder inseguro: ${raw}`;
      unsafeTokens.push(token);
    } else if (!valid) {
      token.errorMessage = `Variável desconhecida: {{${innerContent}}}`;
      invalidTokens.push(token);
    } else {
      if (!variablesFound.includes(innerContent)) {
        variablesFound.push(innerContent);
      }
    }

    tokens.push(token);
  }

  // Also detect broken/malformed placeholders: {{ without closing }}
  const brokenRegex = /\{\{[^}]*$/gm;
  let brokenMatch: RegExpExecArray | null;
  while ((brokenMatch = brokenRegex.exec(template)) !== null) {
    const broken: ParsedToken = {
      raw: brokenMatch[0],
      variableKey: '',
      startIndex: brokenMatch.index,
      endIndex: brokenMatch.index + brokenMatch[0].length,
      isValid: false,
      isSafe: false,
      errorMessage: 'Placeholder com sintaxe quebrada ({{ sem fecho }})',
    };
    invalidTokens.push(broken);
    tokens.push(broken);
  }

  return {
    tokens,
    variablesFound,
    invalidTokens,
    unsafeTokens,
    normalizedTemplate: template,
  };
}

/**
 * Extract just variable names from a template (convenience).
 */
export function collectTemplateVariables(template: string): string[] {
  return parseTemplate(template).variablesFound;
}
