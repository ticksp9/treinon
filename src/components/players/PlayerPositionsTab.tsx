import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target } from 'lucide-react';
import {
  getPlayerPositionMinutesAllTime,
  getPlayerPositionMinutesBySeason,
  type PositionStatsResult,
} from '@/lib/player-position-stats';
import { roleLabel } from '@/lib/tactical-formations';
import { useSelectedSeasonId } from '@/hooks/useSeasonContext';

interface Props {
  playerId: string;
  declaredPosition?: string | null;
  secondaryPositions?: string[] | null;
}

export function PlayerPositionsTab({ playerId, declaredPosition, secondaryPositions }: Props) {
  const selectedSeasonId = useSelectedSeasonId();

  const [seasonStats, setSeasonStats] = useState<PositionStatsResult | null>(null);
  const [allTimeStats, setAllTimeStats] = useState<PositionStatsResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [s, all] = await Promise.all([
          selectedSeasonId ? getPlayerPositionMinutesBySeason(playerId, selectedSeasonId) : Promise.resolve(null),
          selectedSeasonId ? Promise.resolve(null) : getPlayerPositionMinutesAllTime(playerId),
        ]);
        if (cancelled) return;
        setSeasonStats(s);
        setAllTimeStats(all);
      } catch (err) {
        if (import.meta.env.DEV) console.error('[PlayerDetail] erro na tab Posições:', err);
        if (!cancelled) { setSeasonStats(null); setAllTimeStats(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [playerId, selectedSeasonId]);

  if (loading) {
    return <Card><CardContent className="h-32 animate-pulse" /></Card>;
  }

  const hasAnyData =
    (seasonStats?.totalMinutes ?? 0) > 0 || (allTimeStats?.totalMinutes ?? 0) > 0;

  if (!hasAnyData) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <Target className="w-10 h-10 mx-auto mb-2" />
          <p>Ainda sem minutos por posição registados.</p>
          <p className="text-xs mt-1">
            Configure a formação tática no início do jogo para começar a registar.
          </p>
        </CardContent>
      </Card>
    );
  }

  const declared = declaredPosition ?? null;
  const predominantAllTime = (selectedSeasonId ? seasonStats : allTimeStats)?.predominantRole ?? null;
  const declaredVsStat =
    declared && predominantAllTime && declared !== predominantAllTime
      ? `Declarada: ${declared} · Real: ${roleLabel(predominantAllTime)}`
      : declared && predominantAllTime
        ? `Declarada e estatística coincidem (${roleLabel(predominantAllTime)})`
        : null;

  return (
    <div className="space-y-4">
      {selectedSeasonId && seasonStats && seasonStats.totalMinutes > 0 && (
        <StatsBlock
          title="Época selecionada"
          stats={seasonStats}
        />
      )}
      {!selectedSeasonId && allTimeStats && allTimeStats.totalMinutes > 0 && (
        <StatsBlock
          title="Todas as épocas"
          stats={allTimeStats}
        />
      )}
      {declaredVsStat && (
        <Card>
          <CardContent className="p-4 text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            {declaredVsStat}
            {secondaryPositions && secondaryPositions.length > 0 && (
              <span className="text-muted-foreground">
                · Secundárias: {secondaryPositions.join(', ')}
              </span>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatsBlock({ title, stats }: { title: string; stats: PositionStatsResult }) {
  const rolesSorted = Object.entries(stats?.byRole ?? {})
    .sort((a, b) => b[1] - a[1]);
  const formationsSorted = Object.entries(stats?.byFormation ?? {})
    .filter(([k]) => k !== 'unknown')
    .sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{title}</span>
          <Badge variant="secondary">{stats.totalMinutes}'</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {rolesSorted.map(([role, mins]) => {
            const pct = stats.totalMinutes > 0 ? Math.round((mins / stats.totalMinutes) * 100) : 0;
            return (
              <div key={role}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{roleLabel(role)}</span>
                  <span className="text-muted-foreground">{mins}' · {pct}%</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })}
        </div>
        {formationsSorted.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-1">Formações utilizadas</p>
            <div className="flex flex-wrap gap-1">
              {formationsSorted.map(([code, mins]) => (
                <Badge key={code} variant="outline" className="text-xs">
                  {code} · {mins}'
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
