/**
 * For parents and players: the exercises the physio sent for home, with "Fiz hoje" and how
 * much it hurt (0–10). The physio sees the ticks; nothing clinical is shown here.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, HeartPulse } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { phaseOf, PROTOCOL_LABEL, type RehabProtocol } from '@/lib/rehab';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

interface Ex { id: string; player_id: string; injury_id: string; title: string; instructions: string | null; dose: string | null; frequency: string | null; video_url: string | null; player: { name: string } | null }
interface Inj { id: string; rehab_protocol: RehabProtocol | null; rehab_phase: number | null }

export function FamilyRehab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pain, setPain] = useState<Record<string, number>>({});
  const { data } = useQuery({
    queryKey: ['family-rehab', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: ex } = await db.from('injury_home_exercises').select('id, player_id, injury_id, title, instructions, dose, frequency, video_url, player:players(name)').eq('active', true).order('created_at');
      const list = (ex ?? []) as Ex[];
      if (!list.length) return { list, done: new Set<string>(), injuries: [] as Inj[] };
      const [{ data: logs }, { data: inj }] = await Promise.all([
        db.from('injury_exercise_logs').select('exercise_id').eq('done_on', today()).in('exercise_id', list.map((e) => e.id)),
        db.from('player_injuries').select('id, rehab_protocol, rehab_phase').in('id', [...new Set(list.map((e) => e.injury_id))]),
      ]);
      return { list, done: new Set(((logs ?? []) as { exercise_id: string }[]).map((l) => l.exercise_id)), injuries: (inj ?? []) as Inj[] };
    },
  });
  if (!data?.list.length) return null;

  const tick = async (e: Ex) => {
    const { error } = await db.from('injury_exercise_logs').insert({ exercise_id: e.id, player_id: e.player_id, done_on: today(), pain: pain[e.id] ?? null, logged_by: user!.id });
    if (error && error.code !== '23505') return toast.error('Não foi possível registar: ' + error.message);
    toast.success('Registado. O fisioterapeuta vê que foi feito.');
    qc.invalidateQueries({ queryKey: ['family-rehab', user?.id] });
  };

  const byPlayer = new Map<string, Ex[]>();
  data.list.forEach((e) => byPlayer.set(e.player_id, [...(byPlayer.get(e.player_id) ?? []), e]));

  return (
    <Card className="border-primary/40">
      <CardContent className="space-y-3 p-4">
        <p className="flex items-center gap-2 font-semibold"><HeartPulse className="h-4 w-4 text-primary" />Exercícios de recuperação</p>
        {[...byPlayer.entries()].map(([pid, list]) => {
          const inj = data.injuries.find((i) => i.id === list[0].injury_id);
          const ph = inj ? phaseOf(inj.rehab_protocol, inj.rehab_phase) : null;
          return (
            <div key={pid} className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">{list[0].player?.name}</span>
                {ph && inj?.rehab_protocol && <span className="text-muted-foreground"> · {PROTOCOL_LABEL[inj.rehab_protocol]}, fase {inj.rehab_phase}/6: {ph.name}</span>}
              </p>
              {list.map((e) => {
                const isDone = data.done.has(e.id);
                return (
                  <div key={e.id} className="rounded-md border p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{e.title}</span>
                      {e.dose && <span className="text-sm text-muted-foreground">{e.dose}</span>}
                      {e.frequency && <span className="text-sm text-muted-foreground">· {e.frequency}</span>}
                      {e.video_url && <a href={e.video_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary"><ExternalLink className="h-3.5 w-3.5" />Ver vídeo</a>}
                    </div>
                    {e.instructions && <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{e.instructions}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {isDone ? (
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600"><Check className="h-4 w-4" />Feito hoje</span>
                      ) : (
                        <>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            Dor (0–10)
                            <select className="rounded border bg-background px-1 py-0.5 text-sm" value={pain[e.id] ?? ''} onChange={(ev) => setPain((p) => ({ ...p, [e.id]: Number(ev.target.value) }))} aria-label={`Dor ao fazer ${e.title}`}>
                              <option value="">—</option>
                              {Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                            </select>
                          </label>
                          <Button size="sm" onClick={() => tick(e)}><Check className="mr-1 h-4 w-4" />Fiz hoje</Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
