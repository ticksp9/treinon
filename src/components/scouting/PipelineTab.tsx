import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from '@/hooks/useScouting';

export function PipelineTab() {
  const { clubId } = useUserRole();

  const { data: pipeline, isLoading } = useQuery({
    queryKey: ['scouting-pipeline', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('recruitment_pipeline')
        .select('*, prospect_profiles(full_name, primary_position)')
        .eq('club_id', clubId)
        .order('stage_entered_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  if (isLoading) return <div className="mt-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>;

  // Group by stage
  const grouped: Record<string, any[]> = {};
  for (const entry of (pipeline || [])) {
    const stage = entry.current_stage;
    if (!grouped[stage]) grouped[stage] = [];
    grouped[stage].push(entry);
  }

  const activeStages = PIPELINE_STAGES.filter(s => grouped[s]?.length);

  return (
    <div className="space-y-4 mt-4">
      <h3 className="text-lg font-semibold">Pipeline de Recrutamento</h3>

      {activeStages.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <ArrowRight className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum prospect no pipeline.</p>
          <p className="text-xs mt-1">Adicione prospects e mova-os através das etapas.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {activeStages.map(stage => (
            <Card key={stage}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{PIPELINE_STAGE_LABELS[stage] || stage}</CardTitle>
                  <Badge variant="secondary" className="text-xs">{grouped[stage].length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="py-2 space-y-1">
                {grouped[stage].map((entry: any) => (
                  <div key={entry.id} className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{entry.prospect_profiles?.full_name || '–'}</p>
                      <p className="text-xs text-muted-foreground">{entry.prospect_profiles?.primary_position || '–'}</p>
                    </div>
                    {entry.risk_level && (
                      <Badge variant={entry.risk_level === 'high' ? 'destructive' : 'outline'} className="text-xs">
                        Risco: {entry.risk_level}
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
