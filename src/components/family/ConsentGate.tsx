/**
 * Parents' consent (RGPD). The first time a parent opens the app (and again if the notice
 * changes) he must accept the data processing for each child before going on; the use of
 * image is a separate choice he can change at any time ("Privacidade" on the Eventos screen).
 */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useUserRole } from '@/hooks/useUserRole';
import { NOTICE_POINTS, POLICY_VERSION, controllerName, pendingConsents, type ChildConsent } from '@/lib/consent';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any; // newer than the generated types

export function useChildrenConsents() {
  const { user } = useAuth();
  const { isGuardian, loading } = useUserRole();
  return useQuery({
    queryKey: ['children-consents', user?.id],
    enabled: !!user && !loading && isGuardian,
    queryFn: async () => {
      const { data, error } = await db.rpc('my_children_consents');
      if (error) throw error;
      return (data ?? []) as ChildConsent[];
    },
  });
}

interface DialogProps {
  open: boolean;
  children: ChildConsent[];
  /** true = first time / new notice: cannot be dismissed without accepting */
  required: boolean;
  onClose: () => void;
}

export function ConsentDialog({ open, children, required, onClose }: DialogProps) {
  const { user, signOut } = useAuth();
  const qc = useQueryClient();
  const [accept, setAccept] = useState<Record<string, boolean>>({});
  const [image, setImage] = useState<Record<string, boolean | null>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAccept(Object.fromEntries(children.map((c) => [c.player_id, c.data_processing && c.policy_version === POLICY_VERSION])));
    setImage(Object.fromEntries(children.map((c) => [c.player_id, c.image_use])));
  }, [open, children]);

  const allAccepted = children.every((c) => accept[c.player_id]);
  const save = async () => {
    if (!user) return;
    if (!allAccepted) return toast.error('Para continuar tem de autorizar o tratamento dos dados de cada educando.');
    setSaving(true);
    const { error } = await db.from('guardian_consents').upsert(
      children.map((c) => ({ player_id: c.player_id, user_id: user.id, policy_version: POLICY_VERSION, data_processing: true, image_use: image[c.player_id] ?? null })),
      { onConflict: 'player_id,user_id' });
    setSaving(false);
    if (error) return toast.error('Não foi possível guardar: ' + error.message);
    toast.success('Consentimento guardado.');
    qc.invalidateQueries({ queryKey: ['children-consents'] });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !required) onClose(); }}>
      <DialogContent
        className={cn('max-h-[92vh] max-w-xl overflow-y-auto', required && '[&>button]:hidden')}
        onInteractOutside={(e) => required && e.preventDefault()}
        onEscapeKeyDown={(e) => required && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Privacidade e consentimento</DialogTitle>
          <DialogDescription>
            {required
              ? 'Antes de continuar, precisamos da sua autorização, como encarregado de educação, para tratar os dados de cada educando.'
              : 'Pode rever aqui o que autorizou e mudar a sua escolha sobre o uso de imagem.'}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
          {NOTICE_POINTS.map((p) => (
            <div key={p.title}>
              <dt className="font-semibold">{p.title}</dt>
              <dd className="text-muted-foreground">{p.text}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-3">
          {children.map((c) => (
            <div key={c.player_id} className="space-y-2.5 rounded-md border p-3">
              <p className="font-medium">{c.player_name}<span className="font-normal text-muted-foreground">{c.team_name ? ` · ${c.team_name}` : ''}</span></p>
              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox className="mt-0.5" checked={!!accept[c.player_id]} onCheckedChange={(v) => setAccept((a) => ({ ...a, [c.player_id]: v === true }))} />
                <span>Autorizo que {controllerName(c)} trate os dados de <b>{c.player_name}</b> para os fins acima. <span className="text-destructive">(obrigatório)</span></span>
              </label>
              <div className="text-sm">
                <p className="mb-1.5 flex items-center gap-1.5"><Camera className="h-4 w-4 shrink-0 text-muted-foreground" />Fotografias e vídeos de treinos e jogos em que apareça (redes sociais e página do clube):</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" variant={image[c.player_id] === true ? 'default' : 'outline'} className="h-8" onClick={() => setImage((m) => ({ ...m, [c.player_id]: true }))} aria-pressed={image[c.player_id] === true}>Autorizo</Button>
                  <Button type="button" size="sm" variant="outline" className={cn('h-8', image[c.player_id] === false && 'border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground')} onClick={() => setImage((m) => ({ ...m, [c.player_id]: false }))} aria-pressed={image[c.player_id] === false}>Não autorizo</Button>
                  {image[c.player_id] == null && <span className="self-center text-xs text-muted-foreground">Opcional. Sem resposta conta como não autorizado.</span>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {required
            ? <Button variant="ghost" onClick={() => signOut()}>Não aceito (sair)</Button>
            : <Button variant="outline" onClick={onClose}>Fechar</Button>}
          <Button onClick={save} disabled={saving || !allAccepted}>{saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{required ? 'Aceitar e continuar' : 'Guardar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Mounted once in the app layout: blocks a parent until the consent for every child is given. */
export function ConsentGate() {
  const { data: children = [] } = useChildrenConsents();
  const pending = pendingConsents(children);
  if (pending.length === 0) return null;
  return <ConsentDialog open required children={pending} onClose={() => {}} />;
}
