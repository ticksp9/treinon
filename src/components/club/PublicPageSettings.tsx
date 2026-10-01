/** Club admin: turn the public club page on/off and choose its address. */
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Copy, ExternalLink, Globe, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { copyText, shareText } from '@/lib/share';

export const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export function PublicPageSettings({ club, clubId }: { club: { name?: string; public_slug?: string | null; public_page_enabled?: boolean } | null; clubId: string }) {
  const qc = useQueryClient();
  const [slug, setSlug] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setSlug(club?.public_slug || slugify(club?.name || ''));
    setEnabled(!!club?.public_page_enabled);
  }, [club?.public_slug, club?.public_page_enabled, club?.name]);

  const url = `${window.location.origin}/c/${slug}`;
  const save = async (nextEnabled = enabled) => {
    const clean = slugify(slug);
    if (clean.length < 3) return toast.error('O endereço precisa de pelo menos 3 letras.');
    setSaving(true);
    const { error } = await supabase.from('clubs').update({ public_slug: clean, public_page_enabled: nextEnabled } as never).eq('id', clubId);
    setSaving(false);
    if (error) return toast.error(error.message.includes('clubs_public_slug_key') ? 'Esse endereço já está a ser usado por outro clube.' : 'Não foi possível guardar: ' + error.message);
    setSlug(clean); setEnabled(nextEnabled);
    qc.invalidateQueries({ queryKey: ['club-profile', clubId] });
    toast.success(nextEnabled ? 'Página pública ativa.' : 'Página pública desligada.');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4" />Página pública do clube</CardTitle>
        <CardDescription>
          Um mini-site gratuito com o emblema, as cores, as equipas, os próximos jogos e os resultados, para partilhar com pais, sócios e patrocinadores.
          Não mostra jogadores nem dados pessoais.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
          <span className="font-medium">Página ativa</span>
          <Switch checked={enabled} disabled={saving} onCheckedChange={(v) => save(v)} />
        </label>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Endereço</p>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-muted-foreground">{window.location.host}/c/</span>
            <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} onBlur={() => setSlug(slugify(slug))} maxLength={40} />
            <Button variant="outline" onClick={() => save()} disabled={saving}>Guardar</Button>
          </div>
        </div>
        {enabled && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" />Abrir</a></Button>
            <Button size="sm" variant="outline" onClick={async () => { if (await copyText(url)) toast.success('Endereço copiado'); }}><Copy className="mr-1.5 h-4 w-4" />Copiar</Button>
            <Button size="sm" variant="outline" onClick={() => shareText(`${club?.name ?? 'O nosso clube'}: jogos e resultados\n${url}`, club?.name ?? 'Clube')}><Share2 className="mr-1.5 h-4 w-4" />Partilhar</Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">O emblema, as cores, a história e as redes sociais vêm do separador Perfil.</p>
      </CardContent>
    </Card>
  );
}
