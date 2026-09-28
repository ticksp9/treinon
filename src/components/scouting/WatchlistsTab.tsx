import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, List, Eye } from 'lucide-react';
import { toast } from 'sonner';

export function WatchlistsTab() {
  const { clubId } = useUserRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: watchlists, isLoading } = useQuery({
    queryKey: ['scouting-watchlists', clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase
        .from('scouting_watchlists')
        .select('*, scouting_watchlist_entries(count)')
        .eq('club_id', clubId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!clubId,
  });

  const createMutation = useMutation({
    mutationFn: async (form: Record<string, any>) => {
      const { error } = await supabase.from('scouting_watchlists').insert({
        club_id: clubId!,
        name: form.name,
        description: form.description || null,
        watchlist_type: form.watchlist_type || 'general',
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scouting-watchlists', clubId] });
      toast.success('Watchlist criada');
      setOpen(false);
    },
    onError: () => toast.error('Erro ao criar watchlist'),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get('name')?.toString().trim();
    if (!name) { toast.error('Nome é obrigatório'); return; }
    createMutation.mutate({ name, description: fd.get('description'), watchlist_type: fd.get('watchlist_type') });
  };

  if (isLoading) return <div className="mt-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Watchlists ({watchlists?.length || 0})</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Nova Watchlist</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Watchlist</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><Label>Nome *</Label><Input name="name" required /></div>
              <div><Label>Descrição</Label><Input name="description" /></div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>Criar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {(watchlists?.length || 0) === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Eye className="h-10 w-10 mx-auto mb-3 opacity-40" /><p>Nenhuma watchlist criada.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {watchlists?.map((w: any) => (
            <Card key={w.id} className="hover:bg-accent/30 transition-colors cursor-pointer">
              <CardContent className="py-4 px-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4 text-primary" />
                    <p className="font-medium text-sm">{w.name}</p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {w.scouting_watchlist_entries?.[0]?.count || 0} prospects
                  </Badge>
                </div>
                {w.description && <p className="text-xs text-muted-foreground">{w.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
