/**
 * Settings → Apagar a minha conta. Shows what will happen first:
 *  - what belongs to a club stays with the club;
 *  - what the person had outside any club is deleted (a backup can be downloaded first);
 *  - the owner of a club has to hand it over before.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;
interface Preview { owned_clubs: string[]; club_teams: number; own_teams: number; own_players: number; own_matches: number }

export function DeleteAccountCard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: preview } = useQuery({
    queryKey: ['account-deletion-preview', user?.id],
    enabled: open && !!user,
    queryFn: async () => ((await db.rpc('account_deletion_preview')).data ?? null) as Preview | null,
  });

  const remove = async () => {
    setBusy(true);
    const { error } = await db.rpc('delete_my_account', { _confirm: word.trim().toUpperCase() });
    setBusy(false);
    if (error) return toast.error(error.message);
    await signOut().catch(() => {});
    toast.success('A sua conta foi apagada.');
    navigate('/auth', { replace: true });
  };

  return (
    <Card className="border-destructive/40">
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Apagar a minha conta</p>
          <p className="text-xs text-muted-foreground">Apaga a sua conta e os dados que tem fora de clubes. O que é de um clube fica no clube.</p>
        </div>
        <Button variant="outline" className="text-destructive" onClick={() => { setWord(''); setOpen(true); }}><Trash2 className="mr-1.5 h-4 w-4" />Apagar conta</Button>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apagar a conta</DialogTitle>
            <DialogDescription>Não é possível desfazer.</DialogDescription>
          </DialogHeader>
          {!preview ? <p className="text-sm text-muted-foreground">A verificar…</p> : preview.owned_clubs.length > 0 ? (
            <p className="text-sm">É dono de <strong>{preview.owned_clubs.join(', ')}</strong>. Antes de apagar a conta, passe o clube a outra pessoa (fale connosco ou com a direção do clube).</p>
          ) : (
            <div className="space-y-3 text-sm">
              <ul className="list-disc space-y-1 pl-5">
                {preview.own_teams > 0
                  ? <li>São apagadas as suas <strong>{preview.own_teams} {preview.own_teams === 1 ? 'equipa' : 'equipas'}</strong> fora de clubes, com {preview.own_players} {preview.own_players === 1 ? 'jogador' : 'jogadores'} e {preview.own_matches} {preview.own_matches === 1 ? 'jogo' : 'jogos'}. Se quiser guardá-los, descarregue primeiro a cópia de segurança (mais acima nesta página).</li>
                  : <li>Não tem equipas fora de clubes.</li>}
                {preview.club_teams > 0 && <li>As {preview.club_teams} {preview.club_teams === 1 ? 'equipa' : 'equipas'} de clube que criou ficam no clube, com os jogadores, jogos e treinos.</li>}
                <li>Deixa de pertencer às equipas técnicas e aos clubes onde estava.</li>
              </ul>
              <div>
                <Label htmlFor="del-word">Para confirmar, escreva APAGAR</Label>
                <Input id="del-word" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            {preview && preview.owned_clubs.length === 0 && (
              <Button variant="destructive" disabled={busy || word.trim().toUpperCase() !== 'APAGAR'} onClick={remove}>Apagar a conta</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
