/**
 * Alertas do coordenador: what needs a phone call, per age group.
 *  - a player missed two trainings in a row and nobody gave a reason
 *  - monthly fees overdue
 * Computed from the attendance and billing data; "Tratado" only hides it from the to-do list.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarX, Check, Euro, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export interface CoordinatorAlert {
  kind: 'absence' | 'payment'; player_id: string; player_name: string; team_id: string; team_name: string; club_id: string;
  ref_key: string; headline: string; amount: number | null; items: number; since: string | null;
  resolved: boolean; resolved_at: string | null; note: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types
const ALL = '__all__';
const euro = (n: number) => n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

const KINDS = {
  absence: { title: 'Faltas a treinos sem motivo', icon: CalendarX, tone: 'bg-accent/15 text-accent', empty: 'Nenhum jogador com dois treinos seguidos sem motivo de falta.' },
  payment: { title: 'Mensalidades em atraso', icon: Euro, tone: 'bg-destructive/10 text-destructive', empty: 'Sem mensalidades em atraso.' },
} as const;

export default function CoordinatorAlerts() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [team, setTeam] = useState(ALL);
  const [showResolved, setShowResolved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: alerts = [], isLoading, error } = useQuery({
    queryKey: ['coordinator-alerts', user?.id],
    enabled: !!user,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await db.rpc('get_coordinator_alerts');
      if (error) throw error;
      return (data ?? []) as CoordinatorAlert[];
    },
  });

  const teams = useMemo(() => [...new Map(alerts.map((a) => [a.team_id, a.team_name])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt')), [alerts]);
  const shown = alerts.filter((a) => (team === ALL || a.team_id === team) && (showResolved || !a.resolved));
  const open = alerts.filter((a) => !a.resolved);

  const resolve = async (a: CoordinatorAlert, resolved: boolean) => {
    const note = resolved ? window.prompt(`O que ficou combinado com ${a.player_name}? (opcional)`, a.note ?? '') : null;
    if (resolved && note === null) return; // cancelled
    const key = a.kind + a.player_id + a.ref_key;
    setBusy(key);
    const { error } = await db.rpc('resolve_coordinator_alert', { _kind: a.kind, _player: a.player_id, _ref_key: a.ref_key, _note: note, _resolved: resolved });
    setBusy(null);
    if (error) return toast.error('Não foi possível guardar: ' + error.message);
    qc.invalidateQueries({ queryKey: ['coordinator-alerts'] });
  };

  return (
    <AppLayout title="Alertas">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold"><BellRing className="h-5 w-5 text-primary" />Alertas da coordenação</h2>
            <p className="text-sm text-muted-foreground">
              {open.length === 0 ? 'Nada por tratar.' : `${open.length} por tratar: ${open.filter((a) => a.kind === 'absence').length} de faltas, ${open.filter((a) => a.kind === 'payment').length} de mensalidades.`}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {teams.length > 1 && (
              <Select value={team} onValueChange={setTeam}>
                <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os escalões</SelectItem>
                  {teams.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" variant={showResolved ? 'default' : 'outline'} className="h-9" onClick={() => setShowResolved((v) => !v)}>Tratados</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : error ? (
          <Card><CardContent className="py-8 text-center text-sm text-destructive">Não foi possível carregar os alertas: {(error as Error).message}</CardContent></Card>
        ) : (
          (Object.keys(KINDS) as (keyof typeof KINDS)[]).map((k) => {
            const K = KINDS[k];
            const rows = shown.filter((a) => a.kind === k);
            return (
              <section key={k} className="space-y-2">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><K.icon className="h-4 w-4" />{K.title} ({rows.filter((r) => !r.resolved).length})</h3>
                {rows.length === 0 ? (
                  <Card><CardContent className="py-5 text-center text-sm text-muted-foreground">{K.empty}</CardContent></Card>
                ) : rows.map((a) => {
                  const key = a.kind + a.player_id + a.ref_key;
                  return (
                    <Card key={key} className={cn(a.resolved && 'opacity-60')}>
                      <CardContent className="flex gap-3 p-3 sm:p-4">
                        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', K.tone)}><K.icon className="h-5 w-5" /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <Link to={`/players/${a.player_id}`} className="font-medium hover:underline">{a.player_name}</Link>
                            <Badge variant="outline" className="h-5">{a.team_name}</Badge>
                            {a.kind === 'payment' && a.amount != null && <span className="font-mono text-sm font-semibold text-destructive">{euro(Number(a.amount))}</span>}
                            {a.resolved && <Badge variant="secondary" className="h-5">Tratado</Badge>}
                          </div>
                          <p className="mt-0.5 text-sm text-muted-foreground">{a.headline}</p>
                          {a.note && <p className="mt-1 text-sm">“{a.note}”</p>}
                        </div>
                        {a.resolved ? (
                          <Button size="sm" variant="ghost" className="h-8 shrink-0" disabled={busy === key} onClick={() => resolve(a, false)}><RotateCcw className="mr-1 h-4 w-4" />Reabrir</Button>
                        ) : (
                          <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={busy === key} onClick={() => resolve(a, true)}>
                            {busy === key ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}Tratado
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </section>
            );
          })
        )}

        <p className="text-xs text-muted-foreground">
          Faltas: conta quem faltou aos dois últimos treinos com presenças registadas e sem motivo escrito pelo treinador. Mensalidades: cobranças por pagar depois da data de vencimento.
          Só aparecem os escalões que coordena.
        </p>
      </div>
    </AppLayout>
  );
}
