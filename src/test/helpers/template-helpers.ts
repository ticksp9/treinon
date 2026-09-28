/**
 * Test helpers for template engine tests.
 */
import { renderTemplate, validateTemplate, parseTemplate } from '@/lib/template-engine';
import type { DeliveryChannel, ProfileType } from '@/lib/template-engine';
import { MOCK_TEMPLATE_DATA } from '../fixtures/invite-fixtures';

export function renderForTest(template: string, overrides: Record<string, string> = {}) {
  return renderTemplate(template, { ...MOCK_TEMPLATE_DATA, ...overrides });
}

export function validateForTest(
  template: string,
  channel?: DeliveryChannel,
  profileType?: ProfileType
) {
  return validateTemplate(template, { channel, profileType });
}

export function parseForTest(template: string) {
  return parseTemplate(template);
}

export function assertValidTemplate(template: string, channel?: DeliveryChannel) {
  const result = validateTemplate(template, { channel });
  if (!result.isValid) {
    throw new Error(`Expected valid template but got errors: ${result.errors.join(', ')}`);
  }
  return result;
}

export function assertInvalidTemplate(template: string, channel?: DeliveryChannel) {
  const result = validateTemplate(template, { channel });
  if (result.isValid) {
    throw new Error('Expected invalid template but validation passed');
  }
  return result;
}
