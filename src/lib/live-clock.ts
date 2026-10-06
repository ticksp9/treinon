/**
 * Small synchronous copy of the live match clock (localStorage).
 * The full state lives in IndexedDB, but that write is async and can be lost when
 * the coach leaves the match screen (e.g. to open the tactical board) or iOS
 * suspends the app. The clock is always derived from the timestamp of when the
 * part started, never from a counter, so it keeps counting wherever the coach is.
 */
export interface LiveClockSnapshot {
  matchId: string;
  teamId: string;
  opponent?: string;
  phase: 'setup' | 'playing' | 'interval' | 'finished';
  currentPart: number;
  partElapsedSeconds: number[];
  partStartedAtMs: number | null;
  isTimerRunning: boolean;
  lastSavedAt: number;
}

const KEY = 'treinon_live_clock';
/** a match left open longer than this is not "a decorrer" any more */
export const LIVE_CLOCK_MAX_AGE_MS = 4 * 60 * 60 * 1000;

export function writeLiveClock(s: LiveClockSnapshot): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode / full */ }
}

export function readLiveClock(now = Date.now()): LiveClockSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as LiveClockSnapshot;
    if (!s || typeof s.matchId !== 'string' || !isLiveClockActive(s, now)) return null;
    return s;
  } catch { return null; }
}

export function clearLiveClock(matchId?: string): void {
  try {
    if (matchId) {
      const raw = localStorage.getItem(KEY);
      if (raw && (JSON.parse(raw) as LiveClockSnapshot)?.matchId !== matchId) return;
    }
    localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

export function isLiveClockActive(s: Pick<LiveClockSnapshot, 'phase' | 'currentPart' | 'lastSavedAt'>, now = Date.now()): boolean {
  return (s.phase === 'playing' || s.phase === 'interval') && s.currentPart > 0 && now - s.lastSavedAt < LIVE_CLOCK_MAX_AGE_MS;
}

/** Seconds of the current part right now (running: from the start timestamp; paused: what was saved). */
export function liveClockSeconds(s: LiveClockSnapshot, now = Date.now()): number {
  if (s.phase === 'playing' && s.isTimerRunning && s.partStartedAtMs) return Math.max(0, Math.floor((now - s.partStartedAtMs) / 1000));
  return Math.max(0, Math.floor(s.partElapsedSeconds[s.currentPart - 1] || 0));
}

export const formatClock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
