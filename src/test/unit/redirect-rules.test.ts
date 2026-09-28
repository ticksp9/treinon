/**
 * Unit tests — Redirect rules by profile type
 * Ensures correct routing after authentication/invite acceptance.
 */
import { describe, it, expect } from 'vitest';
import { PROFILE_REDIRECT_MAP, INVITE_PROFILES } from '../fixtures/invite-fixtures';

describe('Redirect Rules', () => {
  it('should redirect club accounts to /dashboard', () => {
    expect(PROFILE_REDIRECT_MAP.club).toBe('/dashboard');
  });

  it('should redirect individual_coach to /dashboard', () => {
    expect(PROFILE_REDIRECT_MAP.individual_coach).toBe('/dashboard');
  });

  it('should redirect guardian to /guardian', () => {
    expect(PROFILE_REDIRECT_MAP.guardian).toBe('/guardian');
  });

  it('should redirect player to /player', () => {
    expect(PROFILE_REDIRECT_MAP.player).toBe('/player');
  });

  it('should have all invite profiles defined', () => {
    expect(INVITE_PROFILES).toContain('guardian');
    expect(INVITE_PROFILES).toContain('player');
    expect(INVITE_PROFILES).toContain('coach');
    expect(INVITE_PROFILES).toContain('assistant_coach');
    expect(INVITE_PROFILES).toContain('staff');
  });
});
