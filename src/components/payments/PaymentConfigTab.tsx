import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  useClubPaymentSettings,
  useUpdatePaymentSettings,
  useCreateConnectAccount,
  useCreateOnboardingLink,
  useSyncConnectAccount,
  useDisconnectAccount,
  PaymentMode,
} from '@/hooks/useClubPaymentSettings';
import {
  Settings, Wifi, WifiOff, CreditCard, Building2, RefreshCw, ExternalLink,
  CheckCircle2, AlertTriangle, XCircle, Info, Unplug
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface Props { clubId: string; }

const MODES: { value: PaymentMode; label: string; desc: string; icon: any }[] = [
  {
    value: 'offline_manual',
    label: 'Sem pagamentos online',
    desc: 'O clube opera apenas com registos manuais: numerário, transferência, MB Way manual, terminal, etc. Cobranças, conta corrente e reconciliação continuam funcionais.',
    icon: WifiOff,
  },
  {
    value: 'stripe_connect',
    label: 'Stripe Connect',
    desc: 'O clube liga a sua própria conta Stripe através da plataforma. Os pagamentos entram diretamente na conta do clube, não numa conta central.',
    icon: CreditCard,
  },
  {
    value: 'stripe_direct',
    label: 'Stripe Direto (futuro)',
    desc: 'Preparado para configurações Stripe fora do modelo Connect. Disponível numa fase posterior.',
    icon: Building2,
  },
];

const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  not_configured: { icon: Info, color: 'text-muted-foreground', label: 'Não configurado' },
  pending: { icon: AlertTriangle, color: 'text-amber-600', label: 'Pendente' },
  active: { icon: CheckCircle2, color: 'text-green-600', label: 'Ativo' },
  suspended: { icon: XCircle, color: 'text-red-600', label: 'Suspenso' },
  error: { icon: XCircle, color: 'text-red-600', label: 'Erro' },
};

const ONBOARDING_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  not_started: { label: 'Não iniciado', variant: 'outline' },
  pending: { label: 'Em progresso', variant: 'secondary' },
  complete: { label: 'Completo', variant: 'default' },
  restricted: { label: 'Restrito', variant: 'destructive' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
};

export function PaymentConfigTab({ clubId }: Props) {
  const { data, isLoading } = useClubPaymentSettings(clubId);
  const updateSettings = useUpdatePaymentSettings(clubId);
  const createAccount = useCreateConnectAccount(clubId);
  const createOnboarding = useCreateOnboardingLink(clubId);
  const syncAccount = useSyncConnectAccount(clubId);
  const disconnectAccount = useDisconnectAccount(clubId);
  const [showDisconnect, setShowDisconnect] = useState(false);

  if (isLoading) return <Skeleton className="h-96" />;

  const settings = data?.settings;
  const account = data?.account;
  const currentMode = settings?.payment_mode || 'offline_manual';
  const configStatus = settings?.configuration_status || 'not_configured';
  const statusInfo = STATUS_CONFIG[configStatus] || STATUS_CONFIG.not_configured;

  const handleModeChange = (mode: PaymentMode) => {
    if (mode === 'stripe_direct') return; // Not yet available
    updateSettings.mutate({ payment_mode: mode });
  };

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Pagamentos online são opcionais.</strong> Cada clube escolhe como quer cobrar.
          O sistema de cobranças, conta corrente e reconciliação funciona em qualquer modo.
          {currentMode === 'stripe_connect' && ' Com Stripe Connect, o dinheiro entra diretamente na conta do clube.'}
        </AlertDescription>
      </Alert>

      {/* Status overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Estado da Integração
            </CardTitle>
            <CardDescription>Modo atual de pagamentos do clube</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <statusInfo.icon className={`w-5 h-5 ${statusInfo.color}`} />
            <Badge variant={configStatus === 'active' ? 'default' : 'secondary'}>
              {statusInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Modo</span>
              <p className="font-medium capitalize">{currentMode.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Provider</span>
              <p className="font-medium capitalize">{settings?.provider || 'Nenhum'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Online</span>
              <p className="font-medium">{settings?.allow_online_payments ? 'Ativo' : 'Desativado'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Manual</span>
              <p className="font-medium">{settings?.allow_manual_payments !== false ? 'Ativo' : 'Desativado'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mode selector */}
      <div>
        <h3 className="font-semibold mb-3">Escolher Modo de Pagamentos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MODES.map(({ value, label, desc, icon: Icon }) => {
            const isSelected = currentMode === value;
            const isDisabled = value === 'stripe_direct';
            return (
              <Card
                key={value}
                className={`cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-primary border-primary' : ''
                } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50'}`}
                onClick={() => !isDisabled && handleModeChange(value)}
              >
                <CardContent className="py-5">
                  <div className="flex items-start gap-3">
                    <Icon className={`w-6 h-6 mt-0.5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div className="space-y-1">
                      <p className="font-semibold text-sm flex items-center gap-2">
                        {label}
                        {isDisabled && <Badge variant="outline" className="text-xs">Em breve</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Stripe Connect panel */}
      {currentMode === 'stripe_connect' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Stripe Connect
            </CardTitle>
            <CardDescription>
              Ligue a conta Stripe do seu clube. O dinheiro dos pagamentos vai diretamente para a conta do clube.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {account ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Conta</span>
                    <p className="font-mono text-xs">{account.external_account_id?.substring(0, 20)}...</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Onboarding</span>
                    <Badge variant={ONBOARDING_STATUS[account.onboarding_status]?.variant || 'outline'}>
                      {ONBOARDING_STATUS[account.onboarding_status]?.label || account.onboarding_status}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cobranças</span>
                    <p className={`font-medium ${account.charges_enabled ? 'text-green-600' : 'text-amber-600'}`}>
                      {account.charges_enabled ? 'Ativas' : 'Inativas'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pagamentos</span>
                    <p className={`font-medium ${account.payouts_enabled ? 'text-green-600' : 'text-amber-600'}`}>
                      {account.payouts_enabled ? 'Ativos' : 'Inativos'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {account.onboarding_status !== 'complete' && (
                    <Button size="sm" onClick={() => createOnboarding.mutate()} disabled={createOnboarding.isPending}>
                      <ExternalLink className="w-4 h-4 mr-1" />
                      {account.onboarding_status === 'not_started' ? 'Iniciar Onboarding' : 'Retomar Onboarding'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => syncAccount.mutate()} disabled={syncAccount.isPending}>
                    <RefreshCw className={`w-4 h-4 mr-1 ${syncAccount.isPending ? 'animate-spin' : ''}`} />
                    Sincronizar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setShowDisconnect(true)}>
                    <Unplug className="w-4 h-4 mr-1" />Desconectar
                  </Button>
                </div>

                {account.last_sync_at && (
                  <p className="text-xs text-muted-foreground">
                    Última sincronização: {new Date(account.last_sync_at).toLocaleString('pt-PT')}
                  </p>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <CreditCard className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  Nenhuma conta Stripe Connect configurada. Crie uma para começar a aceitar pagamentos online.
                </p>
                <Button onClick={() => createAccount.mutate()} disabled={createAccount.isPending}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  {createAccount.isPending ? 'A criar...' : 'Criar Conta Stripe Connect'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Disconnect dialog */}
      <Dialog open={showDisconnect} onOpenChange={setShowDisconnect}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar Stripe Connect</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Isto irá mudar o modo para "Sem pagamentos online". Pagamentos existentes não serão afetados.
            Pode reconectar mais tarde.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisconnect(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { disconnectAccount.mutate(); setShowDisconnect(false); }}>
              Confirmar Desconexão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
