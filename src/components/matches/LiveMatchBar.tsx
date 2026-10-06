/**
 * "Jogo a decorrer" bar shown on every other screen (tactical board, players…):
 * the clock keeps counting and one tap brings the coach back to the match.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Timer } from 'lucide-react';
import { formatClock, liveClockSeconds, readLiveClock, type LiveClockSnapshot } from '@/lib/live-clock';

export function LiveMatchBar() {
  const [snap, setSnap] = useState<LiveClockSnapshot | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const read = () => {
      // hidden while the match screen itself is open
      setSnap(window.__treinonLiveMatch ? null : readLiveClock());
      setTick((t) => t + 1);
    };
    read();
    const id = setInterval(read, 1000);
    document.addEventListener('visibilitychange', read);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', read); };
  }, []);

  if (!snap) return null;
  const paused = snap.phase === 'playing' && !snap.isTimerRunning;
  const label = snap.phase === 'interval' ? 'Intervalo' : `${snap.currentPart}.ª parte${paused ? ' · em pausa' : ''}`;

  return (
    <Link
      to={`/matches?teamId=${snap.teamId}&live=${snap.matchId}`}
      className="flex items-center gap-2 border-b border-accent/40 bg-accent/15 px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/25 sm:px-4"
    >
      <Timer className="h-4 w-4 shrink-0 text-accent" />
      <span className="truncate">Jogo a decorrer{snap.opponent ? ` vs ${snap.opponent}` : ''} · {label}</span>
      <span className="ml-auto font-mono text-base font-semibold tabular-nums">{formatClock(liveClockSeconds(snap))}</span>
      <span className="hidden items-center sm:flex">Voltar ao jogo<ChevronRight className="h-4 w-4" /></span>
      <ChevronRight className="h-4 w-4 sm:hidden" />
    </Link>
  );
}
