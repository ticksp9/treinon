/**
 * Template Engine — Sanitizer
 * Prevents HTML/script injection in previews.
 */

const DANGEROUS_TAGS = /(<\s*\/?\s*(script|iframe|object|embed|form|meta|link|style|base|applet|svg\b[^>]*on\w+)[^>]*>)/gi;
const DANGEROUS_ATTRS = /\b(on\w+|formaction|srcdoc)\s*=/gi;
const DANGEROUS_URLS = /(javascript|data|vbscript)\s*:/gi;

/**
 * Sanitize rendered text for safe HTML preview display.
 * Strips dangerous tags, attributes, and URL schemes.
 */
export function sanitizeForPreview(text: string): string {
  let sanitized = text;
  // Remove dangerous tags entirely
  sanitized = sanitized.replace(DANGEROUS_TAGS, '');
  // Remove dangerous attributes
  sanitized = sanitized.replace(DANGEROUS_ATTRS, 'data-blocked=');
  // Neutralize dangerous URL schemes
  sanitized = sanitized.replace(DANGEROUS_URLS, 'blocked:');
  return sanitized;
}

/**
 * Escape text for safe rendering as plain text (no HTML interpretation).
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Estimate SMS character count and segments.
 */
export function estimateSmsLength(text: string): { chars: number; segments: number } {
  const chars = text.length;
  const segments = chars <= 160 ? 1 : Math.ceil(chars / 153);
  return { chars, segments };
}
