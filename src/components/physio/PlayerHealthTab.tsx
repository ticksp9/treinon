import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { usePhysioAccess } from '@/hooks/usePhysioAccess';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Heart, 
  AlertTriangle, 
  Calendar,
  ClipboardList,
  Plus,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { toast } from 'sonner';
import { INJURY_STATUSES, INJURY_SEVERITIES, BODY_AREAS, INJURY_TYPES } from '@/lib/physio-constants';

interface PlayerHealthTabProps {
  playerId: string;
  clubId: string;
}

export function PlayerHealthTab({ playerId, clubId }: PlayerHealthTabProps) {
  const { user } = useAuth();
  const { hasPhysioAccess, isClubAdmin } = usePhysioAccess();
  const queryClient = useQueryClient();
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [logData, setLogData] = useState({
    pain_level: 0,
    fatigue_level: 5,
    sleep_quality: 5,
    adherence: true,
    notes: '',
  });

  // Fetch active injuries
  const { data: injuries, isLoading: injuriesLoading } = useQuery({
    queryKey: ['player-physio-injuries', playerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('physio_injuries')
        .select('*')
        .eq('player_id', playerId)
        .in('status', ['active', 'recovering'])
        .order('start_date', { ascending: false });
      return data || [];
    },
    enabled: !!playerId,
  });

  // Fetch active rehab plan
  const { data: rehabPlan } = useQuery({
    queryKey: ['player-rehab-plan', playerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('rehab_plans')
        .select(`
          *,
          exercises:rehab_plan_exercises(*)
        `)
        .eq('player_id', playerId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!playerId,
  });

  // Fetch latest assessment
  const { data: latestAssessment } = useQuery({
    queryKey: ['player-latest-assessment', playerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('physio_assessments')
        .select('*')
        .eq('player_id', playerId)
        .order('assessment_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!playerId,
  });

  // Fetch recent daily logs
  const { data: recentLogs } = useQuery({
    queryKey: ['player-daily-logs', playerId],
    queryFn: async () => {
      const { data } = await supabase
        .from('physio_daily_logs')
        .select('*')
        .eq('player_id', playerId)
        .order('log_date', { ascending: false })
        .limit(7);
      return data || [];
    },
    enabled: !!playerId && hasPhysioAccess,
  });

  // Add daily log mutation
  const addLogMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('physio_daily_logs')
        .insert({
          club_id: clubId,
          player_id: playerId,
          log_date: format(new Date(), 'yyyy-MM-dd'),
          pain_level: logData.pain_level,
          fatigue_level: logData.fatigue_level,
          sleep_quality: logData.sleep_quality,
          adherence: logData.adherence,
          notes: logData.notes || null,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-daily-logs', playerId] });
      setShowLogDialog(false);
      setLogData({ pain_level: 0, fatigue_level: 5, sleep_quality: 5, adherence: true, notes: '' });
      toast.success('Registo diário guardado!');
    },
    onError: (error) => {
      console.error('Error adding log:', error);
      toast.error('Erro ao guardar registo');
    },
  });

  const getSeverityBadge = (severity: string) => {
    const config = INJURY_SEVERITIES.find(s => s.value === severity);
    return config ? (
      <Badge variant="outline" className={config.color}>{config.label}</Badge>
    ) : null;
  };

  const getStatusBadge = (status: string) => {
    const config = INJURY_STATUSES.find(s => s.value === status);
    return config ? (
      <Badge variant="outline" className={config.color}>{config.label}</Badge>
    ) : null;
  };

  // For coaches: show only summary
  if (!hasPhysioAccess) {
    const activeInjury = injuries?.[0];
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Estado de Saúde
          </CardTitle>
          <CardDescription>Resumo do estado do jogador</CardDescription>
        </CardHeader>
        <CardContent>
          {injuriesLoading ? (
            <Skeleton className="h-24" />
          ) : activeInjury ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-yellow-500/10 border-yellow-500/30">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <div>
                    <p className="font-medium">
                      {activeInjury.is_fit ? 'Apto com Restrições' : 'Indisponível'}
                    </p>
                    {activeInjury.restrictions && (
                      <p className="text-sm text-muted-foreground">{activeInjury.restrictions}</p>
                    )}
                  </div>
                </div>
                {getStatusBadge(activeInjury.status)}
              </div>

              {latestAssessment?.next_review_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Próxima reavaliação: {format(new Date(latestAssessment.next_review_date), 'dd/MM/yyyy')}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3 py-6 text-green-600">
              <Activity className="w-6 h-6" />
              <span className="font-medium">Jogador Apto</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // For physio/admin: show full details
  return (
    <div className="space-y-6">
      {/* Active Injuries */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">Lesões Ativas</CardTitle>
            <CardDescription>Lesões em tratamento</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {injuriesLoading ? (
            <Skeleton className="h-24" />
          ) : injuries?.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Sem lesões ativas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {injuries?.map(injury => (
                <div key={injury.id} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">
                      {BODY_AREAS.find(a => a.value === injury.body_area)?.label}
                    </span>
                    <div className="flex gap-2">
                      {getSeverityBadge(injury.severity)}
                      {getStatusBadge(injury.status)}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {INJURY_TYPES.find(t => t.value === injury.injury_type)?.label}
                  </p>
                  {injury.restrictions && (
                    <p className="text-sm text-yellow-600 mt-2">
                      ⚠️ {injury.restrictions}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Desde {format(new Date(injury.start_date), 'dd/MM/yyyy')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Rehab Plan */}
      {rehabPlan && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              Plano de Reabilitação
            </CardTitle>
            <CardDescription>{rehabPlan.title}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rehabPlan.goal && (
                <p className="text-sm text-muted-foreground">{rehabPlan.goal}</p>
              )}
              
              <div className="flex gap-2">
                <Badge variant="secondary">{rehabPlan.phase}</Badge>
                <Badge variant="outline">
                  {rehabPlan.exercises?.length || 0} exercícios
                </Badge>
              </div>

              {rehabPlan.exercises && rehabPlan.exercises.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-sm font-medium">Exercícios:</p>
                  {rehabPlan.exercises.slice(0, 3).map((ex: any) => (
                    <div key={ex.id} className="text-sm p-2 bg-muted/50 rounded">
                      {ex.exercise_name}
                      {ex.sets && ex.reps && (
                        <span className="text-muted-foreground"> - {ex.sets}x{ex.reps}</span>
                      )}
                    </div>
                  ))}
                  {rehabPlan.exercises.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      +{rehabPlan.exercises.length - 3} mais
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Log */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">Registo Diário</CardTitle>
            <CardDescription>Acompanhamento do estado do jogador</CardDescription>
          </div>
          <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Novo Registo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registo Diário</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="space-y-3">
                  <Label>Nível de Dor: {logData.pain_level}</Label>
                  <Slider
                    value={[logData.pain_level]}
                    onValueChange={([value]) => setLogData({ ...logData, pain_level: value })}
                    max={10}
                    step={1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Sem dor</span>
                    <span>Dor intensa</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label>Fadiga: {logData.fatigue_level}</Label>
                  <Slider
                    value={[logData.fatigue_level]}
                    onValueChange={([value]) => setLogData({ ...logData, fatigue_level: value })}
                    max={10}
                    step={1}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Qualidade do Sono: {logData.sleep_quality}</Label>
                  <Slider
                    value={[logData.sleep_quality]}
                    onValueChange={([value]) => setLogData({ ...logData, sleep_quality: value })}
                    max={10}
                    step={1}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Cumpriu os exercícios</Label>
                  <Switch
                    checked={logData.adherence}
                    onCheckedChange={(checked) => setLogData({ ...logData, adherence: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <Textarea
                    placeholder="Observações..."
                    value={logData.notes}
                    onChange={(e) => setLogData({ ...logData, notes: e.target.value })}
                    rows={2}
                  />
                </div>

                <Button 
                  onClick={() => addLogMutation.mutate()} 
                  className="w-full"
                  disabled={addLogMutation.isPending}
                >
                  Guardar Registo
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {recentLogs?.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              Sem registos recentes
            </p>
          ) : (
            <div className="space-y-2">
              {recentLogs?.slice(0, 5).map(log => (
                <div key={log.id} className="flex items-center justify-between p-2 border rounded text-sm">
                  <span className="text-muted-foreground">
                    {format(new Date(log.log_date), 'dd/MM', { locale: pt })}
                  </span>
                  <div className="flex items-center gap-4">
                    <span>Dor: {log.pain_level}/10</span>
                    <span>Fadiga: {log.fatigue_level}/10</span>
                    <Badge variant={log.adherence ? 'secondary' : 'destructive'}>
                      {log.adherence ? '✓' : '✗'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
