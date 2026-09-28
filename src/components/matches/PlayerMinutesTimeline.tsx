import { Badge } from '@/components/ui/badge';
import type { PlayerMinutesSummary } from '@/lib/match-playing-time-engine';

interface Props {
  summary: PlayerMinutesSummary;
  showRegulation?: boolean;
  className?: string;
}

/**
 * Compact, presentational view of a player's minute timeline.
 * Example: "0'–14' + 31'–51' = 34' real (30' regulamentar)"
 */
export function PlayerMinutesTimeline({ summary, showRegulation = true, className }: Props) {
  if (summary.intervals.length === 0) {
    return <span className={className}>0'</span>;
  }

  const segments = summary.intervals.map(
    iv => `${iv.start}'–${iv.end}'`,
  );

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {segments.map((s, idx) => (
          <span key={idx} className="font-mono">
            {idx > 0 ? '+ ' : ''}
            {s}
          </span>
        ))}
        <span className="font-semibold text-foreground">
          = {summary.totalRealMinutes}'
        </span>
        {showRegulation &&
          summary.totalRegulationMinutes !== summary.totalRealMinutes && (
            <Badge variant="outline" className="ml-1 text-[10px]">
              reg {summary.totalRegulationMinutes}'
            </Badge>
          )}
      </div>
    </div>
  );
}
