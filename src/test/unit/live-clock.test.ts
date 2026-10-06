import { describe, it, expect, beforeEach } from 'vitest';
import { clearLiveClock, formatClock, liveClockSeconds, readLiveClock, writeLiveClock, LIVE_CLOCK_MAX_AGE_MS, type LiveClockSnapshot } from '@/lib/live-clock';

const T0 = 1_800_000_000_000;
const snap = (p: Partial<LiveClockSnapshot> = {}): LiveClockSnapshot => ({
  matchId: 'm1', teamId: 't1', phase: 'playing', currentPart: 2, partElapsedSeconds: [900, 0],
  partStartedAtMs: T0, isTimerRunning: true, lastSavedAt: T0, ...p,
});

describe('live clock snapshot', () => {
  beforeEach(() => localStorage.clear());

  it('keeps counting from the start of the part while the coach is elsewhere', () => {
    // saved at 0s, read 7 min 5 s later (e.g. coming back from the tactical board)
    expect(liveClockSeconds(snap(), T0 + 425_000)).toBe(425);
    expect(formatClock(425)).toBe('07:05');
  });

  it('a paused clock stays where it was paused', () => {
    const s = snap({ isTimerRunning: false, partStartedAtMs: null, partElapsedSeconds: [900, 312] });
    expect(liveClockSeconds(s, T0 + 600_000)).toBe(312);
  });

  it('interval shows the time of the part that ended', () => {
    const s = snap({ phase: 'interval', currentPart: 1, isTimerRunning: false, partStartedAtMs: null, partElapsedSeconds: [905] });
    expect(liveClockSeconds(s, T0 + 60_000)).toBe(905);
  });

  it('is read back only while the match is really going on', () => {
    writeLiveClock(snap());
    expect(readLiveClock(T0 + 1000)?.matchId).toBe('m1');
    expect(readLiveClock(T0 + LIVE_CLOCK_MAX_AGE_MS + 1)).toBeNull();
    writeLiveClock(snap({ phase: 'finished' }));
    expect(readLiveClock(T0 + 1000)).toBeNull();
  });

  it('clearing another match does not remove this one', () => {
    writeLiveClock(snap());
    clearLiveClock('other');
    expect(readLiveClock(T0 + 1000)).not.toBeNull();
    clearLiveClock('m1');
    expect(readLiveClock(T0 + 1000)).toBeNull();
  });
});
