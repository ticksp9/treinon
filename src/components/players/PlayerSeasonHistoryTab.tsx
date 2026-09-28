// Season-by-season history view backed by player_season_snapshots + live aggregates.
// This is the intentional exception to the "selected season only" rule: it stores and
// shows what the player did in EVERY season, one row per season.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import { fetchPlayerSeasonHistory, type SeasonHistoryRow } from '@/lib/player-season-history-service';

interface Props {
  playerId: string;
  canEdit?: boolean;
}

export function PlayerSeasonHistoryTab({ playerId }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: seasons = [], isLoading } = useQuery({
    queryKey: ['player-season-history', playerId],
    queryFn: async () => {
      try {
        return await fetchPlayerSeasonHistory(playerId);
      } catch (e) {
        if (import.meta.env.DEV) console.error('[PlayerDetail] erro na tab Histórico Época:', e);
        return [] as SeasonHistoryRow[];
      }
    },
  });

  if (isLoading) {
    return <Card><CardContent className="h-32 animate-pulse" /></Card>;
  }

  if (seasons.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <History className="w-10 h-10 mx-auto mb-2" />
          <p>Sem histórico para mostrar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Histórico por Época</h3>
      {seasons.map((s) => {
        const key = s.seasonId || s.seasonLabel;
        const open = expanded === key;
        return (
          <Card key={key}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  Época {s.seasonLabel}
                  {s.teamName && <Badge variant="outline">{s.teamName}</Badge>}
                  {s.ageGroup && <Badge variant="outline">{s.ageGroup}</Badge>}
                  {s.predominantRole && <Badge variant="secondary">{s.predominantRole}</Badge>}
                  <Badge variant={s.source === 'snapshot' ? 'default' : 'outline'}>
                    {s.seasonStatus === 'archived'
                      ? 'Arquivada'
                      : s.seasonStatus === 'closed'
                        ? 'Fechada'
                        : s.source === 'snapshot'
                          ? 'Registo fechado'
                          : 'Em curso'}
                  </Badge>
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setExpanded(open ? null : key)}>
                  {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Stat label="Jogos" value={s.games} />
                <Stat label="Minutos" value={`${s.minutes}'`} />
                <Stat label="Titularidades" value={s.starts} />
                <Stat label="Treinos" value={`${s.trainingsPresent}/${s.trainingsTotal}`} />
              </div>
              {open && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm pt-2 border-t">
                  <Stat label="Presença" value={`${s.attendanceRate}%`} />
                  <Stat label="Golos" value={s.goals} />
                  <Stat label="Assistências" value={s.assists} />
                  <Stat label="Cartões" value={`${s.yellowCards}A / ${s.redCards}V`} />
                  <Stat
                    label="Avaliação média"
                    value={s.avgOverall != null ? `${s.avgOverall}/10` : '—'}
                  />
                  <Stat label="Nº avaliações" value={s.evaluationsCount} />
                  {Object.keys(s.minutesByRole).length > 0 && (
                    <div className="col-span-2 md:col-span-4">
                      <p className="text-xs text-muted-foreground mb-1">Minutos por posição</p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(s.minutesByRole).map(([role, mins]) => (
                          <Badge key={role} variant="outline">{role}: {mins}'</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {s.strengths && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Pontos fortes</p>
                      <p className="text-sm whitespace-pre-wrap">{s.strengths}</p>
                    </div>
                  )}
                  {s.improvements && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">A melhorar</p>
                      <p className="text-sm whitespace-pre-wrap">{s.improvements}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
