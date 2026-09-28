// Editable strengths / improvement focus list backed by player_strengths_focus table.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, X, ThumbsUp, Target } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Props {
  playerId: string;
  kind: 'strength' | 'improvement';
  canEdit?: boolean;
}

export function PlayerStrengthsPanel(props: Props) {
  return <FocusPanel {...props} />;
}

export function PlayerImprovementPanel(props: Omit<Props, 'kind'>) {
  return <FocusPanel {...props} kind="improvement" />;
}

function FocusPanel({ playerId, kind, canEdit = true }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [newLabel, setNewLabel] = useState('');

  const queryKey = ['player-focus', playerId, kind];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('player_strengths_focus' as any)
        .select('*')
        .eq('player_id', playerId)
        .eq('kind', kind)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const add = useMutation({
    mutationFn: async (label: string) => {
      if (!user) throw new Error('Sem sessão');
      const { error } = await supabase.from('player_strengths_focus' as any).insert({
        player_id: playerId,
        kind,
        label,
        updated_by: user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      setNewLabel('');
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error('Erro: ' + e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('player_strengths_focus' as any)
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const Icon = kind === 'strength' ? ThumbsUp : Target;
  const title = kind === 'strength' ? 'Pontos Fortes' : 'Pontos a Melhorar';
  const tone =
    kind === 'strength' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`w-4 h-4 ${kind === 'strength' ? 'text-emerald-500' : 'text-amber-500'}`} />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">A carregar…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem entradas.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((it) => (
              <Badge key={it.id} className={`${tone} gap-1 pr-1`}>
                <span title={`Atualizado ${format(new Date(it.updated_at), 'dd MMM yyyy', { locale: pt })}`}>
                  {it.label}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    aria-label="Remover"
                    onClick={() => remove.mutate(it.id)}
                    className="rounded-full hover:bg-background/50 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            ))}
          </div>
        )}

        {canEdit && (
          <div className="flex gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={kind === 'strength' ? 'Ex: Boa receção orientada' : 'Ex: Tomada de decisão'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLabel.trim()) add.mutate(newLabel.trim());
              }}
            />
            <Button
              size="sm"
              disabled={!newLabel.trim() || add.isPending}
              onClick={() => add.mutate(newLabel.trim())}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}

        {items[0]?.updated_at && (
          <p className="text-[11px] text-muted-foreground">
            Última atualização: {format(new Date(items[0].updated_at), "dd MMM yyyy", { locale: pt })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
