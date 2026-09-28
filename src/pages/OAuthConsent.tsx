import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Pedido de autorização inválido (falta authorization_id).");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/auth?next=${encodeURIComponent(next)}`;
        return;
      }
      setEmail(sess.session.user.email ?? null);
      try {
        const { data, error: err } = await oauth.getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (err) {
          setError(err.message);
          return;
        }
        const immediate = data?.redirect_url ?? data?.redirect_to;
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e: any) {
        if (active) setError(e?.message ?? "Erro inesperado.");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    try {
      const { data, error: err } = approve
        ? await oauth.approveAuthorization(authorizationId)
        : await oauth.denyAuthorization(authorizationId);
      if (err) {
        setBusy(false);
        setError(err.message);
        return;
      }
      const target = data?.redirect_url ?? data?.redirect_to;
      if (!target) {
        setBusy(false);
        setError("O servidor de autorização não devolveu um destino de redirecionamento.");
        return;
      }
      window.location.href = target;
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Erro inesperado.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        {error ? (
          <>
            <CardHeader>
              <CardTitle>Não foi possível autorizar</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
          </>
        ) : !details ? (
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </CardContent>
        ) : (
          <>
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <CardTitle>
                Ligar {details.client?.name ?? "aplicação"} ao TreinON
              </CardTitle>
              <CardDescription>
                {details.client?.name ?? "Esta aplicação"} vai poder usar as ferramentas do TreinON em teu nome.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-1">
                {email && (
                  <p className="text-muted-foreground">
                    Conta: <span className="text-foreground font-medium">{email}</span>
                  </p>
                )}
                {details.client?.redirect_uri && (
                  <p className="text-muted-foreground break-all">
                    Redireciona para: <span className="text-foreground">{details.client.redirect_uri}</span>
                  </p>
                )}
                {details.scope && (
                  <p className="text-muted-foreground">
                    Permissões pedidas: <span className="text-foreground">{details.scope}</span>
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Isto não contorna as permissões da aplicação nem as políticas de acesso do teu clube.
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Aprovar
                </Button>
                <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                  Cancelar ligação
                </Button>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
