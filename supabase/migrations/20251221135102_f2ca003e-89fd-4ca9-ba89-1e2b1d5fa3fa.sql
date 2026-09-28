-- Create storage bucket for player documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'player-documents', 
  'player-documents', 
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
);

-- Storage policies for player documents
CREATE POLICY "Users can upload player documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'player-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their player documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'player-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their player documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'player-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their player documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'player-documents' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add document URL columns to players table
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS id_document_url text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS medical_certificate_url text;

-- Comments
COMMENT ON COLUMN public.players.id_document_url IS 'URL of uploaded ID document scan';
COMMENT ON COLUMN public.players.medical_certificate_url IS 'URL of uploaded medical certificate';