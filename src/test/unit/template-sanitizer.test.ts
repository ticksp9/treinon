/**
 * Unit tests — Template Sanitizer
 * Tests HTML sanitization, escape, and SMS estimation.
 */
import { describe, it, expect } from 'vitest';
import { sanitizeForPreview, escapeHtml, estimateSmsLength } from '@/lib/template-engine/sanitizer';

describe('Template Sanitizer', () => {
  describe('sanitizeForPreview', () => {
    it('should remove script tags', () => {
      expect(sanitizeForPreview('<script>alert(1)</script>')).not.toContain('<script');
    });

    it('should remove iframe tags', () => {
      expect(sanitizeForPreview('<iframe src="evil.com"></iframe>')).not.toContain('<iframe');
    });

    it('should neutralize javascript: URLs', () => {
      const result = sanitizeForPreview('javascript:alert(1)');
      expect(result).not.toContain('javascript:');
    });

    it('should block inline event handlers', () => {
      const result = sanitizeForPreview('<div onclick="alert(1)">test</div>');
      expect(result).not.toContain('onclick=');
    });

    it('should preserve safe text', () => {
      expect(sanitizeForPreview('Hello world')).toBe('Hello world');
    });

    it('should block data: URLs', () => {
      const result = sanitizeForPreview('data:text/html,<script>alert(1)</script>');
      expect(result).not.toContain('data:');
    });
  });

  describe('escapeHtml', () => {
    it('should escape angle brackets', () => {
      expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
    });

    it('should escape ampersands', () => {
      expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('should escape quotes', () => {
      expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("it's")).toBe("it&#39;s");
    });

    it('should leave plain text intact', () => {
      expect(escapeHtml('hello')).toBe('hello');
    });
  });

  describe('estimateSmsLength', () => {
    it('should count single segment for short message', () => {
      expect(estimateSmsLength('Hello').segments).toBe(1);
    });

    it('should count single segment for 160 chars', () => {
      expect(estimateSmsLength('A'.repeat(160)).segments).toBe(1);
    });

    it('should count multiple segments for long message', () => {
      expect(estimateSmsLength('A'.repeat(161)).segments).toBe(2);
    });

    it('should calculate segments correctly at boundaries', () => {
      expect(estimateSmsLength('A'.repeat(306)).segments).toBe(2);
      expect(estimateSmsLength('A'.repeat(307)).segments).toBe(3);
    });

    it('should return 0 chars for empty string', () => {
      const result = estimateSmsLength('');
      expect(result.chars).toBe(0);
      expect(result.segments).toBe(1);
    });
  });
});
