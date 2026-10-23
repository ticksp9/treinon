/** Create or edit a mesocycle (a block of weeks with one priority). */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { tx } from '@/lib/i18n/ui';
import { MESO_KINDS, nextMesoDates, type Mesocycle, type MesoKind } from '@/lib/training-plan';

const db = supabase as any; // newer than the generated types

export function MesocycleDialog({ teamId, season, mesos, editing, onClose }: {
  teamId: string;
  season: { id: string; start_date: string; end_date: string };
  mesos: Mesocycle[];
  editing: Mesocycle | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const next = nextMesoDates(mesos, season.start_date.slice(0, 10), season.end_date.slice(0, 10));
  const [name, setName] = useState(editing?.name ?? tx('Mesociclo {{n}}', { n: mesos.length + 1 }));
  const [kind, setKind] = useState<MesoKind>(editing?.kind ?? (mesos.length === 0 ? 'preparation' : 'competition'));
  const [start, setStart] = useState(editing?.start_date ?? next.start);
  const [end, setEnd] = useState(editing?.end_date ?? next.end);
  const [focus, setFocus] = useState(editing?.focus ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !start || !end) { toast.error(tx('Indique o nome e as datas.')); return; }
    if (end < start) { toast.error(tx('A data de fim tem de ser depois da de início.')); return; }
    setSaving(true);
    try {
      const row = { name: name.trim().slice(0, 120), kind, start_date: start, end_date: end, focus: focus.trim() || null };
      const { error } = editing
        ? await db.from('training_mesocycles').update(row).eq('id', editing.id)
        : await db.from('training_mesocycles').insert({ ...row, team_id: teamId, season_id: season.id });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['season-plan'] });
      onClose();
    } catch (e) {
      toast.error(tx('Não foi possível guardar: {{msg}}', { msg: (e as Error).message }));
    } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? tx('Editar mesociclo') : tx('Novo mesociclo')}</DialogTitle>
          <DialogDescription>{tx('O que priorizar neste bloco? As semanas destas datas ficam ligadas a ele.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <div className="space-y-1.5">
              <Label htmlFor="meso-name">{tx('Nome')}</Label>
              <Input id="meso-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{tx('Tipo')}</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as MesoKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MESO_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="meso-start">{tx('Início')}</Label>
              <Input id="meso-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meso-end">{tx('Fim')}</Label>
              <Input id="meso-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meso-focus">{tx('Prioridades do bloco')}</Label>
            <Textarea id="meso-focus" rows={3} maxLength={4000} value={focus} onChange={(e) => setFocus(e.target.value)}
              placeholder={tx('Ex.: transições ofensivas e defensivas; relações numéricas 1x1, 2x1; finalização')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tx('Cancelar')}</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{tx('Guardar')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
