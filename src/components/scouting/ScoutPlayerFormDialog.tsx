/** Create or edit the sheet of a watched player: football data only. */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FOOT_LABEL, SPORT_OPTIONS } from '@/lib/opponent-scouting';
import type { ScoutPlayer } from '@/lib/player-scouting';
import { tx } from '@/lib/i18n/ui';

export interface ScoutPlayerForm {
  name: string; birth: string; current_club: string; category: string; sport_type: string;
  position: string; other_positions: string; foot: string; height_cm: string; found_at: string;
}
const NO_FOOT = '__none__';

/** "2014" → the year; "2014-03-02" → the date; anything else → nothing. */
export function parseBirth(text: string): { birth_date: string | null; birth_year: number | null } {
  const t = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(Date.parse(t))) return { birth_date: t, birth_year: Number(t.slice(0, 4)) };
  const pt = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (pt) {
    const iso = `${pt[3]}-${pt[2].padStart(2, '0')}-${pt[1].padStart(2, '0')}`;
    if (!Number.isNaN(Date.parse(iso)) && Number(pt[2]) <= 12 && Number(pt[1]) <= 31) return { birth_date: iso, birth_year: Number(pt[3]) };
  }
  if (/^\d{4}$/.test(t) && Number(t) >= 1950 && Number(t) <= 2100) return { birth_date: null, birth_year: Number(t) };
  return { birth_date: null, birth_year: null };
}

export const playerFormToRow = (f: ScoutPlayerForm) => {
  const h = parseInt(f.height_cm, 10);
  return {
    name: f.name.trim(), ...parseBirth(f.birth), current_club: f.current_club.trim() || null, category: f.category.trim() || null, sport_type: f.sport_type,
    position: f.position.trim() || null, other_positions: f.other_positions.trim() || null, foot: f.foot === NO_FOOT ? null : f.foot,
    height_cm: Number.isFinite(h) && h >= 80 && h <= 230 ? h : null, found_at: f.found_at.trim() || null,
  };
};

export function ScoutPlayerFormDialog({ open, onOpenChange, initial, onSubmit }: {
  open: boolean; onOpenChange: (o: boolean) => void; initial?: ScoutPlayer | null; onSubmit: (form: ScoutPlayerForm) => Promise<void>;
}) {
  const blank = (): ScoutPlayerForm => ({
    name: initial?.name ?? '', birth: initial?.birth_date ? initial.birth_date.split('-').reverse().join('/') : initial?.birth_year ? String(initial.birth_year) : '',
    current_club: initial?.current_club ?? '', category: initial?.category ?? '', sport_type: initial?.sport_type ?? 'football_11',
    position: initial?.position ?? '', other_positions: initial?.other_positions ?? '', foot: initial?.foot ?? NO_FOOT,
    height_cm: initial?.height_cm ? String(initial.height_cm) : '', found_at: initial?.found_at ?? '',
  });
  const [form, setForm] = useState<ScoutPlayerForm>(blank);
  const [busy, setBusy] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) setForm(blank()); }, [open, initial?.id]);
  const set = (patch: Partial<ScoutPlayerForm>) => setForm((f) => ({ ...f, ...patch }));
  const birthOk = !form.birth.trim() || parseBirth(form.birth).birth_year != null;

  const submit = async () => {
    if (!form.name.trim() || !birthOk) return;
    setBusy(true);
    try { await onSubmit(form); onOpenChange(false); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? tx('Editar jogador') : tx('Novo jogador observado')}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="sp-name">{tx('Nome *')}</Label>
            <Input id="sp-name" maxLength={120} value={form.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
          </div>
          <div>
            <Label htmlFor="sp-birth">{tx('Nascimento')}</Label>
            <Input id="sp-birth" value={form.birth} onChange={(e) => set({ birth: e.target.value })} placeholder={tx('2014 ou 02/03/2014')} aria-invalid={!birthOk} />
            <p className="mt-1 text-xs text-muted-foreground">{birthOk ? tx('Basta o ano. Com a data completa, a ficha avisa da idade relativa.') : tx('Escreva o ano (2014) ou a data (02/03/2014).')}</p>
          </div>
          <div>
            <Label htmlFor="sp-height">{tx('Altura (cm)')}</Label>
            <Input id="sp-height" inputMode="numeric" maxLength={3} value={form.height_cm} onChange={(e) => set({ height_cm: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="sp-club">{tx('Clube atual')}</Label>
            <Input id="sp-club" maxLength={120} value={form.current_club} onChange={(e) => set({ current_club: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="sp-cat">{tx('Escalão')}</Label>
            <Input id="sp-cat" maxLength={60} value={form.category} onChange={(e) => set({ category: e.target.value })} placeholder={tx('Ex.: Seniores, Sub-15')} />
          </div>
          <div>
            <Label>{tx('Modalidade')}</Label>
            <Select value={form.sport_type} onValueChange={(v) => set({ sport_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SPORT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx('Pé')}</Label>
            <Select value={form.foot} onValueChange={(v) => set({ foot: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FOOT}>{tx('Não sei')}</SelectItem>
                {Object.entries(FOOT_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="sp-pos">{tx('Posição')}</Label>
            <Input id="sp-pos" maxLength={20} value={form.position} onChange={(e) => set({ position: e.target.value })} placeholder={tx('Ex.: MC')} />
          </div>
          <div>
            <Label htmlFor="sp-pos2">{tx('Outras posições')}</Label>
            <Input id="sp-pos2" maxLength={60} value={form.other_positions} onChange={(e) => set({ other_positions: e.target.value })} placeholder={tx('Ex.: MDC, DC')} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="sp-found">{tx('Onde foi visto / quem indicou')}</Label>
            <Input id="sp-found" maxLength={200} value={form.found_at} onChange={(e) => set({ found_at: e.target.value })} placeholder={tx('Ex.: Torneio de Páscoa; indicado pelo treinador dos Sub-15')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tx('Cancelar')}</Button>
          <Button onClick={submit} disabled={busy || !form.name.trim() || !birthOk}>{initial ? tx('Guardar') : tx('Criar ficha')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
