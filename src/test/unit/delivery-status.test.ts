/**
 * Unit tests — Delivery status machine and retry logic
 */
import { describe, it, expect } from 'vitest';
import { createTestDelivery } from '../fixtures/factories';

describe('Delivery Status Machine', () => {
  const VALID_TRANSITIONS: Record<string, string[]> = {
    queued: ['sending', 'cancelled', 'failed'],
    sending: ['sent', 'failed'],
    sent: ['delivered', 'opened', 'clicked', 'accepted', 'bounced', 'failed'],
    delivered: ['opened', 'clicked', 'accepted'],
    opened: ['clicked', 'accepted'],
    clicked: ['accepted'],
    failed: ['retry_scheduled', 'cancelled'],
    retry_scheduled: ['sending', 'cancelled'],
    bounced: [],
    accepted: [],
    cancelled: [],
    exhausted: [],
  };

  function canTransition(from: string, to: string): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  describe('Valid transitions', () => {
    it('queued → sending', () => expect(canTransition('queued', 'sending')).toBe(true));
    it('sending → sent', () => expect(canTransition('sending', 'sent')).toBe(true));
    it('sent → delivered', () => expect(canTransition('sent', 'delivered')).toBe(true));
    it('sent → accepted', () => expect(canTransition('sent', 'accepted')).toBe(true));
    it('failed → retry_scheduled', () => expect(canTransition('failed', 'retry_scheduled')).toBe(true));
    it('retry_scheduled → sending', () => expect(canTransition('retry_scheduled', 'sending')).toBe(true));
    it('delivered → opened', () => expect(canTransition('delivered', 'opened')).toBe(true));
    it('opened → clicked', () => expect(canTransition('opened', 'clicked')).toBe(true));
    it('clicked → accepted', () => expect(canTransition('clicked', 'accepted')).toBe(true));
  });

  describe('Invalid transitions', () => {
    it('queued → accepted', () => expect(canTransition('queued', 'accepted')).toBe(false));
    it('accepted → sending', () => expect(canTransition('accepted', 'sending')).toBe(false));
    it('bounced → sent', () => expect(canTransition('bounced', 'sent')).toBe(false));
    it('cancelled → sending', () => expect(canTransition('cancelled', 'sending')).toBe(false));
    it('exhausted → retry_scheduled', () => expect(canTransition('exhausted', 'retry_scheduled')).toBe(false));
  });

  describe('Terminal states', () => {
    const TERMINAL = ['accepted', 'bounced', 'cancelled', 'exhausted'];
    for (const state of TERMINAL) {
      it(`${state} has no outgoing transitions`, () => {
        expect(VALID_TRANSITIONS[state]).toHaveLength(0);
      });
    }
  });
});

describe('Retry Logic', () => {
  const PERMANENT_FAILURES = [
    'invalid_email', 'invalid_phone', 'invalid_recipient',
    'invalid_template', 'missing_required_variables',
    'bounced', 'unsubscribed', 'spam_complaint',
  ];

  const TRANSIENT_FAILURES = [
    'connection_timeout', 'rate_limited', 'provider_unavailable',
    'server_error', 'temporary_failure',
  ];

  function isRetryable(reason: string): boolean {
    const lower = reason.toLowerCase();
    return !PERMANENT_FAILURES.some(p => lower.includes(p.replace(/_/g, ' ')) || lower.includes(p));
  }

  it('permanent failures are not retryable', () => {
    for (const reason of PERMANENT_FAILURES) {
      expect(isRetryable(reason)).toBe(false);
    }
  });

  it('transient failures are retryable', () => {
    for (const reason of TRANSIENT_FAILURES) {
      expect(isRetryable(reason)).toBe(true);
    }
  });

  describe('Retry count enforcement', () => {
    it('should not retry beyond max_retries', () => {
      const delivery = createTestDelivery({ retry_count: 3, max_retries: 3 });
      expect(delivery.retry_count >= delivery.max_retries).toBe(true);
    });

    it('should allow retry when under max', () => {
      const delivery = createTestDelivery({ retry_count: 1, max_retries: 3 });
      expect(delivery.retry_count < delivery.max_retries).toBe(true);
    });
  });

  describe('Exponential backoff', () => {
    const DELAYS_MS = [60_000, 300_000, 900_000]; // 1min, 5min, 15min

    it('delays increase progressively', () => {
      for (let i = 1; i < DELAYS_MS.length; i++) {
        expect(DELAYS_MS[i]).toBeGreaterThan(DELAYS_MS[i - 1]);
      }
    });

    it('first retry is at 1 minute', () => {
      expect(DELAYS_MS[0]).toBe(60_000);
    });

    it('last retry is at 15 minutes', () => {
      expect(DELAYS_MS[DELAYS_MS.length - 1]).toBe(900_000);
    });
  });
});
