import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export function useSecurityPin() {
  const { user } = useAuth();
  const [hasPin, setHasPin] = useState<boolean>(false);
  const [isPinVerified, setIsPinVerified] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Check if user has a PIN set (only checks existence, not hash)
  const checkHasPin = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // The table is not readable from the client (the hash must never leave the server)
      const { data, error } = await (supabase.rpc as any)('has_security_pin');

      if (error) throw error;
      setHasPin(data === true);
    } catch (error) {
      console.error('Error checking PIN:', error);
      setHasPin(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Check session for valid PIN verification
  useEffect(() => {
    if (!user) return;
    
    const sessionKey = sessionStorage.getItem(`pin_verified_${user.id}`);
    if (sessionKey) {
      setIsPinVerified(true);
    }
    
    checkHasPin();
  }, [user, checkHasPin]);

  // Create a new PIN via edge function
  const createPin = useCallback(async (pin: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Não autenticado' };
    
    if (pin.length < 4 || pin.length > 6) {
      return { success: false, error: 'O PIN deve ter entre 4 e 6 dígitos' };
    }

    if (!/^\d+$/.test(pin)) {
      return { success: false, error: 'O PIN deve conter apenas números' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'create', pin },
      });

      if (error) throw error;
      if (!data?.success) return { success: false, error: data?.error || 'Erro ao criar PIN' };
      
      setHasPin(true);
      return { success: true };
    } catch (error: any) {
      console.error('Error creating PIN:', error);
      return { success: false, error: error.message || 'Erro ao criar PIN' };
    }
  }, [user]);

  // Verify PIN via edge function (server-side comparison)
  const verifyPin = useCallback(async (pin: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Não autenticado' };

    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'verify', pin },
      });

      if (error) throw error;
      
      if (data?.success) {
        // Store verification in session
        const sessionKey = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem(`pin_verified_${user.id}`, sessionKey);
        setIsPinVerified(true);
        return { success: true };
      } else {
        return { success: false, error: data?.error || 'PIN incorreto' };
      }
    } catch (error: any) {
      console.error('Error verifying PIN:', error);
      return { success: false, error: error.message || 'Erro ao verificar PIN' };
    }
  }, [user]);

  // Lock (clear verification)
  const lockSensitiveData = useCallback(() => {
    if (user) {
      sessionStorage.removeItem(`pin_verified_${user.id}`);
    }
    setIsPinVerified(false);
  }, [user]);

  // Change PIN via edge function
  const changePin = useCallback(async (currentPin: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Não autenticado' };

    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'change', pin: currentPin, new_pin: newPin },
      });

      if (error) throw error;
      return { success: data?.success ?? false, error: data?.error };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erro ao alterar PIN' };
    }
  }, [user]);

  // Delete PIN via edge function
  const deletePin = useCallback(async (currentPin: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Não autenticado' };

    try {
      const { data, error } = await supabase.functions.invoke('verify-pin', {
        body: { action: 'delete', pin: currentPin },
      });

      if (error) throw error;
      
      if (data?.success) {
        setHasPin(false);
        lockSensitiveData();
      }
      return { success: data?.success ?? false, error: data?.error };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erro ao eliminar PIN' };
    }
  }, [user, lockSensitiveData]);

  return {
    hasPin,
    isPinVerified,
    loading,
    createPin,
    verifyPin,
    changePin,
    deletePin,
    lockSensitiveData,
    checkHasPin
  };
}
