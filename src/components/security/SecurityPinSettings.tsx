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

export function SecurityPinSettings() {
  const { hasPin, isPinVerified, createPin, changePin, deletePin, lockSensitiveData } = useSecurityPin();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showChangeDialog, setShowChangeDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeletePinDialog, setShowDeletePinDialog] = useState(false);

  const handleDeletePin = async (pin: string) => {
    const result = await deletePin(pin);
    if (result.success) {
      toast.success('PIN eliminado com sucesso');
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
            Segurança de Dados Pessoais
          </CardTitle>
          <CardDescription>
            Configure um PIN para proteger dados sensíveis dos jogadores (morada, contactos, documentos de identificação).
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
                    <p className="font-medium">PIN de Segurança Ativo</p>
                    <p className="text-sm text-muted-foreground">
                      Os dados sensíveis estão protegidos
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 bg-warning/10 rounded-full">
                    <Unlock className="w-5 h-5 text-warning" />
                  </div>
                  <div>
                    <p className="font-medium">Sem PIN Configurado</p>
                    <p className="text-sm text-muted-foreground">
                      Os dados sensíveis não estão protegidos
                    </p>
                  </div>
                </>
              )}
            </div>
            <Badge variant={hasPin ? 'default' : 'secondary'}>
              {hasPin ? 'Protegido' : 'Não Protegido'}
            </Badge>
          </div>

          {isPinVerified && (
            <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
              <span className="text-sm text-success">
                Sessão desbloqueada - dados sensíveis visíveis
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={lockSensitiveData}
              >
                <Lock className="w-4 h-4 mr-1" />
                Bloquear
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!hasPin ? (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Shield className="w-4 h-4 mr-2" />
                Criar PIN de Segurança
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowChangeDialog(true)}>
                  <Settings className="w-4 h-4 mr-2" />
                  Alterar PIN
                </Button>
                <Button 
                  variant="outline" 
                  className="text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Remover PIN
                </Button>
              </>
            )}
          </div>

          <div className="p-4 bg-card border rounded-lg space-y-2">
            <h4 className="font-medium text-sm">Dados protegidos pelo PIN:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Morada e localização</li>
              <li>• Número de telefone e email</li>
              <li>• Dados dos pais/encarregados de educação</li>
              <li>• Documentos de identificação (CC, NIF)</li>
              <li>• Certificados médicos</li>
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
            <AlertDialogTitle>Remover PIN de Segurança?</AlertDialogTitle>
            <AlertDialogDescription>
              Isto irá remover a proteção dos dados sensíveis dos jogadores. 
              Qualquer pessoa com acesso à aplicação poderá ver moradas, contactos e documentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setShowDeleteConfirm(false);
                setShowDeletePinDialog(true);
              }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PinDialog
        open={showDeletePinDialog}
        onOpenChange={setShowDeletePinDialog}
        mode="verify"
        onSubmit={handleDeletePin}
        title="Confirmar Remoção do PIN"
        description="Introduza o seu PIN atual para confirmar a remoção."
      />
    </>
  );
}
