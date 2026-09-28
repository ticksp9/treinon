-- Add parent/guardian and contact fields to players table
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS address text,
ADD COLUMN IF NOT EXISTS parent_name text,
ADD COLUMN IF NOT EXISTS parent_email text,
ADD COLUMN IF NOT EXISTS parent_phone text,
ADD COLUMN IF NOT EXISTS parent_name_2 text,
ADD COLUMN IF NOT EXISTS parent_email_2 text,
ADD COLUMN IF NOT EXISTS parent_phone_2 text;