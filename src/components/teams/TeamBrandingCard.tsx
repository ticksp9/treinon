/**
 * Team page → Símbolo e cores: upload the crest and choose the two colours of the app while
 * working with this team. "Usar as cores do símbolo" reads them from the crest itself.
 */
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, ImageUp, Palette, RotateCcw, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { BRANDING_KEY, TeamCrest } from '@/hooks/useTeamBranding';
import { useActiveTeam } from '@/hooks/useActiveTeam';
import { colorsOfImage, isHex, shrinkImage, textOn, usableShade, type TeamTheme } from '@/lib/team-branding';
import { tx } from '@/lib/i18n/ui';

const DEFAULT = { primary: '#265a8f', accent: '#ef6c0c' };

function Swatch({ hex, label }: { hex: string; label: string }) {
  const [h, s, l] = usableShade(hex, 'light');
  const light = textOn(h, s, l) === 'light';
  return (
    <span className="inline-flex h-9 items-center rounded-md px-3 text-sm font-medium" style={{ background: `hsl(${h} ${s}% ${l}%)`, color: light ? '#fff' : '#0b1220' }}>{label}</span>
  );
}

export function TeamBrandingCard({ team }: { team: { id: string; name: string; crest_url?: string | null; theme?: TeamTheme | null } }) {
  const qc = useQueryClient();
  const file = useRef<HTMLInputElement>(null);
  const [crest, setCrest] = useState<string | null>(team.crest_url ?? null);
  const [primary, setPrimary] = useState(isHex(team.theme?.primary) ? team.theme!.primary! : '');
  const [accent, setAccent] = useState(isHex(team.theme?.accent) ? team.theme!.accent! : '');
  const [busy, setBusy] = useState(false);
  const { myTeams, activeTeam, chooseTeamId } = useActiveTeam();
  const isActive = activeTeam?.id === team.id;
  // my other teams where I am in charge (an assistant does not change crests)
  const others = myTeams.filter((t) => t.id !== team.id && t.my_role !== 'assistant_coach');
  useEffect(() => { setCrest(team.crest_url ?? null); }, [team.crest_url]);

  const refresh = () => { qc.invalidateQueries({ queryKey: [BRANDING_KEY] }); qc.invalidateQueries({ queryKey: ['team', team.id] }); };
  const save = async (patch: Record<string, unknown>, ok: string) => {
    const { data, error } = await supabase.from('teams').update(patch as never).eq('id', team.id).select('id');
    if (error) { toast.error(tx('Não foi possível guardar: ') + error.message); return false; }
    if (!data?.length) { toast.error(tx('Só o treinador principal (ou o administrador do clube) muda o símbolo e as cores.')); return false; }
    refresh(); toast.success(ok); return true;
  };

  const suggest = async (src: string, quiet = false) => {
    try {
      const [a, b] = await colorsOfImage(src);
      if (!a) { if (!quiet) toast.info(tx('Não encontrei cores fortes no símbolo. Escolha-as à mão.')); return; }
      setPrimary(a); if (b) setAccent(b);
      if (!quiet) toast.info(tx('Cores tiradas do símbolo. Veja como ficam e carregue em Guardar cores.'));
    } catch { if (!quiet) toast.error(tx('Não foi possível ler as cores do símbolo.')); }
  };

  const upload = async (f: File) => {
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return toast.error(tx('Use uma imagem PNG, JPG ou WebP.'));
    setBusy(true);
    try {
      const blob = await shrinkImage(f);
      const path = `teams/${team.id}/crest-${Date.now()}.png`;
      const { error } = await supabase.storage.from('crests').upload(path, blob, { contentType: 'image/png', upsert: false });
      if (error) { toast.error(error.message.includes('row-level') ? tx('Só o treinador principal (ou o administrador do clube) muda o símbolo.') : tx('Não foi possível carregar o símbolo: ') + error.message); return; }
      const url = supabase.storage.from('crests').getPublicUrl(path).data.publicUrl;
      if (await save({ crest_url: url }, 'Símbolo guardado.')) {
        setCrest(url);
        // first crest and no colours yet: offer the crest's own colours
        if (!primary) { const local = URL.createObjectURL(blob); await suggest(local, true); URL.revokeObjectURL(local); }
      }
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); if (file.current) file.current.value = ''; }
  };

  const removeCrest = async () => {
    if (!window.confirm(tx('Tirar o símbolo desta equipa?'))) return;
    if (await save({ crest_url: null }, 'Símbolo retirado.')) setCrest(null);
  };
  const saveColors = () => save({ theme: { primary: isHex(primary) ? primary : null, accent: isHex(accent) ? accent : null } },
    isActive ? 'Cores guardadas. A app já está com as cores da equipa.' : `Cores guardadas para ${team.name}. Aparecem quando trabalhar com esta equipa.`);

  // the same club, the same crest: copy this look to my other teams in one go
  const copyToOthers = async () => {
    if (!others.length || !window.confirm(tx('Usar este símbolo e estas cores também em: {{v0}}?', { v0: others.map((t) => t.name).join(', ') }))) return;
    const theme = { primary: isHex(primary) ? primary : null, accent: isHex(accent) ? accent : null };
    const { data, error } = await supabase.from('teams').update({ crest_url: crest, theme } as never).in('id', others.map((t) => t.id)).select('id');
    if (error) return toast.error(tx('Não foi possível copiar: ') + error.message);
    refresh();
    toast.success(tx('Símbolo e cores aplicados em {{v0}} {{v1}}.', { v0: data?.length ?? 0, v1: data?.length === 1 ? 'equipa' : 'equipas' }));
  };
  const resetColors = async () => { if (await save({ theme: null }, 'Voltou às cores do TreinON.')) { setPrimary(''); setAccent(''); } };

  const p = isHex(primary) ? primary : DEFAULT.primary;
  const a = isHex(accent) ? accent : DEFAULT.accent;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold"><Palette className="h-4 w-4 text-primary" />{tx('Símbolo e cores')}</p>
          <p className="text-xs text-muted-foreground">{tx('O símbolo aparece no topo da app, no jogo em direto e nas folhas em PDF. As cores mudam a app enquanto trabalha com esta equipa.')}</p>
        </div>

        {!isActive && activeTeam && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-accent/50 bg-accent/10 p-2 text-sm">
            <span className="min-w-0 flex-1">{tx('Está a trabalhar com')}{' '}<strong>{activeTeam.name}</strong>{tx('. As cores e o símbolo de')}{' '}{team.name} {tx('aparecem na app quando mudar para esta equipa.')}</span>
            <Button size="sm" variant="outline" onClick={() => chooseTeamId(team.id)}>{tx('Trabalhar com')}{' '}{team.name}</Button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-lg border bg-muted/30 p-1.5">
            <TeamCrest url={crest} name={team.name} className="h-full w-full" />
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button size="sm" variant="outline" onClick={() => file.current?.click()} disabled={busy}><ImageUp className="mr-1.5 h-4 w-4" />{crest ? tx('Trocar símbolo') : tx('Carregar símbolo')}</Button>
            {crest && <Button size="sm" variant="outline" onClick={() => suggest(crest)}><Wand2 className="mr-1.5 h-4 w-4" />{tx('Usar as cores do símbolo')}</Button>}
            {crest && <Button size="sm" variant="ghost" className="text-destructive" onClick={removeCrest}><Trash2 className="mr-1.5 h-4 w-4" />{tx('Tirar')}</Button>}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {([['Cor principal', primary, setPrimary, DEFAULT.primary, 'botões, menu, destaques'], ['Cor de realce', accent, setAccent, DEFAULT.accent, 'avisos e pormenores']] as const).map(([label, value, set, def, hint]) => (
            <div key={label} className="space-y-1">
              <Label>{label} <span className="font-normal text-muted-foreground">({hint})</span></Label>
              <div className="flex items-center gap-2">
                <input type="color" value={isHex(value) ? value : def} onChange={(e) => set(e.target.value)} className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5" aria-label={label} />
                <Input className="h-9 w-28 font-mono" maxLength={7} value={value} placeholder={def} onChange={(e) => set(e.target.value.trim())} aria-label={tx('{{v0}} (código)', { v0: label })} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
          <span className="text-xs text-muted-foreground">{tx('Pré-visualização:')}</span>
          <Swatch hex={p} label={tx('Guardar')} />
          <Swatch hex={a} label={tx('Aviso')} />
          <span className="text-sm font-semibold" style={{ color: `hsl(${usableShade(p, 'light').map((v, i) => (i ? `${v.toFixed(0)}%` : v.toFixed(0))).join(' ')})` }}>{tx('Texto em destaque')}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={saveColors} disabled={(!!primary && !isHex(primary)) || (!!accent && !isHex(accent))}>{tx('Guardar cores')}</Button>
          {others.length > 0 && (crest || isHex(primary)) && <Button size="sm" variant="outline" onClick={copyToOthers}><Copy className="mr-1.5 h-4 w-4" />{tx('Usar também nas outras equipas')}</Button>}
          {(team.theme?.primary || team.theme?.accent) && <Button size="sm" variant="ghost" onClick={resetColors}><RotateCcw className="mr-1.5 h-4 w-4" />{tx('Voltar às cores do TreinON')}</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
