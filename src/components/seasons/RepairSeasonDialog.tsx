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
      if (!season || !scope) throw new Error('Sem contexto');
      return repairRenamedSeason(scope, { season, ...form });
    },
    onSuccess: (s) => {
      toast.success(`Época corrigida para ${form.correctedName}. Criada a época ${s.name} em planeamento.`);
      onDone();
      onOpenChange(false);
    },
    onError: (e: any) => {
      if (e instanceof SeasonAlreadyExistsError) {
        toast.error(`Já existe a época ${e.season.name}.`);
        return;
      }
      toast.error(e.message ?? 'Não foi possível corrigir');
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
          <DialogTitle>Corrigir época: esta é a época anterior</DialogTitle>
          <DialogDescription>
            A época <strong>{season?.name}</strong> contém dados de um período anterior ao seu início. Vamos devolver-lhe a
            identidade correta e criar a nova época como registo novo. Nenhum jogo, treino ou jogador é apagado ou movido.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2 rounded border p-3">
            <p className="text-sm font-medium">Época real (fica fechada, mantém os dados)</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="rep-name" className="text-xs">Nome</Label>
                <Input id="rep-name" value={form.correctedName} onChange={(e) => setForm({ ...form, correctedName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rep-start" className="text-xs">Início</Label>
                <Input id="rep-start" type="date" value={form.correctedStart} onChange={(e) => setForm({ ...form, correctedStart: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rep-end" className="text-xs">Fim</Label>
                <Input id="rep-end" type="date" value={form.correctedEnd} onChange={(e) => setForm({ ...form, correctedEnd: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="space-y-2 rounded border p-3">
            <p className="text-sm font-medium">Nova época (criada em planeamento)</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor="new-name" className="text-xs">Nome</Label>
                <Input id="new-name" value={form.newName} onChange={(e) => setForm({ ...form, newName: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-start" className="text-xs">Início</Label>
                <Input id="new-start" type="date" value={form.newStart} onChange={(e) => setForm({ ...form, newStart: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-end" className="text-xs">Fim</Label>
                <Input id="new-end" type="date" value={form.newEnd} onChange={(e) => setForm({ ...form, newEnd: e.target.value })} />
              </div>
            </div>
          </div>
          <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
            <li>{season?.name} passa a chamar-se {form.correctedName} e fica fechada.</li>
            <li>É criada a época {form.newName} em planeamento, ligada à anterior.</li>
            <li>Jogos, treinos e inscrições ficam na época corrigida.</li>
          </ul>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!valid || run.isPending} onClick={() => run.mutate()}>Confirmar correção</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
