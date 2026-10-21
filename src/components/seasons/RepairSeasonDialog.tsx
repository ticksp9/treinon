import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSeasonScope } from '@/hooks/useSeasonContext';
import {
  buildSeasonFromFirstYear,
  isValidSeasonName,
  repairRenamedSeason,
  SeasonAlreadyExistsError,
  type SeasonRow,
} from '@/lib/season-service';
import { tx } from '@/lib/i18n/ui';

interface Props {
  season: SeasonRow | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/**
 * Fix the case where the season that ended was renamed to the new season's
 * name: restores its real identity (closed) and inserts the new season.
 */
export function RepairSeasonDialog({ season, onOpenChange, onDone }: Props) {
  const { scope } = useSeasonScope();
  const [form, setForm] = useState({
    correctedName: '',
    correctedStart: '',
    correctedEnd: '',
    newName: '',
    newStart: '',
    newEnd: '',
  });

  useEffect(() => {
    if (!season) return;
    const year = new Date(season.start_date).getFullYear();
    const prev = buildSeasonFromFirstYear(year - 1);
    const next = buildSeasonFromFirstYear(year);
    setForm({
      correctedName: prev.name,
      correctedStart: prev.start_date,
      correctedEnd: prev.end_date,
      newName: next.name,
      newStart: next.start_date,
      newEnd: next.end_date,
    });
  }, [season]);

  const run = useMutation({
    mutationFn: async () => {
      if (!season || !scope) throw new Error(tx('Sem contexto'));
      return repairRenamedSeason(scope, { season, ...form });
    },
    onSuccess: (s) => {
      toast.success(tx('Época corrigida para {{v0}}. Criada a época {{v1}} em planeamento.', { v0: form.correctedName, v1: s.name }));
      onDone();
      onOpenChange(false);
    },
    onError: (e: any) => {
      if (e instanceof SeasonAlreadyExistsError) {
        toast.error(tx('Já existe a época {{v0}}.', { v0: e.season.name }));
        return;
      }
      toast.error(e.message ?? tx('Não foi possível corrigir'));
    },
  });

  const valid =
    isValidSeasonName(form.correctedName) &&
    isValidSeasonName(form.newName) &&
    form.correctedStart < form.correctedEnd &&
    form.newStart < form.newEnd;

  return (
    <Dialog open={!!season} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{tx('Corrigir época: esta é a época anterior')}</DialogTitle>
          <DialogDescription>
            {tx('A época')}{' '}<strong>{season?.name}</strong> {tx('contém dados de um período anterior ao seu início. Vamos devolver-lhe a identidade correta e criar a nova época como registo novo. Nenhum jogo, treino ou jogador é apagado ou movido.')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2 rounded border p-3">
            <p className="text-sm font-medium">{tx('Época real (fica fechada, mantém os dados)')}</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="rep-name" className="text-xs">{tx('Nome')}</Label>
                <Input id="rep-name" value={form.correctedName} onChange={(e) => setForm({ ...form, correctedName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rep-start" className="text-xs">{tx('Início')}</Label>
                <Input id="rep-start" type="date" value={form.correctedStart} onChange={(e) => setForm({ ...form, correctedStart: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rep-end" className="text-xs">{tx('Fim')}</Label>
                <Input id="rep-end" type="date" value={form.correctedEnd} onChange={(e) => setForm({ ...form, correctedEnd: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="space-y-2 rounded border p-3">
            <p className="text-sm font-medium">{tx('Nova época (criada em planeamento)')}</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="new-name" className="text-xs">{tx('Nome')}</Label>
                <Input id="new-name" value={form.newName} onChange={(e) => setForm({ ...form, newName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-start" className="text-xs">{tx('Início')}</Label>
                <Input id="new-start" type="date" value={form.newStart} onChange={(e) => setForm({ ...form, newStart: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-end" className="text-xs">{tx('Fim')}</Label>
                <Input id="new-end" type="date" value={form.newEnd} onChange={(e) => setForm({ ...form, newEnd: e.target.value })} />
              </div>
            </div>
          </div>
          <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
            <li>{season?.name} {tx('passa a chamar-se')}{' '}{form.correctedName} {tx('e fica fechada.')}</li>
            <li>{tx('É criada a época')}{' '}{form.newName} {tx('em planeamento, ligada à anterior.')}</li>
            <li>{tx('Jogos, treinos e inscrições ficam na época corrigida.')}</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tx('Cancelar')}</Button>
          <Button disabled={!valid || run.isPending} onClick={() => run.mutate()}>{tx('Confirmar correção')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
