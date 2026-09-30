/**
 * A training session as a coach's plan sheet: every exercise with its animated
 * drawing, time and description. Print (A4) or share by WhatsApp.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Printer, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatedDrill } from '@/components/library/AnimatedDrill';
import { DrillDiagram } from '@/components/library/DrillDiagram';
import { elementsAt, type DrillAnimation } from '@/lib/drill-library/animation';
import type { DiagramEl } from '@/lib/drill-library/types';
import { shareText } from '@/lib/share';

export interface PlanExercise {
  id: string;
  name: string;
  duration: number;
  description: string;
  image_url?: string;
  diagram?: DiagramEl[];
  anim?: DrillAnimation | null;
}

export interface PlanTraining {
  name: string;
  training_date?: string | null;
  objectives?: string | null;
  duration_minutes?: number | null;
  exercises: PlanExercise[];
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const still = (e: PlanExercise) => (e.anim ? elementsAt(e.diagram ?? [], e.anim, 0, true) : e.diagram ?? []);
const total = (t: PlanTraining) => t.exercises.reduce((s, e) => s + (e.duration || 0), 0);

export function printTraining(t: PlanTraining) {
  const w = window.open('', '_blank');
  if (!w) { toast.error('Permita janelas pop-up para imprimir.'); return; }
  const blocks = t.exercises.map((e, i) => `
    <section class="block">
      ${e.diagram?.length ? `<div class="diagram">${renderToStaticMarkup(<DrillDiagram elements={still(e)} />)}</div>` : e.image_url ? `<div class="diagram"><img src="${esc(e.image_url)}"/></div>` : ''}
      <div class="text"><h2>${i + 1}. ${esc(e.name || 'Exercício')} <span>${e.duration} min</span></h2>
      <p>${esc(e.description || '').replace(/\n/g, '<br/>')}</p></div>
    </section>`).join('');
  w.document.write(`<!doctype html><html lang="pt"><head><meta charset="utf-8"><title>${esc(t.name)}</title>
    <style>
      :root{--field:145 65% 35%;--field-dark:145 65% 25%;--accent:38 92% 50%}
      body{font-family:system-ui,sans-serif;margin:24px;color:#111}
      header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #24558f;margin-bottom:12px}
      h1{font-size:20px;margin:0}.sub{color:#555;font-size:13px}
      .block{display:flex;gap:16px;page-break-inside:avoid;border-bottom:1px solid #ddd;padding:10px 0}
      .diagram{width:240px;flex:none}.diagram svg,.diagram img{width:100%;height:auto}
      h2{font-size:15px;margin:0 0 4px}h2 span{font-weight:400;color:#555;font-size:13px}
      p{font-size:12px;margin:2px 0}.obj{font-size:13px;margin:0 0 8px}
      footer{margin-top:12px;font-size:11px;color:#777}
    </style></head><body>
    <header><h1>${esc(t.name)}</h1><span class="sub">${t.training_date ?? ''} · ${total(t)} min</span></header>
    ${t.objectives ? `<p class="obj"><b>Objetivos:</b> ${esc(t.objectives)}</p>` : ''}
    ${blocks}
    <footer>Plano feito com TreinON.</footer>
    <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
  </body></html>`);
  w.document.close();
}

export function trainingText(t: PlanTraining) {
  return [
    `⚽ *${t.name}* (${total(t)} min)${t.training_date ? ` — ${t.training_date}` : ''}`,
    ...(t.objectives ? ['', `Objetivos: ${t.objectives}`] : []),
    '',
    ...t.exercises.map((e, i) => `${i + 1}. ${e.name} — ${e.duration}'`),
    '',
    'Feito com TreinON',
  ].join('\n');
}

export function TrainingPlanView({ training, open, onClose }: { training: PlanTraining | null; open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open && !!training} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        {training && (
          <>
            <DialogHeader>
              <DialogTitle>{training.name}</DialogTitle>
              <DialogDescription>
                {training.training_date ? `${training.training_date} · ` : ''}{total(training)} min · {training.exercises.length} exercícios
              </DialogDescription>
            </DialogHeader>
            {training.objectives && <p className="text-sm"><span className="font-semibold">Objetivos: </span>{training.objectives}</p>}
            <ol className="space-y-5">
              {training.exercises.map((e, i) => (
                <li key={e.id} className="space-y-2 border-b pb-4 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <h3 className="flex-1 font-semibold">{e.name || 'Exercício'}</h3>
                    <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />{e.duration} min</Badge>
                  </div>
                  {e.diagram && e.diagram.length > 0 ? (
                    <AnimatedDrill elements={e.diagram} anim={e.anim} title={e.name} />
                  ) : e.image_url ? (
                    <img src={e.image_url} alt="" className="max-h-64 rounded-md border" />
                  ) : null}
                  {e.description && <p className="whitespace-pre-line text-sm text-muted-foreground">{e.description}</p>}
                </li>
              ))}
            </ol>
            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => shareText(trainingText(training), training.name)}><Share2 className="mr-1.5 h-4 w-4" />Partilhar</Button>
              <Button onClick={() => printTraining(training)}><Printer className="mr-1.5 h-4 w-4" />Imprimir</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
