/**
 * Last line of defence: if anything crashes while starting the app, show what
 * happened and a way out (reload / clear the copy stored on the device) instead of
 * a blank page. The message helps support ("send me a screenshot").
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

async function clearStoredApp(keepLogin: boolean) {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
  } catch { /* ignore */ }
  try {
    const keys = (await caches?.keys?.()) ?? [];
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch { /* ignore */ }
  if (!keepLogin) {
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
  }
  location.reload();
}

export class RootErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[TreinON] erro ao arrancar:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const btn = 'display:block;width:100%;margin:8px 0;padding:12px;border-radius:8px;font-size:16px;border:1px solid #24558f;';
    return (
      <div style={{ fontFamily: '-apple-system, Helvetica, Arial, sans-serif', maxWidth: 480, margin: '10vh auto', padding: '0 16px', color: '#1b2230' }}>
        <h1 style={{ fontSize: 22 }}>O TreinON teve um problema a abrir</h1>
        <p>Tente pela ordem. Se não resolver, envie uma captura deste ecrã.</p>
        <button style={parse(btn + 'background:#24558f;color:#fff')} onClick={() => location.reload()}>1. Recarregar</button>
        <button style={parse(btn + 'background:#fff;color:#24558f')} onClick={() => clearStoredApp(true)}>2. Limpar a cópia guardada neste aparelho</button>
        <button style={parse(btn + 'background:#fff;color:#b42318;border-color:#b42318')} onClick={() => clearStoredApp(false)}>3. Limpar tudo e voltar a entrar</button>
        <p style={{ fontSize: 12, color: '#666', wordBreak: 'break-word' }}>
          Detalhe: {error.message}
          <br />
          {navigator.userAgent}
        </p>
      </div>
    );
  }
}

function parse(css: string): React.CSSProperties {
  const out: Record<string, string> = {};
  css.split(';').filter(Boolean).forEach((d) => {
    const [k, v] = d.split(':');
    out[k.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = v.trim();
  });
  return out as React.CSSProperties;
}
