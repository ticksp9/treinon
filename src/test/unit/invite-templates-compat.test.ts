/**
 * Unit tests — Backward-compatible invite-templates API
 */
import { describe, it, expect } from 'vitest';
import {
  renderTemplate,
  validateTemplateContext,
  PROFILE_LABELS,
  CHANNEL_LABELS,
  TEMPLATE_VARIABLES,
} from '@/lib/invite-templates';

describe('invite-templates backward compatibility', () => {
  it('should render template with string result', () => {
    const result = renderTemplate('Hello {{recipient_name}}', { recipient_name: 'Ana' });
    expect(result).toBe('Hello Ana');
  });

  it('should validate missing required context', () => {
    const missing = validateTemplateContext({});
    expect(missing).toContain('recipient_name');
    expect(missing).toContain('invite_link');
  });

  it('should return empty for complete context', () => {
    const missing = validateTemplateContext({ recipient_name: 'Ana', invite_link: 'https://x.com' });
    expect(missing).toHaveLength(0);
  });

  it('should export PROFILE_LABELS for all profiles', () => {
    expect(PROFILE_LABELS.guardian).toBeTruthy();
    expect(PROFILE_LABELS.player).toBeTruthy();
    expect(PROFILE_LABELS.coach).toBeTruthy();
    expect(PROFILE_LABELS.assistant_coach).toBeTruthy();
    expect(PROFILE_LABELS.staff).toBeTruthy();
  });

  it('should export CHANNEL_LABELS for all channels', () => {
    expect(CHANNEL_LABELS.email).toBeTruthy();
    expect(CHANNEL_LABELS.sms).toBeTruthy();
    expect(CHANNEL_LABELS.whatsapp).toBeTruthy();
  });

  it('should export TEMPLATE_VARIABLES as array', () => {
    expect(Array.isArray(TEMPLATE_VARIABLES)).toBe(true);
    expect(TEMPLATE_VARIABLES.length).toBeGreaterThanOrEqual(15);
  });
});
