/** Create or edit the header of an opponent's sheet. */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formationCodes } from '@/lib/tactic-board';
import { SPORT_OPTIONS, type Opponent } from '@/lib/opponent-scouting';

export interface OpponentForm { name: string; category: string; sport_type: string; competition: string; coach_name: string; usual_formation: string }
const NO_FORMATION = '__none__';

export function OpponentFormDialog({ open, onOpenChange, initial, defaults, onSubmit }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial?: Opponent | null; defaults?: Partial<OpponentForm>;
  onSubmit: (form: OpponentForm) => Promise<void>;
}) {
  const blank = (): OpponentForm => ({
    name: initial?.name ?? defaults?.name ?? '', category: initial?.category ?? defaults?.category ?? '',
    sport_type: initial?.sport_type ?? defaults?.sport_type ?? 'football_11', competition: initial?.competition ?? defaults?.competition ?? '',
    coach_name: initial?.coach_name ?? '', usual_formation: initial?.usual_formation ?? '',
  });
  const [form, setForm] = useState<OpponentForm>(blank);
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setForm(blank()); }, [open, initial?.id, defaults?.name]);
  const set = (patch: Partial<OpponentForm>) => setForm((f) => ({ ...f, ...patch }));
  const formations = formationCodes(form.sport_type);

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try { await onSubmit({ ...form, name: form.name.trim() }); onOpenChange(false); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? 'Editar adversário' : 'Novo adversário'}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="opp-name">Equipa *</Label>
            <Input id="opp-name" maxLength={120} value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Estrela do Monte" autoFocus />
          </div>
          <div>
            <Label htmlFor="opp-cat">Escalão</Label>
            <Input id="opp-cat" maxLength={60} value={form.category} onChange={(e) => set({ category: e.target.value })} placeholder="Ex.: Seniores, Sub-15" />
          </div>
          <div>
            <Label>Modalidade</Label>
            <Select value={form.sport_type} onValueChange={(v) => set({ sport_type: v, usual_formation: '' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SPORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="opp-comp">Competição</Label>
            <Input id="opp-comp" maxLength={120} value={form.competition} onChange={(e) => set({ competition: e.target.value })} placeholder="Ex.: Distrital 1.ª Divisão" />
          </div>
          <div>
            <Label>Formação habitual</Label>
            <Select value={form.usual_formation || NO_FORMATION} onValueChange={(v) => set({ usual_formation: v === NO_FORMATION ? '' : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FORMATION}>Ainda não sei</SelectItem>
                {formations.map((f) => <SelectItem key={f.code} value={f.code}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="opp-coach">Treinador</Label>
            <Input id="opp-coach" maxLength={120} value={form.coach_name} onChange={(e) => set({ coach_name: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !form.name.trim()}>{initial ? 'Guardar' : 'Criar ficha'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const formToRow = (f: OpponentForm) => ({
  name: f.name.trim(), category: f.category.trim() || null, sport_type: f.sport_type, competition: f.competition.trim() || null,
  coach_name: f.coach_name.trim() || null, usual_formation: f.usual_formation || null,
});
