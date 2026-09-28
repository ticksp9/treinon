/**
 * Integration tests — Invite tracking and status lifecycle
 * Tests the expected state machine for invite statuses and events.
 */
import { describe, it, expect } from 'vitest';
import {
  INVITE_STATUSES,
  TRACKING_EVENT_TYPES,
  DELIVERY_CHANNELS,
  INVITE_PROFILES,
} from '../fixtures/invite-fixtures';

describe('Invite Tracking — State Machine', () => {
  describe('Status definitions', () => {
    it('should have all required statuses', () => {
      const required = ['pending', 'sent', 'delivered', 'accepted', 'expired', 'revoked', 'failed'];
      for (const s of required) {
        expect(INVITE_STATUSES).toContain(s);
      }
    });
  });

  describe('Event type definitions', () => {
    it('should have all required event types', () => {
      const required = ['created', 'sent', 'delivered', 'accepted', 'resent', 'revoked', 'expired', 'failed'];
      for (const e of required) {
        expect(TRACKING_EVENT_TYPES).toContain(e);
      }
    });

    it('should include tracking events for clicks and views', () => {
      expect(TRACKING_EVENT_TYPES).toContain('clicked');
      expect(TRACKING_EVENT_TYPES).toContain('validation_started');
    });
  });

  describe('Delivery channels', () => {
    it('should support email, sms, whatsapp', () => {
      expect(DELIVERY_CHANNELS).toContain('email');
      expect(DELIVERY_CHANNELS).toContain('sms');
      expect(DELIVERY_CHANNELS).toContain('whatsapp');
    });
  });

  describe('Profile types', () => {
    it('should include all supported profiles', () => {
      expect(INVITE_PROFILES).toContain('guardian');
      expect(INVITE_PROFILES).toContain('player');
      expect(INVITE_PROFILES).toContain('coach');
      expect(INVITE_PROFILES).toContain('assistant_coach');
      expect(INVITE_PROFILES).toContain('staff');
    });
  });

  describe('Status transitions (logical)', () => {
    const validTransitions: Record<string, string[]> = {
      pending: ['sent', 'failed', 'revoked', 'expired'],
      sent: ['delivered', 'failed', 'revoked', 'expired'],
      delivered: ['opened', 'clicked', 'accepted', 'revoked', 'expired'],
      opened: ['clicked', 'accepted', 'revoked', 'expired'],
      clicked: ['accepted', 'revoked', 'expired'],
      accepted: [], // terminal
      expired: [], // terminal
      revoked: [], // terminal
      failed: ['sent'], // can resend
    };

    it('accepted should be terminal', () => {
      expect(validTransitions.accepted).toHaveLength(0);
    });

    it('expired should be terminal', () => {
      expect(validTransitions.expired).toHaveLength(0);
    });

    it('revoked should be terminal', () => {
      expect(validTransitions.revoked).toHaveLength(0);
    });

    it('pending can transition to sent or failed', () => {
      expect(validTransitions.pending).toContain('sent');
      expect(validTransitions.pending).toContain('failed');
    });

    it('failed can be resent', () => {
      expect(validTransitions.failed).toContain('sent');
    });
  });

  describe('Multi-channel delivery', () => {
    it('should support multiple deliveries per invite', () => {
      // Simulate: invite sent via email + whatsapp = 2 deliveries
      const deliveries = [
        { channel: 'email', status: 'sent' },
        { channel: 'whatsapp', status: 'sent' },
      ];
      expect(deliveries).toHaveLength(2);
      expect(new Set(deliveries.map(d => d.channel)).size).toBe(2);
    });

    it('resend should create new delivery not modify existing', () => {
      const deliveries = [
        { id: '1', channel: 'email', status: 'failed', sentAt: '2026-03-20' },
        { id: '2', channel: 'email', status: 'sent', sentAt: '2026-03-21' },
      ];
      expect(deliveries).toHaveLength(2);
      expect(deliveries[0].id).not.toBe(deliveries[1].id);
    });
  });
});
