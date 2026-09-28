-- Add language column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'pt';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.language IS 'User preferred language: pt, en, fr, es, de, ar, zh';