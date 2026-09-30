/**
 * Public page: how to install TreinON on iPhone, Android and Windows.
 * Highlights the steps for the device/browser in use.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Check, Copy, Share, SquarePlus, MoreVertical, Download, Compass } from 'lucide-react';
import { currentInstallEnv, type InstallEnv } from '@/lib/install-env';
import { cn } from '@/lib/utils';

const APP_URL = typeof window !== 'undefined' ? window.location.origin : 'https://treinon.vercel.app';

export function CopyLinkButton({ className }: { className?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(APP_URL); } catch {
      const t = document.createElement('textarea'); t.value = APP_URL; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } finally { t.remove(); }
    }
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  };
  return (
    <Button size="sm" variant="outline" onClick={copy} className={className}>
      {done ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
      {done ? 'Link copiado' : 'Copiar link'}
    </Button>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
      <span className="pt-0.5 text-sm">{children}</span>
    </li>
  );
}

export default function Install() {
  const navigate = useNavigate();
  const [env, setEnv] = useState<InstallEnv>('desktop');
  useEffect(() => setEnv(currentInstallEnv()), []);
  const iosActive = env.startsWith('ios');

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl space-y-4 p-4 md:p-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar</Button>
        <div className="flex items-center gap-3">
          <img src="/pwa-192x192.png" alt="" className="h-12 w-12 rounded-xl" />
          <div>
            <h1 className="text-xl font-bold">Instalar o TreinON</h1>
            <p className="text-sm text-muted-foreground">Gratuito. Não passa pela App Store nem pela Play Store: instala-se a partir do navegador.</p>
          </div>
        </div>

        {env === 'installed' && (
          <Card className="border-green-600/40 bg-green-600/5">
            <CardContent className="flex items-center gap-2 p-4 text-sm"><Check className="h-4 w-4 text-green-600" />Já está a usar a app instalada.</CardContent>
          </Card>
        )}

        {env === 'ios-in-app' && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="space-y-3 p-4 text-sm">
              <p className="font-semibold">Está a ver o TreinON dentro de outra app (WhatsApp, Instagram, Gmail, Google…).</p>
              <p>Aí não é possível instalar. Abra primeiro no <strong>Safari</strong>:</p>
              <ol className="space-y-2">
                <Step n={1}>Toque no botão <Compass className="inline h-4 w-4" /> ou nos <strong>⋯</strong> e escolha <strong>Abrir no Safari</strong>.</Step>
                <Step n={2}>Se não aparecer essa opção: copie o link, abra o Safari e cole-o na barra de endereço.</Step>
              </ol>
              <CopyLinkButton />
            </CardContent>
          </Card>
        )}

        <Card className={cn(iosActive && 'ring-2 ring-primary')}>
          <CardHeader className="pb-2"><CardTitle className="text-base">iPhone e iPad</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-2.5">
              <Step n={1}>Abra <strong>{APP_URL.replace(/^https?:\/\//, '')}</strong> no <strong>Safari</strong>. (No Chrome do iPhone também dá: o botão Partilhar está na barra de endereço.)</Step>
              <Step n={2}>Toque em <Share className="inline h-4 w-4 align-text-bottom" /> <strong>Partilhar</strong> (em baixo, ao centro; no iPad, em cima).</Step>
              <Step n={3}>Deslize a lista para baixo e toque em <SquarePlus className="inline h-4 w-4 align-text-bottom" /> <strong>Adicionar ao ecrã principal</strong>. Se não vir, toque em <strong>Editar ações</strong> e adicione-a.</Step>
              <Step n={4}>Confirme <strong>Abrir como app web</strong> ligado e toque em <strong>Adicionar</strong>. O ícone TreinON aparece no ecrã principal.</Step>
            </ol>
            <div className="mt-3 rounded-md bg-muted/60 p-3 text-sm">
              <p className="font-semibold">Não aparece "Adicionar ao ecrã principal"?</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Veja se está em <strong>Navegação Privada</strong> (barra escura): aí a opção não existe. Abra um separador normal.</li>
                <li>No fim da lista do Partilhar, toque em <strong>Editar ações…</strong> e ligue "Adicionar ao ecrã principal".</li>
                <li>No iPad o botão Partilhar está <strong>em cima, à direita</strong>. Também pode tocar no ícone à esquerda do endereço → <strong>Partilhar</strong>.</li>
                <li>Se o iPad tiver <strong>Tempo de ecrã</strong> com restrições, a opção pode estar escondida.</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(env === 'android' && 'ring-2 ring-primary')}>
          <CardHeader className="pb-2"><CardTitle className="text-base">Android</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-2.5">
              <Step n={1}>Abra o endereço no <strong>Chrome</strong>.</Step>
              <Step n={2}>Toque em <strong>Instalar</strong> no aviso que aparece, ou no menu <MoreVertical className="inline h-4 w-4 align-text-bottom" /> → <strong>Instalar app</strong> / <strong>Adicionar ao ecrã principal</strong>.</Step>
            </ol>
          </CardContent>
        </Card>

        <Card className={cn(env === 'desktop' && 'ring-2 ring-primary')}>
          <CardHeader className="pb-2"><CardTitle className="text-base">Windows e Mac (computador)</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-2.5">
              <Step n={1}>Abra o endereço no <strong>Chrome</strong> ou no <strong>Edge</strong>.</Step>
              <Step n={2}>Clique no ícone <Download className="inline h-4 w-4 align-text-bottom" /> <strong>Instalar</strong> no lado direito da barra de endereço (ou menu → <strong>Aplicações</strong> → <strong>Instalar TreinON</strong>).</Step>
            </ol>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm">
          <span className="text-muted-foreground">Enviar o link para outro aparelho:</span>
          <CopyLinkButton />
        </div>
      </div>
    </div>
  );
}
