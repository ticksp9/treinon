/**
 * After "Golo" for a player selected on the pitch: one tap to say who assisted.
 * The goal is never lost: closing the dialog any other way records it without an assist;
 * only "Não foi golo" cancels it.
 */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Teammate { id: string; name: string; number: number | null }
interface Props {
  scorerName: string | null;
  minute: number;
  teammates: Teammate[];
  /** assistId null = no assist */
  onConfirm: (assistId: string | null) => void;
  onCancelGoal: () => void;
}

export function AssistDialog({ scorerName, minute, teammates, onConfirm, onCancelGoal }: Props) {
  return (
    <Dialog open={scorerName != null} onOpenChange={(o) => { if (!o) onConfirm(null); }}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>⚽ Golo de {scorerName} · {minute}'</DialogTitle>
          <DialogDescription>Quem fez a assistência?</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {teammates.map((t) => (
            <Button key={t.id} variant="outline" className="h-12 justify-start gap-2 px-3" onClick={() => onConfirm(t.id)}>
              <span className="w-6 shrink-0 text-right font-mono text-sm text-muted-foreground">{t.number ?? '–'}</span>
              <span className="truncate">{t.name}</span>
            </Button>
          ))}
        </div>
        <Button className="h-12" onClick={() => onConfirm(null)}>Sem assistência</Button>
        <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onCancelGoal}>Não foi golo (cancelar)</Button>
      </DialogContent>
    </Dialog>
  );
}
