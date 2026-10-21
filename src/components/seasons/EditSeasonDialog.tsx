import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useSeasonScope } from '@/hooks/useSeasonContext';
import {
  getSeasonEditRules,
  isValidSeasonName,
  seasonPeriodWarning,
  updateSeason,
  SeasonAlreadyExistsError,
  type SeasonRow,
} from '@/lib/season-service';
import { tx } from '@/lib/i18n/ui';

interface Props {
  season: SeasonRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/** Edit a season's identity, respecting per-status rules. */
export function EditSeasonDialog({ season, onOpenChange, onSaved }: Props) {
  const { scope } = useSeasonScope();
  const rules = getSeasonEditRules(season?.status ?? 'planning');
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', reference_date: '', notes: '' });

  useEffect(() => {
    if (!season) return;
    setForm({
      name: season.name,
      start_date: season.start_date,
      end_date: season.end_date,
      reference_date: season.reference_date ?? '',
      notes: season.notes ?? '',
    });
  }, [season]);

  const save = useMutation({
    mutationFn: async () => {
      if (!season || !scope) throw new Error(tx('Sem contexto'));
      return updateSeason(season, scope, {
        name: form.name,
        start_date: form.start_date,
        end_date: form.end_date,
        reference_date: form.reference_date || null,
        notes: form.notes || null,
      });
    },
    onSuccess: (s) => {
      toast.success(tx('Época {{v0}} atualizada', { v0: s.name }));
      onSaved();
      onOpenChange(false);
    },
    onError: (e: any) => {
      if (e instanceof SeasonAlreadyExistsError) {
        toast.error(tx('Já existe a época {{v0}} neste contexto.', { v0: e.season.name }));
        return;
      }
      toast.error(e.message ?? tx('Não foi possível guardar'));
    },
  });

  const nameOk = isValidSeasonName(form.name);
  const datesOk = !rules.canEditDates || (!!form.start_date && !!form.end_date && form.start_date < form.end_date);
  const periodWarning = rules.canEditDates && datesOk ? seasonPeriodWarning(form.start_date, form.end_date) : null;

  return (
    <Dialog open={!!season} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{tx('Editar época')}{' '}{season?.name}</DialogTitle>
          <DialogDescription>{rules.reason ?? tx('Altere o nome, o período e as notas desta época.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="season-name">{tx('Nome')}</Label>
            <Input
              id="season-name"
              value={form.name}
              placeholder="2026/2027"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            {!nameOk && form.name && (
              <p className="text-xs text-destructive">{tx('Formato inválido. Use AAAA/AAAA com anos consecutivos.')}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="season-start">{tx('Início')}</Label>
              <Input
                id="season-start"
                type="date"
                disabled={!rules.canEditDates}
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="season-end">{tx('Fim')}</Label>
              <Input
                id="season-end"
                type="date"
                disabled={!rules.canEditDates}
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </div>
          </div>
          {!datesOk && <p className="text-xs text-destructive">{tx('A data de início tem de ser anterior à data de fim.')}</p>}
          {periodWarning && <p className="text-xs text-amber-600 dark:text-amber-400">{periodWarning}</p>}
          <div className="space-y-1">
            <Label htmlFor="season-ref">{tx('Data de referência (escalões)')}</Label>
            <Input
              id="season-ref"
              type="date"
              disabled={!rules.canEditDates}
              value={form.reference_date}
              onChange={(e) => setForm({ ...form, reference_date: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="season-notes">{tx('Notas')}</Label>
            <Textarea id="season-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tx('Cancelar')}</Button>
          <Button disabled={!nameOk || !datesOk || save.isPending} onClick={() => save.mutate()}>
            {tx('Guardar')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
