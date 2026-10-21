import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Lock, Unlock, Settings, Trash2 } from 'lucide-react';
import { useSecurityPin } from '@/hooks/useSecurityPin';
import { PinDialog } from './PinDialog';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { tx } from '@/lib/i18n/ui';

export function SecurityPinSettings() {
  const { hasPin, isPinVerified, createPin, changePin, deletePin, lockSensitiveData } = useSecurityPin();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeletePinDialog, setShowDeletePinDialog] = useState(false);

  const handleDeletePin = async (pin: string) => {
    const result = await deletePin(pin);
    if (result.success) {
      toast.success(tx('PIN eliminado com sucesso'));
      setShowDeletePinDialog(false);
    }
    return result;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {tx('Segurança de Dados Pessoais')}
          </CardTitle>
          <CardDescription>
            {tx('Configure um PIN para proteger dados sensíveis dos jogadores (morada, contactos, documentos de identificação).')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              {hasPin ? (
                <>
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Lock className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{tx('PIN de Segurança Ativo')}</p>
                    <p className="text-sm text-muted-foreground">
                      {tx('Os dados sensíveis estão protegidos')}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 bg-warning/10 rounded-full">
                    <Unlock className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium">{tx('Sem PIN Configurado')}</p>
                    <p className="text-sm text-muted-foreground">
                      {tx('Os dados sensíveis não estão protegidos')}
                    </p>
                  </div>
                </>
              )}
            </div>
            <Badge variant={hasPin ? 'default' : 'secondary'}>
              {hasPin ? tx('Protegido') : tx('Não Protegido')}
            </Badge>
          </div>

          {isPinVerified && (
            <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
              <span className="text-sm text-success">
                {tx('Sessão desbloqueada - dados sensíveis visíveis')}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={lockSensitiveData}
              >
                <Lock className="w-4 h-4 mr-1" />
                {tx('Bloquear')}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!hasPin ? (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Shield className="w-4 h-4 mr-2" />
                {tx('Criar PIN de Segurança')}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowChangeDialog(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  {tx('Alterar PIN')}
                </Button>
                <Button 
                  variant="outline" 
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {tx('Remover PIN')}
                </Button>
              </>
            )}
          </div>

          <div className="p-4 bg-card border rounded-lg space-y-2">
            <h4 className="font-medium text-sm">{tx('Dados protegidos pelo PIN:')}</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>{tx('• Morada e localização')}</li>
              <li>{tx('• Número de telefone e email')}</li>
              <li>{tx('• Dados dos pais/encarregados de educação')}</li>
              <li>{tx('• Documentos de identificação (CC, NIF)')}</li>
              <li>{tx('• Certificados médicos')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <PinDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        mode="create"
        onSubmit={createPin}
      />

      <PinDialog
        open={showChangeDialog}
        onOpenChange={setShowChangeDialog}
        mode="change"
        onSubmit={(currentPin, newPin) => changePin(currentPin, newPin!)}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tx('Remover PIN de Segurança?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tx('Isto irá remover a proteção dos dados sensíveis dos jogadores. Qualquer pessoa com acesso à aplicação poderá ver moradas, contactos e documentos.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tx('Cancelar')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowDeleteConfirm(false);
                setShowDeletePinDialog(true);
              }}
            >
              {tx('Continuar')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PinDialog
        open={showDeletePinDialog}
        onOpenChange={setShowDeletePinDialog}
        mode="verify"
        onSubmit={handleDeletePin}
        title={tx('Confirmar Remoção do PIN')}
        description={tx('Introduza o seu PIN atual para confirmar a remoção.')}
      />
    </>
  );
}
