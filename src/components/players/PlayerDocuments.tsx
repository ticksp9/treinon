import { updatePlayerPrivate } from '@/lib/player-private';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Upload, X, FileText, Image, Loader2, Eye, Trash2 } from 'lucide-react';

interface PlayerDocumentsProps {
  playerId: string;
  player: {
    photo_url?: string | null;
    id_document_url?: string | null;
    medical_certificate_url?: string | null;
  };
  onUpdate: () => void;
}

export function PlayerDocuments({ playerId, player, onUpdate }: PlayerDocumentsProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'photo_url' | 'id_document_url' | 'medical_certificate_url'
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = field === 'photo_url'
      ? ['image/jpeg', 'image/png', 'image/webp']
      : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    if (!allowedTypes.includes(file.type)) {
      toast.error(field === 'photo_url'
        ? 'Use apenas imagens (JPEG, PNG, WebP)'
        : 'Use imagens ou PDF');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ficheiro demasiado grande. Máximo 10MB.');
      return;
    }

    setIsUploading(field);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${playerId}/${field}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('player-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get signed URL
      const { data: signedData } = await supabase.storage
        .from('player-documents')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365);

      // Update player record
      const { error: updateError } = await supabase
        .from('players')
        .update({ [field]: fileName })
        .eq('id', playerId);

      if (updateError) throw updateError;

      if (signedData?.signedUrl) {
        setSignedUrls(prev => ({ ...prev, [field]: signedData.signedUrl }));
      }

      toast.success('Documento carregado com sucesso!');
      onUpdate();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao carregar documento');
    } finally {
      setIsUploading(null);
    }
  };

  const handleRemove = async (field: 'photo_url' | 'id_document_url' | 'medical_certificate_url') => {
    try {
      const currentPath = player[field];

      if (currentPath) {
        await supabase.storage
          .from('player-documents')
          .remove([currentPath]);
      }

      if (field === 'id_document_url') {
        // personal data: cleared where it lives (an empty value on the player row is ignored)
        const failed = await updatePlayerPrivate(playerId, { id_document_url: null });
        if (failed) throw new Error(failed);
      } else {
        await supabase
          .from('players')
          .update({ [field]: null })
          .eq('id', playerId);
      }

      setSignedUrls(prev => {
        const newUrls = { ...prev };
        delete newUrls[field];
        return newUrls;
      });

      toast.success('Documento removido');
      onUpdate();
    } catch (error) {
      console.error('Remove error:', error);
      toast.error('Erro ao remover documento');
    }
  };

  const getSignedUrl = async (path: string, field: string) => {
    if (signedUrls[field]) return signedUrls[field];

    const { data } = await supabase.storage
      .from('player-documents')
      .createSignedUrl(path, 60 * 60);

    if (data?.signedUrl) {
      setSignedUrls(prev => ({ ...prev, [field]: data.signedUrl }));
      return data.signedUrl;
    }
    return null;
  };

  const handleView = async (field: 'photo_url' | 'id_document_url' | 'medical_certificate_url') => {
    const path = player[field];
    if (!path) return;

    const url = await getSignedUrl(path, field);
    if (url) {
      window.open(url, '_blank');
    }
  };

  const renderUploadCard = (
    field: 'photo_url' | 'id_document_url' | 'medical_certificate_url',
    label: string,
    description: string,
    acceptTypes: string
  ) => {
    const hasFile = !!player[field];
    const isCurrentlyUploading = isUploading === field;

    return (
      <div className="border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">{label}</h4>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {hasFile && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleView(field)}
              >
                <Eye className="w-4 h-4 mr-1" />
                Ver
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRemove(field)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {!hasFile && (
          <div className="border-2 border-dashed rounded-lg p-4 hover:border-primary/50 transition-colors">
            <label className="flex flex-col items-center gap-2 cursor-pointer">
              <Input
                type="file"
                accept={acceptTypes}
                onChange={(e) => handleFileUpload(e, field)}
                disabled={isCurrentlyUploading}
                className="hidden"
              />
              {isCurrentlyUploading ? (
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <div className="flex gap-2">
                    <Image className="w-6 h-6 text-muted-foreground" />
                    {acceptTypes.includes('pdf') && (
                      <FileText className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground text-center">
                    Clique para carregar
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Máximo 10MB
                  </span>
                </>
              )}
            </label>
          </div>
        )}

        {hasFile && (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <FileText className="w-4 h-4" />
            <span>Documento carregado</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {renderUploadCard(
        'photo_url',
        'Foto do Jogador',
        'Foto para identificação',
        'image/jpeg,image/png,image/webp'
      )}
      {renderUploadCard(
        'id_document_url',
        'Documento de Identificação',
        'CC, Passaporte ou Título de Residência',
        'image/jpeg,image/png,image/webp,application/pdf'
      )}
      {renderUploadCard(
        'medical_certificate_url',
        'Atestado Médico',
        'Certificado médico desportivo',
        'image/jpeg,image/png,image/webp,application/pdf'
      )}
    </div>
  );
}
