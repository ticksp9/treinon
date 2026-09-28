/**
 * Read-only "Posições e minutos" block for the match report.
 * Uses useMatchPositions; never computes minutes locally.
 */
import { useMatchPositions } from '@/hooks/useMatchPositions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { roleLabel } from '@/lib/tactical-formations';
import { Target } from 'lucide-react';

interface Props {
  matchId: string;
  matchEndMinuteAbs?: number;
  /** id → display name map for players who appear in the report */
  playerNames: Map<string, string>;
}

// Stable color palette for roles (HSL hue offset)
function roleColor(role: string): string {
  let hash = 0;
  for (let i = 0; i < role.length; i++) hash = (hash * 31 + role.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

export function MatchPositionsBlock({ matchId, matchEndMinuteAbs = 90, playerNames }: Props) {
  const { data, isLoading } = useMatchPositions({ matchId, matchEndMinuteAbs });

  if (isLoading) {
    return <Card><CardContent className="h-32 animate-pulse" /></Card>;
  }

  if (!data || data.formations.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          <Target className="w-8 h-8 mx-auto mb-2 opacity-60" />
          Nenhuma formação tática registada para este jogo.
        </CardContent>
      </Card>
    );
  }

  const playerIds = Array.from(data.intervalsByPlayer.keys());

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="w-4 h-4" /> Posições e minutos
          </span>
          <div className="flex gap-1">
            {data.formations.map(f => (
              <Badge key={f.id} variant="outline" className="text-xs">
                {f.formation_code}
                {f.ends_at_minute_abs != null && ` · ${f.starts_at_minute_abs}'–${f.ends_at_minute_abs}'`}
              </Badge>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-1.5 font-medium">Jogador</th>
                <th className="text-right py-1.5 font-medium">Total</th>
                <th className="text-left py-1.5 font-medium pl-3">Minutos por posição</th>
              </tr>
            </thead>
            <tbody>
              {playerIds.map(pid => {
                const roleMap = data.minutesByPlayerByRole.get(pid) ?? new Map<string, number>();
                const total = Array.from(roleMap.values()).reduce((s, v) => s + v, 0);
                const rolesSorted = Array.from(roleMap.entries()).sort((a, b) => b[1] - a[1]);
                return (
                  <tr key={pid} className="border-b last:border-0">
                    <td className="py-2 font-medium">{playerNames.get(pid) ?? pid.slice(0, 8)}</td>
                    <td className="py-2 text-right tabular-nums">{total}'</td>
                    <td className="py-2 pl-3">
                      <div className="flex flex-wrap gap-1">
                        {rolesSorted.map(([role, mins]) => (
                          <Badge
                            key={role}
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: roleColor(role), color: roleColor(role) }}
                          >
                            {roleLabel(role)} · {mins}'
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Timeline */}
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Cronologia de posições</p>
          {playerIds.map(pid => {
            const intervals = data.intervalsByPlayer.get(pid) ?? [];
            return (
              <div key={pid} className="flex items-center gap-2">
                <div className="w-32 truncate text-xs">{playerNames.get(pid) ?? pid.slice(0, 8)}</div>
                <div className="flex-1 relative h-4 bg-muted rounded overflow-hidden">
                  {intervals.map((iv, i) => {
                    const start = iv.startMinuteAbs;
                    const end = iv.endMinuteAbs ?? matchEndMinuteAbs;
                    const left = (start / matchEndMinuteAbs) * 100;
                    const width = ((end - start) / matchEndMinuteAbs) * 100;
                    return (
                      <div
                        key={i}
                        className="absolute top-0 bottom-0"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          background: roleColor(iv.role ?? 'unknown'),
                        }}
                        title={`${roleLabel(iv.role)} · ${start}'–${end}'`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
