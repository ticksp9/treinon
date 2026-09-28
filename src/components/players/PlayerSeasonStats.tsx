import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Clock, Target, Shield, Users, Calendar } from 'lucide-react';

interface SeasonStats {
  minutesPlayed: number;
  goals: number;
  assists: number;
  goalsConceded: number;
  matchesPlayed: number;
  matchesStarted: number;
  trainingSessions: number;
  trainingAttendance: number;
  yellowCards: number;
  redCards: number;
}

interface PlayerSeasonStatsProps {
  stats?: Partial<SeasonStats> | null;
  isGoalkeeper: boolean;
}

const EMPTY_STATS: SeasonStats = {
  minutesPlayed: 0, goals: 0, assists: 0, goalsConceded: 0, matchesPlayed: 0,
  matchesStarted: 0, trainingSessions: 0, trainingAttendance: 0, yellowCards: 0, redCards: 0,
};

export function PlayerSeasonStats({ stats: rawStats, isGoalkeeper }: PlayerSeasonStatsProps) {
  const stats: SeasonStats = { ...EMPTY_STATS, ...(rawStats ?? {}) };
  const attendancePercentage = stats.trainingSessions > 0
    ? Math.round((stats.trainingAttendance / stats.trainingSessions) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.minutesPlayed}'</p>
                <p className="text-xs text-muted-foreground">Minutos jogados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Target className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.goals}</p>
                <p className="text-xs text-muted-foreground">Golos marcados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isGoalkeeper ? (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <Shield className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.goalsConceded}</p>
                  <p className="text-xs text-muted-foreground">Golos sofridos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Users className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.assists}</p>
                  <p className="text-xs text-muted-foreground">Assistências</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Calendar className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.matchesPlayed}</p>
                <p className="text-xs text-muted-foreground">Jogos realizados</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Presença nos Treinos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {stats.trainingAttendance} de {stats.trainingSessions} sessões
            </span>
            <span className="text-sm font-semibold">{attendancePercentage}%</span>
          </div>
          <Progress value={attendancePercentage} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xl font-bold">{stats.matchesStarted}</p>
            <p className="text-xs text-muted-foreground">Titular</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xl font-bold text-yellow-500">{stats.yellowCards}</p>
            <p className="text-xs text-muted-foreground">Amarelos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xl font-bold text-red-500">{stats.redCards}</p>
            <p className="text-xs text-muted-foreground">Vermelhos</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
