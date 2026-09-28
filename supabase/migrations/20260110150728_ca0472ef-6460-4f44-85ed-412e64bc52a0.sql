-- Add is_test field to matches table for test games
ALTER TABLE public.matches 
ADD COLUMN is_test boolean NOT NULL DEFAULT false;

-- Add comment explaining the field
COMMENT ON COLUMN public.matches.is_test IS 'When true, this match is a test/practice match that should be excluded from statistics and reports';