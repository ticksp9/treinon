import { ReactNode, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Lock, AlertTriangle } from 'lucide-react';
import { useSecurityPin } from '@/hooks/useSecurityPin';
import { PinDialog } from './PinDialog';

interface SensitiveDataGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
  showSetupPrompt?: boolean;
  className?: string;
}

export function SensitiveDataGuard({ 
  children, 
  fallback, 
  showSetupPrompt = true,
  className 
}: SensitiveDataGuardProps) {
  const { hasPin, isPinVerified, loading, createPin, verifyPin } = useSecurityPin();
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'create' | 'verify'>('verify');

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  // If no PIN is set, show setup prompt or fallback
  if (!hasPin) {
    if (!showSetupPrompt) {
      return <>{children}</>;
    }

    return (
      <>
        <Card className={className}>
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-4 bg-warning/10 rounded-full">
                <AlertTriangle className="w-8 h-8 text-warning" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Dados Sensíveis Não Protegidos</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure um PIN de segurança para proteger os dados pessoais dos jogadores
                  (morada, contactos, documentos).
                </p>
              </div>
              <Button onClick={() => {
                setDialogMode('create');
                setShowPinDialog(true);
              }}>
                <Shield className="w-4 h-4 mr-2" />
                Configurar PIN de Segurança
              </Button>
            </div>
          </CardContent>
        </Card>

        <PinDialog
          open={showPinDialog}
          onOpenChange={setShowPinDialog}
          mode={dialogMode}
          onSubmit={createPin}
        />
      </>
    );
  }

  // If PIN is set but not verified, show lock screen
  if (!isPinVerified) {
    return (
      <>
        <Card className={className}>
          <CardContent className="py-8">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <Lock className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Dados Protegidos</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Introduza o PIN de segurança para ver os dados pessoais.
                </p>
              </div>
              <Button onClick={() => {
                setDialogMode('verify');
                setShowPinDialog(true);
              }}>
                <Lock className="w-4 h-4 mr-2" />
                Desbloquear
              </Button>
              {fallback && (
                <div className="w-full mt-4 pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-2">
                    Dados visíveis sem PIN:
                  </p>
                  {fallback}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <PinDialog
          open={showPinDialog}
          onOpenChange={setShowPinDialog}
          mode="verify"
          onSubmit={verifyPin}
        />
      </>
    );
  }

  // PIN verified, show children
  return <>{children}</>;
}
