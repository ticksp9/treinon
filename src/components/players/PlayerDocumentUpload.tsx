import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';
import { Upload, X, FileText, Image, Loader2 } from 'lucide-react';

interface PlayerDocumentUploadProps {
  playerId: string;
  documentType: 'photo' | 'id_document' | 'medical_certificate';
  currentUrl?: string | null;
  onUploadComplete: (url: string) => void;
  label: string;
}

export function PlayerDocumentUpload({
  playerId,
  documentType,
  currentUrl,
  onUploadComplete,
  label,
}: PlayerDocumentUploadProps) {
  const { user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de ficheiro não suportado. Use JPEG, PNG, WebP ou PDF.');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ficheiro demasiado grande. Máximo 10MB.');
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${playerId}/${documentType}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('player-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get signed URL for private bucket
      const { data: signedData } = await supabase.storage
        .from('player-documents')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year validity

      if (signedData?.signedUrl) {
        setPreviewUrl(signedData.signedUrl);
        onUploadComplete(fileName); // Store the path, not the signed URL
        toast.success('Documento carregado com sucesso!');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Erro ao carregar documento');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onUploadComplete('');
  };

  const isPdf = previewUrl?.includes('.pdf') || previewUrl?.includes('application/pdf');

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {previewUrl ? (
        <div className="relative border rounded-lg p-4 bg-muted/50">
          <div className="flex items-center gap-3">
            {isPdf ? (
              <FileText className="w-10 h-10 text-primary" />
            ) : (
              <img
                src={previewUrl}
                alt={label}
                className="w-16 h-16 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">Documento carregado</p>
              <p className="text-xs text-muted-foreground">
                {isPdf ? 'PDF' : 'Imagem'}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              className="text-destructive hover:text-destructive"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-2 border-dashed rounded-lg p-4 hover:border-primary/50 transition-colors">
          <label className="flex flex-col items-center gap-2 cursor-pointer">
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileChange}
              disabled={isUploading}
              className="hidden"
            />
            {isUploading ? (
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="flex gap-2">
                  <Image className="w-6 h-6 text-muted-foreground" />
                  <FileText className="w-6 h-6 text-muted-foreground" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Clique para carregar imagem ou PDF
                </span>
                <span className="text-xs text-muted-foreground">
                  Máximo 10MB
                </span>
              </>
            )}
          </label>
        </div>
      )}
    </div>
  );
}
