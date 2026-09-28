import { getCurrentSeasonName } from './constants';

/**
 * Centralized application configuration.
 * Business values that were previously hardcoded in UI components.
 */

// Default values
export const DEFAULTS = {
  season: getCurrentSeasonName(),
  sportType: 'football_11' as const,
  gender: 'male' as const,
  partDurationMinutes: 45,
  partsCount: 2,
} as const;

// Query stale times (ms)
export const QUERY_STALE_TIMES = {
  short: 1000 * 60, // 1 min
  medium: 1000 * 60 * 5, // 5 min (default)
  long: 1000 * 60 * 30, // 30 min
  static: 1000 * 60 * 60, // 1 hour
} as const;
