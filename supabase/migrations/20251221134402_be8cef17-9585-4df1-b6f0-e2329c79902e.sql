-- Add fields for player competition registration documentation
-- These fields are designed to be flexible for multiple countries

-- ID Document fields
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS id_document_type text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS id_document_number text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS id_document_expiry date;

-- Medical certificate fields
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS medical_certificate_expiry date;

-- Federation registration
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS federation_id text;

-- Tax identification (NIF in Portugal, flexible for other countries)
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS tax_id text;

-- Place of birth (important for some federations)
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS birth_place text;

-- Comments for documentation
COMMENT ON COLUMN public.players.id_document_type IS 'Type of ID document: passport, national_id, residence_permit, etc.';
COMMENT ON COLUMN public.players.id_document_number IS 'ID document number';
COMMENT ON COLUMN public.players.id_document_expiry IS 'ID document expiry date';
COMMENT ON COLUMN public.players.medical_certificate_expiry IS 'Medical certificate expiry date';
COMMENT ON COLUMN public.players.federation_id IS 'Federation registration number';
COMMENT ON COLUMN public.players.tax_id IS 'Tax identification number (NIF, SSN, etc.)';
COMMENT ON COLUMN public.players.birth_place IS 'Place of birth (city, country)';