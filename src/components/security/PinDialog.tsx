import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Shield, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface PinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'verify' | 'change';
  onSubmit: (pin: string, newPin?: string) => Promise<{ success: boolean; error?: string }>;
  title?: string;
  description?: string;
}

export function PinDialog({ 
  open, 
  onOpenChange, 
  mode, 
  onSubmit,
  title,
  description 
}: PinDialogProps) {
  const [pin, setPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'create') {
        if (pin !== confirmPin) {
          setError('Os PINs não coincidem');
          setLoading(false);
          return;
        }
        const result = await onSubmit(pin);
        if (result.success) {
          toast.success('PIN de segurança criado com sucesso!');
          onOpenChange(false);
          resetForm();
        } else {
          setError(result.error || 'Erro ao criar PIN');
        }
      } else if (mode === 'verify') {
        const result = await onSubmit(pin);
        if (result.success) {
          toast.success('PIN verificado!');
          onOpenChange(false);
          resetForm();
        } else {
          setError(result.error || 'PIN incorreto');
        }
      } else if (mode === 'change') {
        if (newPin !== confirmPin) {
          setError('Os novos PINs não coincidem');
          setLoading(false);
          return;
        }
        const result = await onSubmit(pin, newPin);
        if (result.success) {
          toast.success('PIN alterado com sucesso!');
          onOpenChange(false);
          resetForm();
        } else {
          setError(result.error || 'Erro ao alterar PIN');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
  };

  const getTitle = () => {
    if (title) return title;
    switch (mode) {
      case 'create': return 'Criar PIN de Segurança';
      case 'verify': return 'Introduza o PIN';
      case 'change': return 'Alterar PIN';
      default: return 'PIN de Segurança';
    }
  };

  const getDescription = () => {
    if (description) return description;
    switch (mode) {
      case 'create': return 'Crie um PIN de 4-6 dígitos para proteger os dados pessoais dos jogadores (morada, contactos, documentos).';
      case 'verify': return 'Introduza o seu PIN para aceder aos dados protegidos.';
      case 'change': return 'Introduza o PIN atual e o novo PIN.';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription>
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin">
              {mode === 'change' ? 'PIN Atual' : 'PIN (4-6 dígitos)'}
            </Label>
            <div className="relative">
              <Input
                id="pin"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="pr-10"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {(mode === 'create' || mode === 'change') && (
            <>
              <div className="space-y-2">
                <Label htmlFor="newPin">
                  {mode === 'change' ? 'Novo PIN' : 'Confirmar PIN'}
                </Label>
                <Input
                  id="newPin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={mode === 'change' ? newPin : confirmPin}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    if (mode === 'change') setNewPin(value);
                    else setConfirmPin(value);
                  }}
                  placeholder="••••••"
                  autoComplete="off"
                />
              </div>

              {mode === 'change' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPin">Confirmar Novo PIN</Label>
                  <Input
                    id="confirmPin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••••"
                    autoComplete="off"
                  />
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              <Lock className="w-4 h-4 mr-2" />
              {loading ? 'A processar...' : mode === 'verify' ? 'Verificar' : 'Guardar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
