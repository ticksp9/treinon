-- Add modalities column to clubs table
ALTER TABLE public.clubs 
ADD COLUMN modalities text[] DEFAULT ARRAY['football']::text[];

-- Add comment for clarity
COMMENT ON COLUMN public.clubs.modalities IS 'Array of sport modalities: football, futsal, or both';