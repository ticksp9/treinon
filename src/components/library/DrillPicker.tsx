/** Pick an exercise (mine, my club's, or the TreinON library) to add to a training plan. */
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Film } from 'lucide-react';
import { DrillDiagram } from './DrillDiagram';
import { DRILLS, drillToText } from '@/lib/drill-library';
import { autoAnimate, elementsAt } from '@/lib/drill-library/animation';
import { useCoachDrills, type AnyDrill } from '@/lib/drill-library/custom';

export interface PickedExercise {
  id: string;
  name: string;
  duration: number;
  description: string;
  diagram: AnyDrill['diagram'];
  anim: AnyDrill['anim'];
}

export function DrillPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (ex: PickedExercise) => void }) {
  const { data: custom = [] } = useCoachDrills();
  const [q, setQ] = useState('');
  const all = useMemo<AnyDrill[]>(() => [...custom, ...DRILLS.map((d) => ({ ...d, source: 'library' as const }))], [custom]);
  const list = all.filter((d) => !q.trim() || d.name.toLowerCase().includes(q.trim().toLowerCase()));

  const pick = (d: AnyDrill) => {
    onPick({
      id: `${Date.now()}`,
      name: d.name,
      duration: d.minutes,
      description: drillToText(d),
      diagram: d.diagram,
      anim: d.anim ?? null,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Escolher exercício</DialogTitle>
          <DialogDescription>Os seus, os do clube e os da biblioteca TreinON.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar…" className="pl-9" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {list.map((d) => (
            <button key={d.id} type="button" onClick={() => pick(d)} className="overflow-hidden rounded-md border text-left transition hover:ring-2 hover:ring-primary">
              <div className="relative">
                <DrillDiagram elements={d.anim ? elementsAt(d.diagram, d.anim, 0, true) : d.diagram} className="w-full bg-[hsl(var(--field-dark))]" />
                {(d.anim || autoAnimate(d.diagram)) && <Film className="absolute right-1.5 top-1.5 h-4 w-4 text-white drop-shadow" />}
              </div>
              <div className="p-2">
                <p className="truncate text-sm font-medium">{d.name}</p>
                <p className="text-xs text-muted-foreground">{d.minutes} min · {d.source === 'mine' ? 'Meu' : d.source === 'club' ? 'Do clube' : 'Biblioteca'}</p>
              </div>
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={onClose}>Fechar</Button>
      </DialogContent>
    </Dialog>
  );
}
