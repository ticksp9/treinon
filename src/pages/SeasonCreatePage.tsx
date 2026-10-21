import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useSeasonScope, useSeasonsList } from '@/hooks/useSeasonContext';
import { createSeason, activateSeason, SeasonAlreadyExistsError } from '@/lib/season-service';
import { tx } from '@/lib/i18n/ui';

export default function SeasonCreatePage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { scope } = useSeasonScope();
  const { data: seasons = [] } = useSeasonsList();

  const [form, setForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    reference_date: '',
    notes: '',
  });

  const create = useMutation({
    mutationFn: async (activate: boolean) => {
      if (!scope) throw new Error(tx('Sem contexto'));
      const s = await createSeason(scope, {
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        reference_date: form.reference_date || form.start_date,
        notes: form.notes || null,
      });
      if (activate) await activateSeason(s.id);
      return s;
    },
    onSuccess: (s, activate) => {
      toast.success(activate ? tx('Época {{v0}} criada e ativa', { v0: s.name }) : tx('Época {{v0}} criada em planeamento', { v0: s.name }));
      qc.invalidateQueries({ queryKey: ['seasons-list'] });
      qc.invalidateQueries({ queryKey: ['season-context'] });
      nav('/seasons/transition');
    },
    onError: (e: any) => {
      if (e instanceof SeasonAlreadyExistsError) {
        toast.error(tx('Já existe a época {{v0}}.', { v0: e.season.name }));
        nav('/seasons');
        return;
      }
      toast.error(tx('Erro: ') + e.message);
    },
  });

  const ready = form.name && form.start_date && form.end_date;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">{tx('Nova Época')}</h1>
      <Card>
        <CardHeader><CardTitle className="text-base">{tx('Detalhes')}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>{tx('Nome *')}</Label>
            <Input value={form.name} placeholder={tx('Ex: 2026/2027')} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{tx('Início *')}</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{tx('Fim *')}</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{tx('Data de referência (cálculo de escalões)')}</Label>
            <Input type="date" value={form.reference_date} onChange={(e) => setForm({ ...form, reference_date: e.target.value })} />
            <p className="text-xs text-muted-foreground">{tx('Se vazio, usa a data de início.')}</p>
          </div>
          <div className="space-y-1">
            <Label>{tx('Notas')}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button variant="outline" disabled={!ready || create.isPending} onClick={() => create.mutate(false)}>
              {tx('Criar em planeamento')}
            </Button>
            <Button disabled={!ready || create.isPending} onClick={() => create.mutate(true)}>
              {tx('Criar e ativar')}
            </Button>
          </div>
          {seasons.find((s) => s.is_active) && (
            <p className="text-xs text-muted-foreground border-t pt-2">
              {tx('Ao ativar, a época atual (')}{seasons.find((s) => s.is_active)?.name}{tx(') é automaticamente fechada.')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
