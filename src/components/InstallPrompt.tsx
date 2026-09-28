import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'treinon_install_dismissed_at';
const DISMISS_DAYS = 14;

function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Offers to install TreinON as an app:
 * - Android / Windows / ChromeOS (Chrome, Edge): native install prompt
 * - iPhone / iPad (Safari): short instructions, since iOS has no install prompt
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [hidden, setHidden] = useState(() => isStandalone() || recentlyDismissed());

  useEffect(() => {
    if (hidden) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (isIOS()) setShowIOS(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [hidden]);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setHidden(true);
  };

  if (hidden || (!deferred && !showIOS)) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:right-auto sm:max-w-sm z-50 rounded-lg border bg-background p-3 shadow-lg">
      <div className="flex items-start gap-3">
        <img src="/pwa-192x192.png" alt="" className="h-10 w-10 rounded-md" />
        <div className="flex-1 text-sm">
          <p className="font-semibold">Instalar TreinON</p>
          {deferred ? (
            <p className="text-muted-foreground">Abre como uma app, mais rápido e funciona no campo sem rede.</p>
          ) : (
            <p className="text-muted-foreground">
              Toque em <Share className="inline h-4 w-4 align-text-bottom" /> <strong>Partilhar</strong> e depois em{' '}
              <strong>Adicionar ao ecrã principal</strong>.
            </p>
          )}
          {deferred && (
            <Button
              size="sm"
              className="mt-2"
              onClick={async () => {
                await deferred.prompt();
                const { outcome } = await deferred.userChoice;
                setDeferred(null);
                if (outcome === 'accepted') setHidden(true);
              }}
            >
              <Download className="mr-1 h-4 w-4" />
              Instalar
            </Button>
          )}
        </div>
        <button onClick={dismiss} aria-label="Fechar" className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
