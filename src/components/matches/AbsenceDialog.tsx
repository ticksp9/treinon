/**
 * A called-up player did not come (ill, injured, no-show). One tap takes him out of the
 * match so he is not sitting on the bench of the live game. Before kick-off anyone can be
 * taken out; after it, only a substitute who never came on.
 */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useT, tr } from '@/lib/i18n/ui';

export const ABSENCE_REASONS = [tr('Doença'), tr('Lesão'), tr('Não compareceu'), tr('Motivo pessoal')] as const;

interface Props {
  playerName: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}

export function AbsenceDialog({ playerName, onConfirm, onClose }: Props) {
  const t = useT();
  return (
    <Dialog open={playerName != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('Retirar {{name}} do jogo', { name: playerName })}</DialogTitle>
          <DialogDescription>
            {t('Sai da convocatória deste jogo e não aparece no banco. Pode voltar a convocá-lo na lista "Não convocados".')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {ABSENCE_REASONS.map((r) => (
            <Button key={r} variant="outline" className="h-12" onClick={() => onConfirm(r)}>{t(r)}</Button>
          ))}
        </div>
        <Button variant="ghost" onClick={() => onConfirm('')}>{t('Retirar sem indicar motivo')}</Button>
      </DialogContent>
    </Dialog>
  );
}
